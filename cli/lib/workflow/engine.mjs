// engine.mjs — lifecycle runner: requirements → checks → plan → confirm → execute → verify.

import { resolve } from 'node:path';
import { detectContext, compareVersions, hasMidasInstall, detectLegacyLayout, isMidasEngineRepository } from '../core/context.mjs';
import { createPlan } from '../core/plan.mjs';
import { assessUpdateConflicts } from '../core/conflicts.mjs';
import { planTemplateCopy } from '../steps/plan-tree.mjs';
import { runDiagnoseStep } from '../steps/diagnose.mjs';
import { planMigrate } from '../steps/migrate.mjs';
import { planUninstall } from '../steps/uninstall.mjs';
import { confirm, isInteractive } from '../prompt.mjs';
import { emitPhase, emitResult, buildResultEnvelope } from '../report/render.mjs';

/**
 * @param {import('../cli/args.mjs').InstallCommand} cmd
 * @param {{
 *   template: string,
 *   bundledVersion: string,
 *   installCmd: string,
 *   execute: (cmd: import('../cli/args.mjs').InstallCommand, hooks: object) => Promise<{
 *     ok: boolean,
 *     message?: string,
 *     verify?: object,
 *     written?: string[],
 *     skipped?: string[],
 *     error?: Error,
 *   }>,
 * }} deps
 */
