import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCommitPushAuthz, validateCommitPushAuthz, writeAuthz } from './authz.mjs';
import {
  loadProjectPolicy,
  parsePolicyYaml,
  validatePolicy,
  writePolicy,
} from './policy.mjs';
import { resolveAutonomyRepo } from './repo-resolve.mjs';
import { dryRun } from './tick.mjs';

const AUTOPILOT_REL = '.harness/autonomy/bin/midas-autopilot.mjs';

/**
 * One-shot bounded-autonomy setup: ensure policy enabled, optional authz grant, dry-run verdict.
 * Does not run tick — human or scheduler invokes tick separately.
 *
 * Authz default for setup is **time-boxed multi-use** (expires with `--hours`) so a pilot
 * loop of several ticks does not require re-setup after every fake run. Use `--single-use`
 * for a stricter one-tick grant.
 *
 * @param {string} projectRoot
 * @param {{ actor?: string, hours?: number, repo?: string, grantAuthz?: boolean, singleUse?: boolean }} opts
 */
export function runSetup(projectRoot, opts = {}) {
  const steps = [];
  const autopilotPath = join(projectRoot, AUTOPILOT_REL);

  if (!existsSync(autopilotPath)) {
    return {
      ok: false,
      status: 'not_installed',
      steps,
      next_command:
        'npx github:okuzpe/midas-harness#v{VERSION} --update --autonomy --tools=cursor --yes',
      message:
        'Autonomy capability missing. Re-run the installer with --autonomy (substitute {VERSION} from INSTALL.md).',
    };
  }
  steps.push({ step: 'capability', ok: true });

  const policyLoad = loadProjectPolicy(projectRoot, { createIfMissing: true });
  if (policyLoad.errors.length) {
    return {
      ok: false,
      status: 'policy_invalid',
      steps,
      errors: policyLoad.errors,
      message: 'Fix .harness/autonomy/policy.yaml before setup can continue.',
    };
  }

  let policyDigest = policyLoad.digest;
  if (!policyLoad.policy.enabled || policyLoad.policy.mode !== 'bounded') {
    let text = policyLoad.text || readFileSync(policyLoad.path, 'utf8');
    text = text.replace(/^mode:\s*\S+/m, 'mode: bounded');
    text = text.replace(/^enabled:\s*\S+/m, 'enabled: true');
    policyDigest = writePolicy(projectRoot, text);
    const enabled = parsePolicyYaml(text);
    const errors = validatePolicy(enabled);
    if (errors.length) {
      return { ok: false, status: 'policy_invalid', steps, errors };
    }
    steps.push({ step: 'policy_enable', ok: true, mode: 'bounded' });
  } else {
    steps.push({ step: 'policy_enable', ok: true, skipped: true });
  }

  const repo = resolveAutonomyRepo(projectRoot, { repo: opts.repo }, policyLoad.policy);
  const reload = loadProjectPolicy(projectRoot);
  policyDigest = reload.digest;

  const shouldGrant = opts.grantAuthz !== false;
  // Setup defaults to multi-use within the hours window (opt-in single-use).
  const singleUse = opts.singleUse === true;
  let authz = validateCommitPushAuthz(projectRoot, {
    repo,
    branchPrefix: reload.policy.branch.prefix,
    actionId: 'execute-next-sprint-task',
    policyDigest,
  });

  // Renew when missing/invalid OR when caller wants a fresh grant (already_used / expired).
  const needsRenew = shouldGrant && !authz.valid;
  if (needsRenew) {
    if (!process.env.MIDAS_AUTONOMY_AUTHZ_KEY) {
      steps.push({
        step: 'authz_grant',
        ok: false,
        reason: 'missing_authz_key',
        hint: 'Set MIDAS_AUTONOMY_AUTHZ_KEY in the shell, then re-run setup.',
      });
    } else {
      const hours = Number(opts.hours || 24);
      const record = createCommitPushAuthz({
        repo,
        branchPrefix: reload.policy.branch.prefix,
        actionId: 'execute-next-sprint-task',
        policyDigest,
        actor: opts.actor || 'human',
        expiresAt: new Date(Date.now() + hours * 3600_000).toISOString(),
        singleUse,
      });
      writeAuthz(projectRoot, record);
      authz = validateCommitPushAuthz(projectRoot, {
        repo,
        branchPrefix: reload.policy.branch.prefix,
        actionId: 'execute-next-sprint-task',
        policyDigest,
      });
      steps.push({
        step: 'authz_grant',
        ok: authz.valid,
        repo,
        hours,
        single_use: singleUse,
      });
    }
  } else if (authz.valid) {
    steps.push({ step: 'authz_grant', ok: true, skipped: true });
  }

  const plan = dryRun(projectRoot, { repo });
  steps.push({
    step: 'dry_run',
    ok: plan.would_effect,
    blockers: plan.blockers,
    next: plan.next,
    recommendation: plan.recommendation,
  });

  const ready = plan.would_effect;
  const tickRunner = reload.policy.runner?.default || 'fake';
  const nextCommands = ready
    ? [
        `node ${AUTOPILOT_REL} tick --runner=${tickRunner}`,
        'Optional loop: copy .harness/autonomy/workflows/autonomy-tick.yml → .github/workflows/',
      ]
    : [
        ...(plan.recommendation?.command ? [plan.recommendation.command] : []),
        `node ${AUTOPILOT_REL} dry-run`,
      ];

  return {
    ok: ready,
    status: ready ? 'ready' : 'blocked',
    steps,
    policy_digest: policyDigest,
    repo,
    dry_run: plan,
    recommendation: plan.recommendation,
    next_commands: nextCommands,
    message: ready
      ? 'Autonomy is configured. Run tick manually or via CI — not from chat.'
      : plan.recommendation?.why || 'Setup ran but dry-run is not ready. Resolve blockers above.',
  };
}
