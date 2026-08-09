import { readFileSync } from 'node:fs';
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
import {
  findRunnableSprint,
  findNextTask,
  parsePathsProduct,
  resolveSprintContext,
} from './sprint-resolve.mjs';
import { resolveAutonomyRepo } from './repo-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export { findRunnableSprint, findNextTask, parsePathsProduct, resolveSprintContext };

export function loadActionContract(id = 'execute-next-sprint-task') {
  const path = join(PACKAGE_ROOT, 'actions', `${id}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseStage(yaml) {
  const m = yaml.match(/^stage:\s*(\S+)/m);
  return m ? m[1] : null;
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

const AUTOPILOT_CLI = 'node .harness/autonomy/bin/midas-autopilot.mjs';

/**
 * One next command per blocker — keeps /midas-auto-pilot sprint path from dumping option walls.
 * @param {string[]} blockers
 * @param {{ operator_pending?: string[] }} [extra]
 */
export function guidanceForBlockers(blockers, extra = {}) {
  const steps = [];
  const seen = new Set();
  for (const b of blockers) {
    let step = null;
    if (b === 'autonomy_disabled') {
      step = {
        blocker: b,
        command: `${AUTOPILOT_CLI} setup --actor=<you> --hours=24`,
        why: 'Enable bounded policy (setup auto-creates a local authz key).',
      };
    } else if (b.startsWith('authz:')) {
      step = {
        blocker: b,
        command: `${AUTOPILOT_CLI} setup --actor=<you> --hours=24`,
        why:
          b === 'authz:already_used'
            ? 'Grant was consumed — setup renews a fresh time-boxed grant (no env key needed).'
            : 'Commit/push authz missing or invalid — setup renews it (local hmac auto-created).',
      };
    } else if (b === 'no_code_task') {
      step = {
        blocker: b,
        command: '/start-sprint',
        why:
          'Open checklist items are operator/manual (release, publish, smoke). Activate a code sprint, or tag code lines without [operator]/[manual].',
        operator_pending: extra.operator_pending || [],
      };
    } else if (b === 'no_open_task' || b === 'no_runnable_sprint') {
      step = {
        blocker: b,
        command: '/start-sprint',
        why: 'Need an active/planned sprint with unchecked - [ ] code tasks.',
      };
    } else if (b.startsWith('stage_not_sprint_execution')) {
      step = {
        blocker: b,
        command: '/midas-status',
        why: 'Finish phase gates until stage is sprint_execution.',
      };
    } else if (b.startsWith('budget:')) {
      step = {
        blocker: b,
        command: 'Inspect .harness/autonomy/budget-ledger.json / raise policy.budget reserves',
        why: 'Budget envelope exhausted.',
      };
    } else if (b.startsWith('policy:')) {
      step = {
        blocker: b,
        command: 'Fix .harness/autonomy/policy.yaml',
        why: 'Policy validation failed.',
      };
    }
    if (step && !seen.has(step.blocker)) {
      seen.add(step.blocker);
      steps.push(step);
    }
  }
  return steps;
}

export function dryRun(projectRoot, opts = {}) {
  const report = statusReport(projectRoot);
  const action = loadActionContract();
  const { yaml, autonomy } = readStateYaml(projectRoot);
  const policyLoad = loadProjectPolicy(projectRoot);
  const productRel = opts.productRel || (yaml ? parsePathsProduct(yaml) : '.harness/product');
  const plan = {
    would_effect: false,
    action: action.id,
    blockers: [],
    next: null,
    operator_pending: [],
    next_steps: [],
    recommendation: null,
  };

  if (policyLoad.missing || !policyLoad.policy.enabled || policyLoad.policy.mode === 'disabled') {
    plan.blockers.push('autonomy_disabled');
  }
  if (policyLoad.errors.length) plan.blockers.push(...policyLoad.errors.map((e) => `policy:${e}`));
  if (!yaml) plan.blockers.push('missing_state');
  else if (parseStage(yaml) !== 'sprint_execution') plan.blockers.push(`stage_not_sprint_execution:${parseStage(yaml)}`);

  const sprint = yaml ? findRunnableSprint(yaml) : null;
  if (!sprint) plan.blockers.push('no_runnable_sprint');
  else {
    const task = findNextTask(projectRoot, sprint.id, productRel);
    if (!task || task.done) plan.blockers.push('no_open_task');
    else if (task.operator_only) {
      plan.blockers.push('no_code_task');
      plan.operator_pending = task.operator_pending || [];
      plan.next = {
        sprint,
        task: null,
        operator_only: true,
        file: task.file,
      };
    } else {
      plan.next = {
        sprint,
        task,
        branch: `${policyLoad.policy.branch.prefix}${sprint.id}-${task.id}`,
      };
    }
  }

  const authz = validateCommitPushAuthz(projectRoot, {
    repo: resolveAutonomyRepo(projectRoot, opts, policyLoad.policy),
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
  plan.next_steps = guidanceForBlockers(plan.blockers, {
    operator_pending: plan.operator_pending,
  });
  // Prefer product blockers over authz when both present — renewing authz
  // for an operator-only sprint still cannot tick usefully.
  const preferred =
    plan.next_steps.find((s) => s.blocker === 'no_code_task') ||
    plan.next_steps.find((s) => s.blocker === 'no_open_task' || s.blocker === 'no_runnable_sprint') ||
    plan.next_steps[0] ||
    null;
  plan.recommendation = preferred
    ? preferred
    : {
        blocker: null,
        command: `${AUTOPILOT_CLI} tick --runner=fake`,
        why: 'Dry-run clear — human confirms tick (fake pilot or cursor-cloud).',
      };
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

    const productRel = opts.productRel || parsePathsProduct(yaml);
    const sprint = findRunnableSprint(yaml);
    if (!sprint) {
      return await abort(projectRoot, lease, policyLoad, { status: 'blocked', reason: 'no_runnable_sprint' });
    }
    const task = findNextTask(projectRoot, sprint.id, productRel);
    if (!task || task.done) {
      return await completeIdle(projectRoot, lease, policyLoad, { reason: 'no_open_task' });
    }
    if (task.operator_only) {
      return await abort(projectRoot, lease, policyLoad, {
        status: 'idle',
        ok: false,
        reason: 'no_code_task',
        operator_pending: task.operator_pending,
        recommendation: guidanceForBlockers(['no_code_task'], {
          operator_pending: task.operator_pending,
        })[0],
      });
    }

    const branch = `${policyLoad.policy.branch.prefix}${sprint.id}-${task.id}`;
    const authz = validateCommitPushAuthz(projectRoot, {
      repo: resolveAutonomyRepo(projectRoot, opts, policyLoad.policy),
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