export async function runInstaller(cmd, deps) {
  const target = resolve(process.cwd(), cmd.target);
  const json = !!cmd.json;
  const color = !json;

  if (cmd.command === 'diagnose') {
    emitPhase('requirements', { json, color, status: 'active' });
    const step = runDiagnoseStep({ target, installCmd: deps.installCmd, json });
    emitPhase('complete', { json, color, status: step.ok ? 'done' : 'failed' });
    if (json) emitResult(step.envelope, { json: true });
    else console.log(step.envelope.message);
    return step.exitCode;
  }

  const ctx = detectContext(target);
  const mode = cmd.command;

  // --- requirements ---
  emitPhase('requirements', { json, color, status: 'active' });
  const requirements = gatherRequirements(cmd, ctx, deps);
  emitPhase('requirements', { json, color, status: requirements.every((r) => r.ok) ? 'done' : 'failed' });

  // --- checks ---
  emitPhase('checks', { json, color, status: 'active' });
  const checks = gatherChecks(cmd, ctx, deps);
  emitPhase('checks', { json, color, status: checks.every((c) => c.ok) ? 'done' : 'failed' });

  const failing = [...requirements, ...checks].filter((x) => !x.ok);
  if (failing.length) {
    const envelope = buildResultEnvelope({
      ok: false,
      mode,
      target,
      phase: 'checks',
      plan: createPlan({ mode, target, requirements, checks, ops: [] }),
      error: new Error(failing.map((f) => f.message).join('; ')),
      message: failing.map((f) => `create-midas: ${f.message}`).join('\n'),
    });
    if (json) emitResult(envelope, { json: true });
    else {
      for (const f of failing) console.error(`create-midas: ${f.message}`);
    }
    return 1;
  }

  // --- plan ---
  emitPhase('plan', { json, color, status: 'active' });
  const plan = buildPlan(cmd, ctx, deps, target, requirements, checks);
  emitPhase('plan', { json, color, status: 'done' });

  // Dry-run / migrate preview: show plan, write nothing (uninstall dry-run still lists via execute).
  const previewOnly =
    cmd.dryRun ||
    (mode === 'migrate' && !cmd.apply);

  if (previewOnly && mode !== 'uninstall') {
    if (mode === 'migrate' && typeof deps.formatMigrationPlan === 'function' && !json) {
      try {
        const mig = deps.planMigration?.(target);
        if (mig) console.log(deps.formatMigrationPlan(mig));
      } catch {
        // requirements already cover missing/conflict layouts
      }
    }
    const envelope = buildResultEnvelope({
      ok: true,
      mode: mode === 'migrate' && !cmd.apply ? 'migrate-preview' : mode,
      target,
      phase: 'complete',
      plan,
      dryRun: true,
      message: mode === 'migrate' && !cmd.apply
        ? 'migrate preview — pass --apply to write'
        : undefined,
    });
    emitResult(envelope, { json });
    return 0;
  }

  // --- confirm ---
  emitPhase('confirm', { json, color, status: 'active' });
  const needsConfirm = isInteractive() &&
    !cmd.dryRun &&
    (mode === 'update' || (mode === 'migrate' && cmd.apply) || mode === 'uninstall');
  if (needsConfirm && !cmd.yes) {
    const summary = `${mode} ${plan.ops.length} op(s) in ${target}`;
    const ok = await confirm(`Proceed with ${summary}?`, { defaultYes: mode !== 'uninstall' });
    if (!ok) {
      emitPhase('confirm', { json, color, status: 'failed' });
      const envelope = buildResultEnvelope({
        ok: false,
        mode,
        target,
        phase: 'confirm',
        plan,
        error: new Error('cancelled'),
        message: 'create-midas: cancelled.',
        outcome: 'CANCELLED',
        exit_code: 130,
      });
      emitResult(envelope, { json });
      return 130;
    }
  }
  emitPhase('confirm', { json, color, status: 'done' });

  // --- execute + verify (delegated) ---
  emitPhase('execute', { json, color, status: 'active' });
  try {
    const result = await deps.execute(cmd, {
      target,
      emitPhase: (phase, status) => emitPhase(phase, { json, color, status }),
      plan,
      checks,
      needsRebaseline: checks.some((c) => c.id === 'vendor-stale' && c.ok && /rebaseline/.test(c.message)),
    });
    emitPhase('execute', { json, color, status: result.ok ? 'done' : 'failed' });
    if (result.ok) emitPhase('verify', { json, color, status: 'done' });
    else emitPhase('verify', { json, color, status: 'failed' });

    const envelope = buildResultEnvelope({
      ok: result.ok,
      mode,
      target,
      phase: result.ok ? 'complete' : 'failed',
      plan,
      verify: result.verify,
      written: result.written,
      skipped: result.skipped,
      error: result.error,
      message: result.message,
      dryRun: !!cmd.dryRun,
      outcome: result.outcome || (result.ok ? 'COMPLETED' : 'FAILED_FATAL'),
      exit_code: result.exitCode ?? (result.ok ? 0 : 1),
    });
    if (json) emitResult(envelope, { json: true });
    // Non-json: execute() prints human success/failure when it owns the report.
    return result.exitCode ?? (result.ok ? 0 : 1);
  } catch (err) {
    emitPhase('execute', { json, color, status: 'failed' });
    const envelope = buildResultEnvelope({
      ok: false,
      mode,
      target,
      phase: 'failed',
      plan,
      error: err,
      message: `create-midas: ${err.message || err}`,
    });
    if (json) emitResult(envelope, { json: true });
    else console.error(envelope.message);
    return 1;
  }
}

function buildPlan(cmd, ctx, deps, target, requirements, checks) {
  const mode = cmd.command;
  if (mode === 'uninstall') {
    return planUninstall({ target, purge: cmd.purge, requirements, checks });
  }
  if (mode === 'migrate') {
    return planMigrate({
      target,
      apply: cmd.apply,
      dryRun: cmd.dryRun,
      requirements,
      checks,
      planMigration: deps.planMigration,
    });
  }
  const plan = planTemplateCopy({
    template: deps.template,
    target,
    mode,
    force: cmd.force,
    update: mode === 'update',
    autonomy: cmd.autonomy,
  });
  plan.requirements = requirements;
  plan.checks = checks;
  return plan;
}

