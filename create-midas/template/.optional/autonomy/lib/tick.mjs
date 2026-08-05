import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadProjectPolicy, loadMetapolicy, PACKAGE_ROOT } from './policy.mjs';
import {
  readStateYaml,
  writeAutonomyPointers,
  readControl,
  casControl,
  defaultAutonomyPointers,
} from './state.mjs';
import { acquireLease, releaseLease, readLease } from './lock.mjs';
import { appendJournal, verifyJournal, writeJournalAnchor } from './journal.mjs';
import { canReserve, reserve, releaseReservation, classifyLimitError } from './budget.mjs';
import { authorizeBuilderEffects, brokerDecide, brokeredEffectsPrompt } from './broker.mjs';
import { validateCommitPushAuthz, consumeAuthz } from './authz.mjs';
import { newToken } from './digest.mjs';
import { runFake } from './runners/fake.mjs';
import { runCursorCloud } from './runners/cursor-cloud.mjs';
import { runAuditor } from './audit.mjs';
import { evaluateHook, loadFailClosedHooks } from './hooks.mjs';
import { detectCredentialLeak, injectRoleEnv, redactForJournal } from './credentials.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadActionContract(id = 'execute-next-sprint-task') {
  const path = join(PACKAGE_ROOT, 'actions', `${id}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseStage(yaml) {
  const m = yaml.match(/^stage:\s*(\S+)/m);
  return m ? m[1] : null;
}

function findActiveSprint(yaml) {
  const sprints = [];
  let inSprints = false;
  let cur = null;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      if (cur) sprints.push(cur);
      inSprints = /^sprints:/.test(line);
      cur = null;
      continue;
    }
    if (!inSprints) continue;
    const idM = line.match(/^\s*-\s*id:\s*"?([\w.-]+)"?/);
    if (idM) {
      if (cur) sprints.push(cur);
      cur = { id: idM[1], status: '', title: '' };
      continue;
    }
    if (!cur) continue;
    const st = line.match(/^\s+status:\s*"?(\w+)"?/);
    if (st) cur.status = st[1];
    const title = line.match(/^\s+title:\s*"?([^"]+)"?/);
    if (title) cur.title = title[1];
  }
  if (cur) sprints.push(cur);
  return sprints.find((s) => s.status === 'active') || null;
}

function findNextTask(projectRoot, sprintId, productRel = '.harness/product') {
  const sprintDir = join(projectRoot, productRel, 'sprints');
  if (!existsSync(sprintDir)) return null;
  const files = readdirSync(sprintDir).filter((f) => f.startsWith(`${sprintId}-`) && f.endsWith('.md'));
  if (!files.length) {
    // Also accept any NN-*.md when id matches prefix
    const alt = readdirSync(sprintDir).filter((f) => f.endsWith('.md'));
    for (const f of alt) {
      if (f.startsWith(sprintId)) files.push(f);
    }
  }
  // Never invent work — missing sprint markdown blocks the tick (callers treat null as no_open_task).
  if (!files.length) return null;
  const file = join(sprintDir, files[0]);
  const body = readFileSync(file, 'utf8');
  // Prefer unchecked markdown tasks
  const unchecked = body.match(/^\s*-\s*\[\s*\]\s+(.+)$/m);
  if (unchecked) {
    return { id: slugTask(unchecked[1]), title: unchecked[1].trim(), file };
  }
  return { id: 'task-complete', title: 'no open tasks', file, done: true };
}

function slugTask(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'task';
}

function resolveJournalPath(autonomy) {
  return autonomy?.journal_path || '.harness/runs/autonomy/journal.jsonl';
}

export function statusReport(projectRoot) {
  const { autonomy, yaml } = readStateYaml(projectRoot);
  const policy = loadProjectPolicy(projectRoot);
  const lease = readLease(projectRoot);
  const control = readControl(projectRoot);
  const journal = verifyJournal(projectRoot, resolveJournalPath(autonomy));
  return {
    autonomy,
    policy: {
      missing: policy.missing,
      digest: policy.digest,
      enabled: policy.policy.enabled,
      mode: policy.policy.mode,
      errors: policy.errors,
    },
    control,
    lease,
    journal: { ok: journal.ok, count: journal.count, tip_hash: journal.tip_hash },
    stage: yaml ? parseStage(yaml) : null,
    metapolicy: loadMetapolicy().invariants,
  };
}

export function dryRun(projectRoot, opts = {}) {
  const report = statusReport(projectRoot);
  const action = loadActionContract();
  const { yaml, autonomy } = readStateYaml(projectRoot);
  const policyLoad = loadProjectPolicy(projectRoot);
  const plan = {
    would_effect: false,
    action: action.id,
    blockers: [],
    next: null,
  };

  if (policyLoad.missing || !policyLoad.policy.enabled || policyLoad.policy.mode === 'disabled') {
    plan.blockers.push('autonomy_disabled');
  }
  if (policyLoad.errors.length) plan.blockers.push(...policyLoad.errors.map((e) => `policy:${e}`));
  if (!yaml) plan.blockers.push('missing_state');
  else if (parseStage(yaml) !== 'sprint_execution') plan.blockers.push(`stage_not_sprint_execution:${parseStage(yaml)}`);

  const sprint = yaml ? findActiveSprint(yaml) : null;
  if (!sprint) plan.blockers.push('no_active_sprint');
  else {
    const task = findNextTask(projectRoot, sprint.id, opts.productRel);
    if (!task || task.done) plan.blockers.push('no_open_task');
    else plan.next = { sprint, task, branch: `${policyLoad.policy.branch.prefix}${sprint.id}-${task.id}` };
  }

  const authz = validateCommitPushAuthz(projectRoot, {
    repo: opts.repo || 'local/project',
    branchPrefix: policyLoad.policy.branch.prefix,
    actionId: action.id,
    policyDigest: policyLoad.digest,
  });
  if (!authz.valid) plan.blockers.push(`authz:${authz.reason}`);

  const reserveCents = Math.min(50, policyLoad.policy.budget.max_cost_cents_reserve || 50);
  const budget = canReserve(projectRoot, policyLoad.policy, reserveCents);
  if (!budget.ok) plan.blockers.push(`budget:${budget.reason}`);

  plan.would_effect = plan.blockers.length === 0;
  plan.policy_digest = policyLoad.digest;
  plan.status = autonomy.status;
  return plan;
}

/**
 * Idempotent tick: lock → idempotency → reserve → effect → reconcile → state write last.
 */
export async function tick(projectRoot, opts = {}) {
  const runnerName = opts.runner || process.env.MIDAS_AUTONOMY_RUNNER || 'fake';
  const holder = opts.holder || `tick:${process.pid}`;
  const action = loadActionContract();
  const policyLoad = loadProjectPolicy(projectRoot);
  const meta = loadMetapolicy();

  if (policyLoad.missing || !policyLoad.policy.enabled || policyLoad.policy.mode === 'disabled') {
    return finish(projectRoot, {
      status: 'idle',
      ok: false,
      reason: 'disabled',
      effects: false,
    });
  }
  if (policyLoad.errors.length) {
    return finish(projectRoot, {
      status: 'blocked',
      ok: false,
      reason: 'policy_invalid',
      errors: policyLoad.errors,
    }, policyLoad);
  }

  // Reject silent bounded→full
  if (policyLoad.policy.mode === 'full' || policyLoad.policy.mode === 'custom') {
    return finish(projectRoot, {
      status: 'blocked',
      ok: false,
      reason: 'p0_mode_forbidden',
    }, policyLoad);
  }

  const leaseResult = await Promise.resolve(acquireLease(projectRoot, { holder }));
  if (!leaseResult.ok) {
    return {
      ok: false,
      reason: 'lease_held',
      status: 'running',
      lease: leaseResult.lease,
    };
  }
  const lease = leaseResult.lease;

  try {
    const { yaml, autonomy } = readStateYaml(projectRoot);
    if (!yaml) {
      return await abort(projectRoot, lease, policyLoad, { status: 'blocked', reason: 'missing_state' });
    }
    if (parseStage(yaml) !== 'sprint_execution') {
      return await abort(projectRoot, lease, policyLoad, {
        status: 'blocked',
        reason: `stage:${parseStage(yaml)}`,
      });
    }

    // Reconcile durable control before creating a new remote effect
    const existingControl = readControl(projectRoot);
    if (
      existingControl?.phase === 'effect_pending' ||
      existingControl?.phase === 'running' ||
      existingControl?.phase === 'reserved'
    ) {
      return await reconcileInFlight(projectRoot, lease, policyLoad, existingControl, opts);
    }

    const sprint = findActiveSprint(yaml);
    if (!sprint) {
      return await abort(projectRoot, lease, policyLoad, { status: 'blocked', reason: 'no_active_sprint' });
    }
    const task = findNextTask(projectRoot, sprint.id, opts.productRel);
    if (!task || task.done) {
      return await completeIdle(projectRoot, lease, policyLoad, { reason: 'no_open_task' });
    }

    const branch = `${policyLoad.policy.branch.prefix}${sprint.id}-${task.id}`;
    const authz = validateCommitPushAuthz(projectRoot, {
      repo: opts.repo || 'local/project',
      branchPrefix: policyLoad.policy.branch.prefix,
      actionId: action.id,
      policyDigest: policyLoad.digest,
    });
    if (!authz.valid) {
      appendJournal(projectRoot, {
        type: 'approval_pending',
        reason: `authz:${authz.reason}`,
        policy_digest: policyLoad.digest,
        fencing_token: lease.fencing_token,
      });
      return await abort(projectRoot, lease, policyLoad, {
        status: 'approval_pending',
        reason: `authz:${authz.reason}`,
      });
    }

    const brokerCtx = {
      policy: policyLoad.policy,
      authz: { valid: true, policy_digest: authz.record.policy_digest },
      policyDigest: policyLoad.digest,
      branchPrefix: policyLoad.policy.branch.prefix,
    };

    const effectBatch = authorizeBuilderEffects(branch, brokerCtx);
    if (!effectBatch.allow) {
      const first = effectBatch.denied[0]?.decision;
      const status = first?.approval_pending ? 'approval_pending' : 'blocked';
      return await abort(projectRoot, lease, policyLoad, {
        status,
        reason: first?.reason || 'broker_denied',
      });
    }

    const hooks = loadFailClosedHooks();
    for (const effect of effectBatch.allowedEffects) {
      const hook = evaluateHook(
        'builder',
        {
          effect,
          path: effect === 'git.push' ? branch : undefined,
          command: effect === 'shell.exec' ? 'npm test' : undefined,
          env: injectRoleEnv('builder'),
        },
        hooks,
      );
      if (!hook.allow) {
        return await abort(projectRoot, lease, policyLoad, {
          status: 'blocked',
          reason: `hook_bypass_blocked:${hook.reason}`,
        });
      }
    }

    const builderEnv = injectRoleEnv('builder');
    const leak = detectCredentialLeak({
      ...builderEnv,
      MIDAS_AUTONOMY_JOURNAL_KEY: process.env.MIDAS_TEST_LEAK_JOURNAL_KEY,
    });
    if (!leak.ok && process.env.MIDAS_TEST_LEAK_JOURNAL_KEY) {
      return await abort(projectRoot, lease, policyLoad, {
        status: 'blocked',
        reason: 'credential_leak',
        leaks: leak.leaks,
      });
    }

    // Order: lock (done) → idempotency key / CAS intent → reserve → effect → reconcile → state write last
    const idempotencyKey = existingControl?.idempotency_key || newToken('idem');
    const intent = {
      fencing_token: lease.fencing_token,
      idempotency_key: idempotencyKey,
      reservation_id: null,
      action_id: action.id,
      sprint_id: sprint.id,
      task_id: task.id,
      branch,
      policy_digest: policyLoad.digest,
      phase: 'intent_persisted',
      active_agent_id: null,
      active_run_id: null,
      active_sha: null,
      allowed_effects: effectBatch.allowedEffects,
    };
    const cas = casControl(projectRoot, existingControl, intent);
    if (!cas.ok) {
      return await abort(projectRoot, lease, policyLoad, {
        status: 'blocked',
        reason: 'control_cas_failed',
      });
    }

    appendJournal(
      projectRoot,
      redactForJournal({
        type: 'intent',
        idempotency_key: idempotencyKey,
        fencing_token: lease.fencing_token,
        task_id: task.id,
        policy_digest: policyLoad.digest,
      }),
    );

    const reserveCents = Math.min(50, policyLoad.policy.budget.max_cost_cents_reserve || 50);
    const reservationId = newToken('rsv');
    const reserved = reserve(projectRoot, policyLoad.policy, { reservationId, cents: reserveCents });
    if (!reserved.ok) {
      appendJournal(projectRoot, {
        type: 'paused_budget',
        reason: reserved.reason,
        policy_digest: policyLoad.digest,
      });
      casControl(projectRoot, { fencing_token: lease.fencing_token }, {
        ...intent,
        fencing_token: lease.fencing_token,
        phase: 'paused_budget',
        reservation_id: null,
      });
      return await abort(projectRoot, lease, policyLoad, {
        status: 'paused_budget',
        reason: reserved.reason,
        next_attempt_at: new Date(Date.now() + 3600_000).toISOString(),
      });
    }

    casControl(projectRoot, { fencing_token: lease.fencing_token }, {
      ...intent,
      fencing_token: lease.fencing_token,
      reservation_id: reservationId,
      phase: 'reserved',
    });

    let result;
    try {
      if (runnerName === 'cursor-cloud') {
        result = await runCursorCloud(action, {
          repoUrl: opts.repoUrl,
          branch,
          startingRef: opts.startingRef,
          modelId: opts.modelId,
          orchestrateModelId: opts.orchestrateModelId,
          idempotencyKey,
          control: intent,
          roleEnv: builderEnv,
          allowedEffects: effectBatch.allowedEffects,
          hooks,
          prompt: [
            buildBuilderPrompt({ action, sprint, task, branch, policyDigest: policyLoad.digest }),
            brokeredEffectsPrompt(effectBatch),
          ].join('\n\n'),
          onBeforeWait: async ({ agentId, runId }) => {
            casControl(projectRoot, { fencing_token: lease.fencing_token }, {
              ...intent,
              fencing_token: lease.fencing_token,
              reservation_id: reservationId,
              phase: 'running',
              active_agent_id: agentId,
              active_run_id: runId,
            });
          },
        });
      } else {
        result = await runFake(action, {
          projectRoot,
          task,
          branch,
          policyDigest: policyLoad.digest,
          fencingToken: lease.fencing_token,
          scenario: opts.scenario,
          allowedEffects: effectBatch.allowedEffects,
        });
      }
    } catch (err) {
      const classified = classifyLimitError(err);
      releaseReservation(projectRoot, reservationId);
      casControl(projectRoot, { fencing_token: lease.fencing_token }, {
        fencing_token: lease.fencing_token,
        phase: 'idle',
        last_error: String(err.message || err),
        idempotency_key: idempotencyKey,
      });
      const status = classified.status || 'blocked';
      appendJournal(projectRoot, {
        type: 'error',
        status,
        kind: classified.kind,
        message: String(err.message || err),
      });
      return await abort(projectRoot, lease, policyLoad, {
        status,
        reason: classified.kind,
        error: String(err.message || err),
        next_attempt_at:
          status.startsWith('paused_') ? new Date(Date.now() + 3600_000).toISOString() : null,
      });
    }

    if (result._crash_after) {
      // Simulate crash after remote effect: leave control in effect_pending for resume
      casControl(projectRoot, { fencing_token: lease.fencing_token }, {
        ...intent,
        fencing_token: lease.fencing_token,
        phase: 'effect_pending',
        active_agent_id: result.agent_id,
        active_run_id: result.run_id,
        active_sha: result.commit_sha,
      });
      releaseLease(projectRoot, lease.fencing_token);
      return {
        ok: false,
        crashed_after_effect: true,
        status: 'running',
        commit_sha: result.commit_sha,
        agent_id: result.agent_id,
      };
    }

    if (result.task_status === 'approval_pending') {
      releaseReservation(projectRoot, reservationId);
      appendJournal(projectRoot, { type: 'approval_pending', reason: result.reason });
      return await abort(projectRoot, lease, policyLoad, {
        status: 'approval_pending',
        reason: result.reason,
      });
    }

    // Consume single-use authz only after successful remote write path
    if (result.ok && result.commit_sha) {
      consumeAuthz(projectRoot);
    }

    const charged = result.usage?.charged_cents || 0;
    releaseReservation(projectRoot, reservationId, { chargedCents: charged });

    // Independent auditor on exact SHA (controller persists; producer cannot)
    const audit = await runAuditor({
      projectRoot,
      commitSha: result.commit_sha,
      policyDigest: policyLoad.digest,
      sprintId: sprint.id,
      taskId: task.id,
      mode: opts.auditMode || 'fake',
      orchestrateModel: opts.orchestrateModelId,
      policy: policyLoad.policy,
    });

    if (audit.attempted_effect) {
      const denied = brokerDecide(
        { effect: audit.attempted_effect, payload: {} },
        { policy: policyLoad.policy, authz: { valid: false }, policyDigest: policyLoad.digest },
      );
      const hookDeny = evaluateHook('auditor', { effect: audit.attempted_effect }, hooks);
      if (!denied.allow || !hookDeny.allow) {
        appendJournal(projectRoot, { type: 'auditor_mutation_blocked', effect: audit.attempted_effect });
      }
    }

    appendJournal(projectRoot, {
      type: 'tick_complete',
      commit_sha: result.commit_sha,
      agent_id: result.agent_id,
      run_id: result.run_id,
      audit_verdict: audit.verdict,
      policy_digest: policyLoad.digest,
      fencing_token: lease.fencing_token,
    });
    const jv = verifyJournal(projectRoot);
    writeJournalAnchor(projectRoot, { tip_hash: jv.tip_hash, count: jv.count });

    casControl(projectRoot, { fencing_token: lease.fencing_token }, {
      fencing_token: lease.fencing_token,
      phase: 'idle',
      last_commit_sha: result.commit_sha,
      last_audit_verdict: audit.verdict,
      idempotency_key: idempotencyKey,
    });

    writeAutonomyPointers(projectRoot, {
      enabled: true,
      mode: 'bounded',
      status: audit.ok ? 'idle' : 'blocked',
      policy_digest: policyLoad.digest,
      active_agent_id: null,
      active_run_id: null,
      active_sha: result.commit_sha,
      journal_path: autonomy.journal_path,
      next_attempt_at: null,
    });

    releaseLease(projectRoot, lease.fencing_token);

    return {
      ok: result.ok && audit.ok,
      status: audit.ok ? 'idle' : 'blocked',
      commit_sha: result.commit_sha,
      agent_id: result.agent_id,
      run_id: result.run_id,
      audit,
      metapolicy_invariants: meta.invariants,
      action: action.id,
      task,
      branch,
    };
  } catch (err) {
    releaseLease(projectRoot, lease.fencing_token);
    throw err;
  }
}

async function reconcileInFlight(projectRoot, lease, policyLoad, control, opts) {
  appendJournal(projectRoot, {
    type: 'reconcile',
    phase: control.phase,
    active_agent_id: control.active_agent_id,
    active_sha: control.active_sha,
  });

  if (control.active_sha) {
    const audit = await runAuditor({
      projectRoot,
      commitSha: control.active_sha,
      policyDigest: control.policy_digest || policyLoad.digest,
      sprintId: control.sprint_id,
      taskId: control.task_id,
      mode: opts.auditMode || 'fake',
      orchestrateModel: opts.orchestrateModelId,
    });
    // Expected fencing is the durable control token, not the new lease — reclaim ownership.
    casControl(projectRoot, control, {
      fencing_token: lease.fencing_token,
      phase: 'idle',
      last_commit_sha: control.active_sha,
      last_audit_verdict: audit.verdict,
      reconciled: true,
      idempotency_key: control.idempotency_key,
    });
    writeAutonomyPointers(projectRoot, {
      enabled: true,
      mode: 'bounded',
      status: 'idle',
      policy_digest: policyLoad.digest,
      active_agent_id: null,
      active_run_id: null,
      active_sha: control.active_sha,
      journal_path: resolveJournalPath(readStateYaml(projectRoot).autonomy),
      next_attempt_at: null,
    });
    releaseLease(projectRoot, lease.fencing_token);
    return {
      ok: true,
      reconciled: true,
      status: 'idle',
      commit_sha: control.active_sha,
      audit,
      note: 'reconciled orphan/in-flight effect; did not create a new agent',
    };
  }

  // No SHA yet — do not create another agent; stay blocked for human/resume
  writeAutonomyPointers(projectRoot, {
    enabled: true,
    mode: 'bounded',
    status: 'blocked',
    policy_digest: policyLoad.digest,
    active_agent_id: control.active_agent_id,
    active_run_id: control.active_run_id,
    active_sha: null,
    journal_path: resolveJournalPath(readStateYaml(projectRoot).autonomy),
    next_attempt_at: null,
  });
  releaseLease(projectRoot, lease.fencing_token);
  return {
    ok: false,
    reconciled: true,
    status: 'blocked',
    reason: 'in_flight_without_sha',
    control,
  };
}

export async function resume(projectRoot, opts = {}) {
  const { autonomy } = readStateYaml(projectRoot);
  if (autonomy.status === 'paused_budget' || autonomy.status === 'paused_quota') {
    if (autonomy.next_attempt_at && Date.parse(autonomy.next_attempt_at) > Date.now()) {
      return {
        ok: false,
        status: autonomy.status,
        reason: 'too_early',
        next_attempt_at: autonomy.next_attempt_at,
      };
    }
  }
  if (autonomy.status === 'blocked_unknown_limit') {
    return {
      ok: false,
      status: 'blocked_unknown_limit',
      reason: 'human_intervention_required',
    };
  }
  return tick(projectRoot, opts);
}

function buildBuilderPrompt({ action, sprint, task, branch, policyDigest }) {
  return [
    `Action: ${action.id}`,
    `Sprint: ${sprint.id} — ${sprint.title || ''}`,
    `Task: ${task.id} — ${task.title}`,
    `Work branch only: ${branch}`,
    `policy_digest: ${policyDigest}`,
    'Implement the task, run tests, commit on the work branch. Do not merge or deploy.',
    'Print the resulting 40-char commit SHA when done.',
  ].join('\n');
}

async function abort(projectRoot, lease, policyLoad, result) {
  writeAutonomyPointers(projectRoot, {
    ...defaultAutonomyPointers(),
    enabled: true,
    mode: policyLoad.policy.mode,
    status: result.status,
    policy_digest: policyLoad.digest,
    next_attempt_at: result.next_attempt_at || null,
  });
  releaseLease(projectRoot, lease.fencing_token);
  return { ok: false, ...result };
}

async function completeIdle(projectRoot, lease, policyLoad, extra) {
  writeAutonomyPointers(projectRoot, {
    enabled: true,
    mode: 'bounded',
    status: 'completed',
    policy_digest: policyLoad.digest,
    active_agent_id: null,
    active_run_id: null,
    active_sha: null,
    journal_path: resolveJournalPath(readStateYaml(projectRoot).autonomy),
    next_attempt_at: null,
  });
  releaseLease(projectRoot, lease.fencing_token);
  return { ok: true, status: 'completed', ...extra };
}

function finish(projectRoot, result, policyLoad) {
  if (policyLoad) {
    try {
      writeAutonomyPointers(projectRoot, {
        enabled: !!policyLoad.policy.enabled,
        mode: policyLoad.policy.mode,
        status: result.status || 'idle',
        policy_digest: policyLoad.digest || '',
        active_agent_id: null,
        active_run_id: null,
        active_sha: result.commit_sha || null,
        journal_path: resolveJournalPath(readStateYaml(projectRoot).autonomy),
        next_attempt_at: result.next_attempt_at || null,
      });
    } catch {
      // ignore pointer write failures on finish
    }
  }
  return result;
}
