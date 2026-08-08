/**
 * Cursor Cloud runner — optional; requires @cursor/sdk@1.0.26.
 *
 * docs: @cursor/sdk@1.0.26 via https://cursor.com/docs/sdk/typescript
 *   - Agent.create({ cloud })
 *   - Agent.resume(agentId)
 *   - Cursor.models.list()
 *   - agent.getUsage() / Agent.getUsage
 *   - RateLimitError classification
 * Node engines: >=22.13 (package engines).
 *
 * Delivery is at-least-once: persist agent/run ids before awaiting completion;
 * reconcile orphans before creating another agent.
 */

export async function loadCursorSdk() {
  try {
    // Dynamic import so fake-only installs never require the SDK.
    return await import('@cursor/sdk');
  } catch (err) {
    const e = new Error(
      '@cursor/sdk not installed. From .harness/autonomy run: npm install (optionalDependency @cursor/sdk@1.0.26)',
    );
    e.cause = err;
    e.code = 'CURSOR_SDK_MISSING';
    throw e;
  }
}

export async function assertOrchestrateModelAvailable(sdk, orchestrateModelId) {
  // docs: @cursor/sdk@1.0.26 Cursor.models.list()
  const models = await sdk.Cursor.models.list();
  const ids = new Set(models.map((m) => m.id || m.name).filter(Boolean));
  if (orchestrateModelId && !ids.has(orchestrateModelId)) {
    return { ok: false, reason: 'orchestrate_model_unavailable', ids: [...ids] };
  }
  return { ok: true, ids: [...ids] };
}

export async function reconcileOrphans(sdk, control) {
  if (!control?.active_agent_id) return { orphan: false };
  try {
    // docs: @cursor/sdk@1.0.26 Agent.resume
    const agent = await sdk.Agent.resume(control.active_agent_id, {
      apiKey: process.env.CURSOR_API_KEY,
    });
    return { orphan: true, agent, agentId: control.active_agent_id, runId: control.active_run_id };
  } catch {
    return { orphan: false, stale: true };
  }
}

/**
 * @param {object} action — execute-next-sprint-task contract
 * @param {object} ctx
 */
export async function runCursorCloud(action, ctx) {
  const sdk = await loadCursorSdk();
  const {
    repoUrl,
    branch,
    startingRef,
    modelId,
    prompt,
    onBeforeWait,
    control,
    orchestrateModelId,
    requireOrchestrate = true,
    roleEnv,
    allowedEffects,
    hooks,
  } = ctx;

  if (!process.env.CURSOR_API_KEY) {
    const err = new Error('CURSOR_API_KEY required for --runner=cursor-cloud');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  // Never pass controller journal MAC / merge tokens into the agent process env.
  const { detectCredentialLeak } = await import('../credentials.mjs');
  const leak = detectCredentialLeak(roleEnv || { CURSOR_API_KEY: process.env.CURSOR_API_KEY });
  if (!leak.ok) {
    const err = new Error(`credential_leak:${leak.leaks.join(',')}`);
    err.code = 'CREDENTIAL_LEAK';
    throw err;
  }

  if (hooks && allowedEffects) {
    const { evaluateHook } = await import('../hooks.mjs');
    for (const effect of allowedEffects) {
      const decision = evaluateHook(
        'builder',
        {
          effect,
          path: effect === 'git.push' ? branch : undefined,
          command: effect === 'shell.exec' ? 'npm test' : undefined,
          env: roleEnv,
        },
        hooks,
      );
      if (!decision.allow) {
        const err = new Error(`hook_denied:${decision.reason}`);
        err.code = 'HOOK_DENIED';
        throw err;
      }
    }
  }

  if (requireOrchestrate) {
    const avail = await assertOrchestrateModelAvailable(sdk, orchestrateModelId);
    if (!avail.ok) {
      const err = new Error(`orchestrate model unavailable: ${orchestrateModelId}`);
      err.code = 'ORCHESTRATE_UNAVAILABLE';
      err.details = avail;
      throw err;
    }
  }

  const reconciled = await reconcileOrphans(sdk, control);
  let agent = reconciled.agent;
  if (!agent) {
    // docs: @cursor/sdk@1.0.26 Agent.create cloud — create is NOT exactly-once;
    // controller must CAS intent + idempotency before this call.
    // Agent receives only builder-scoped API key via process env of this runner —
    // never MIDAS_AUTONOMY_JOURNAL_KEY / MERGE_TOKEN.
    agent = await sdk.Agent.create({
      apiKey: (roleEnv && roleEnv.CURSOR_API_KEY) || process.env.CURSOR_API_KEY,
      model: { id: modelId || 'composer-2.5' },
      cloud: {
        repos: [{ url: repoUrl, startingRef: startingRef || 'main' }],
        autoCreatePR: false,
      },
    });
  }

  const agentId = agent.agentId || agent.id;
  // Persist before wait (at-least-once).
  if (typeof onBeforeWait === 'function') {
    await onBeforeWait({ agentId, runId: null, phase: 'created' });
  }

  // docs: @cursor/sdk@1.0.26 agent.send idempotencyKey (cloud)
  const run = await agent.send({
    message: prompt,
    idempotencyKey: ctx.idempotencyKey,
  });
  const runId = run.id || run.runId || null;
  if (typeof onBeforeWait === 'function') {
    await onBeforeWait({ agentId, runId, phase: 'running' });
  }

  let resultText = '';
  if (run.stream) {
    for await (const event of run.stream) {
      if (event?.type === 'assistant' || event?.text) {
        resultText += event.text || '';
      }
    }
  } else if (typeof run.wait === 'function') {
    await run.wait();
  }

  let usage = { input_tokens: null, output_tokens: null, charged_cents: null };
  try {
    // docs: @cursor/sdk@1.0.26 agent.getUsage — billed record; may lag until settled
    const billed = await agent.getUsage();
    const costDollars = billed?.cost?.total ?? billed?.cost ?? null;
    usage = {
      input_tokens: billed?.usage?.inputTokens ?? null,
      output_tokens: billed?.usage?.outputTokens ?? null,
      charged_cents: costDollars != null ? Math.round(Number(costDollars) * 100) : null,
      raw_note: 'getUsage is billed/settled view; run.usage is not an exact cap',
    };
  } catch {
    // local or unsettled — leave nulls
  }

  const commit_sha = ctx.expectedSha || extractSha(resultText) || null;

  return {
    ok: Boolean(commit_sha),
    task_status: commit_sha ? 'done' : 'blocked',
    commit_sha,
    agent_id: agentId,
    run_id: runId,
    evidence_paths: [],
    usage,
    resultText,
  };
}

function extractSha(text) {
  const m = String(text).match(/\b([0-9a-f]{40})\b/i);
  return m ? m[1].toLowerCase() : null;
}

export default { run: runCursorCloud };