function gatherRequirements(cmd, ctx, deps) {
  const out = [];

  // Never nest a product install (`.harness/engine`) into the midas-harness engine repository.
  if (['install', 'update', 'migrate'].includes(cmd.command) && isMidasEngineRepository(ctx.dir)) {
    out.push({
      id: 'not-engine-repo',
      ok: false,
      message:
        'refusing to install/update/migrate into the midas-harness engine repository — ' +
        'edit harness/ (source) and ship via create-midas; do not nest .harness/engine here. ' +
        'Use a separate product directory or scripts/fixtures/ for install tests.',
    });
  }

  if (cmd.layout && cmd.layout !== 'harness') {
    out.push({
      id: 'layout',
      ok: false,
      message: 'v2 writes only --layout=harness. Existing classic/compact/hub installs must use --migrate first.',
    });
  } else {
    out.push({ id: 'layout', ok: true, message: 'layout=harness' });
  }

  if (cmd.command === 'update') {
    out.push({
      id: 'existing-install',
      ok: ctx.installed,
      message: ctx.installed
        ? 'existing install found'
        : `--update found no existing Midas install in ${ctx.dir}`,
    });
    const legacy = detectLegacyLayout(ctx.dir);
    out.push({
      id: 'not-legacy',
      ok: !legacy || legacy === 'harness',
      message: (!legacy || legacy === 'harness')
        ? 'canonical v2 layout'
        : `this is a Midas 1.x layout; --update never relocates files. Preview: ${deps.installCmd.replace(/ --tools=\S+/, '')} --migrate`,
    });
  }

  if (cmd.command === 'install' && !cmd.force) {
    out.push({
      id: 'not-nested',
      ok: !ctx.ancestorRoot,
      message: ctx.ancestorRoot
        ? `${ctx.dir} is already inside a Midas project (root: ${ctx.ancestorRoot}). Pass --force for a nested install.`
        : 'no ancestor install',
    });
  }

  if (cmd.command === 'migrate') {
    out.push({
      id: 'legacy-or-harness',
      ok: ctx.installed || !!detectLegacyLayout(ctx.dir),
      message: ctx.installed || detectLegacyLayout(ctx.dir)
        ? `layout=${ctx.layout || detectLegacyLayout(ctx.dir)}`
        : 'no Midas 1.x install found',
    });
  }

  return out;
}

function gatherChecks(cmd, ctx, deps) {
  const out = [];
  out.push({
    id: 'template',
    ok: true,
    message: `bundled template v${deps.bundledVersion}`,
  });

  if (cmd.command === 'update') {
    const assessment = assessUpdateConflicts(ctx.dir);
    out.push({
      id: 'manifest',
      ok: !!assessment.manifest,
      message: assessment.manifest
        ? `manifest midas_version=${assessment.manifest.midas_version}`
        : 'canonical install has no valid .harness/manifest.json — run --migrate for a v1 layout, or repair the manifest before updating',
    });
    if (assessment.manifest) {
      const isUpgrade = compareVersions(assessment.manifest.midas_version || '0.0.0', deps.bundledVersion) < 0;
      out.push({
        id: 'version',
        ok: true,
        message: isUpgrade
          ? `upgrade ${assessment.manifest.midas_version} → ${deps.bundledVersion}`
          : `refresh at ${deps.bundledVersion}`,
      });
      if (assessment.staleDrift) {
        out.push({
          id: 'vendor-stale',
          ok: true,
          message: 'stale manifest drift detected — will rebaseline on apply (not during dry-run)',
        });
      }
      out.push({
        id: 'vendor-conflicts',
        ok: assessment.vendorConflicts.length === 0,
        message: assessment.vendorConflicts.length === 0
          ? 'no vendor conflicts'
          : `vendor files were modified: ${assessment.vendorConflicts.join(', ')} — move project rules to .harness/rules and restore vendor files first`,
      });
      out.push({
        id: 'mirror-conflicts',
        ok: assessment.mirrorConflicts.length === 0,
        message: assessment.mirrorConflicts.length === 0
          ? 'no generated-mirror conflicts'
          : `generated mirrors were modified: ${assessment.mirrorConflicts.join(', ')} — move custom skills aside, then restore or regenerate`,
      });
    }
  }

  return out;
}

export { hasMidasInstall, detectContext, isMidasEngineRepository };
