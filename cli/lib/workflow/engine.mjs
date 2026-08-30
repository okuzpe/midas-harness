// engine.mjs — lifecycle runner: requirements → checks → plan → confirm → execute → verify.

import { resolve } from 'node:path';
import { detectContext, hasMidasInstall, detectLegacyLayout, isMidasEngineRepository, isV1Install, V1_REFUSE_MESSAGE } from '../core/context.mjs';
import { createPlan } from '../core/plan.mjs';
import { readOwnershipManifest } from '../core/conflicts.mjs';
import { planTemplateCopy } from '../steps/plan-tree.mjs';
import { runDiagnoseStep } from '../steps/diagnose.mjs';
import { runUpdateCheck } from '../steps/update-check.mjs';
import {
  compareInstalledToChannel,
  fetchReleaseManifest,
  resolveChannel,
  verifyTemplateAgainstManifest,
} from '../core/release-channel.mjs';
import { planUninstall } from '../steps/uninstall.mjs';
import { confirm, isInteractive } from '../prompt.mjs';
import { emitPhase, emitResult, buildResultEnvelope } from '../report/render.mjs';
import { gatherRequirements, gatherChecks } from './gather-checks.mjs';

/**
 * `update` refreshes a v2 product install. 1.x classic/compact/hub trees and `--migrate` refuse
 * with zero writes (pin create-midas@2.10.x, migrate there, then upgrade).
 * @param {import('../cli/args.mjs').InstallCommand} cmd
 * @param {string} targetDir
 */
export function resolveRefreshCommand(cmd, targetDir) {
  if (cmd.command === 'migrate' || (cmd.command === 'update' && isV1Install(targetDir))) {
    return { cmd, refuseV1: true, promoted: false, fromLayout: detectLegacyLayout(targetDir) };
  }
  if (cmd.command !== 'update') return { cmd, promoted: false, fromLayout: null, refuseV1: false };
  const legacy = detectLegacyLayout(targetDir);
  if (legacy && legacy !== 'harness' && legacy !== 'conflict' && !isMidasEngineRepository(targetDir)) {
    return { cmd, refuseV1: true, promoted: false, fromLayout: legacy };
  }
  return { cmd, promoted: false, fromLayout: legacy, refuseV1: false };
}

export async function runInstaller(cmd, deps) {
  const target = resolve(process.cwd(), cmd.target);
  const json = !!cmd.json;
  const color = !json;

  if (cmd.command === 'diagnose') {
    emitPhase('requirements', { json, color, status: 'active' });
    const step = runDiagnoseStep({ target, installCmd: deps.installCmd, bundledVersion: deps.bundledVersion, json });
    emitPhase('complete', { json, color, status: step.ok ? 'done' : 'failed' });
    if (json) emitResult(step.envelope, { json: true });
    else console.log(step.envelope.message);
    return step.exitCode;
  }

  if (cmd.command === 'update' && cmd.check) {
    // No phase chrome: `--check` is a one-line probe meant to be read by a human at a glance or
    // branched on by CI, and a half-drawn 7-phase progress bar reads like a failed install.
    const result = await runUpdateCheck(target, cmd);
    if (json) {
      emitResult(
        buildResultEnvelope({
          ok: result.exitCode === 0,
          mode: 'update-check',
          target,
          phase: 'complete',
          plan: createPlan({ mode: 'update-check', target, ops: [], requirements: [], checks: [] }),
          dryRun: true,
          message: result.message,
        }),
        { json: true },
      );
    } else {
      console.log(result.message);
    }
    return result.exitCode;
  }

  const resolved = resolveRefreshCommand(cmd, target);
  cmd = resolved.cmd;
  if (resolved.refuseV1) {
    const message = V1_REFUSE_MESSAGE;
    if (json) {
      emitResult(
        buildResultEnvelope({
          ok: false,
          mode: cmd.command,
          target,
          phase: 'checks',
          plan: createPlan({ mode: cmd.command, target, ops: [], requirements: [], checks: [] }),
          error: new Error(message),
          message,
        }),
        { json: true },
      );
    } else {
      console.error(`create-midas: ${message}`);
    }
    return 1;
  }

  const ctx = detectContext(target);
  const mode = cmd.command;

  // --- requirements ---
  emitPhase('requirements', { json, color, status: 'active' });
  const requirements = gatherRequirements(cmd, ctx, deps);
  emitPhase('requirements', { json, color, status: requirements.every((r) => r.ok) ? 'done' : 'failed' });

  // --- checks ---
  emitPhase('checks', { json, color, status: 'active' });
  // Only reach for the network once the run is otherwise viable: an update against a directory that
  // holds no install is already doomed, and a fetch we then abandon leaves a socket open that trips
  // a libuv assertion when the CLI exits.
  const channelStatus =
    cmd.command === 'update' && requirements.every((r) => r.ok)
      ? await resolveChannelStatus(target, cmd, deps)
      : null;
  const checks = gatherChecks(cmd, ctx, deps, channelStatus);
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

  // Dry-run: show plan, write nothing (uninstall dry-run still lists via execute).
  const previewOnly = cmd.dryRun;

  if (previewOnly && mode !== 'uninstall') {
    const envelope = buildResultEnvelope({
      ok: true,
      mode,
      target,
      phase: 'complete',
      plan,
      dryRun: true,
    });
    emitResult(envelope, { json });
    return 0;
  }

  // --- confirm ---
  emitPhase('confirm', { json, color, status: 'active' });
  const needsConfirm = isInteractive() &&
    !cmd.dryRun &&
    (mode === 'update' || mode === 'uninstall');
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
      channelStatus,
    });
    emitPhase('execute', { json, color, status: result.ok ? 'done' : 'failed' });
    if (result.ok) {
      emitPhase('verify', { json, color, status: 'done' });
      emitPhase('complete', { json, color, status: 'done' });
    } else {
      emitPhase('verify', { json, color, status: 'failed' });
    }

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


/**
 * Resolve the release channel and compare it to the install. Advisory only: `edge` is published
 * asynchronously after CI, so a bundle fetched between the push and the publish would legitimately
 * mismatch — blocking on that would be a false positive.
 */
async function resolveChannelStatus(target, cmd, deps) {
  const installedManifest = readOwnershipManifest(target);
  const channel = resolveChannel({ flag: cmd.channel, installedManifest });
  // Nothing recorded locally means nothing to compare a published hash against.
  if (!installedManifest) {
    return {
      channel,
      fetched: { manifest: null, source: 'none', error: 'no installed manifest to compare' },
      comparison: compareInstalledToChannel(null, null),
      integrity: { ok: null, reason: 'no channel manifest to verify against' },
    };
  }
  const fetched = await fetchReleaseManifest(target, channel, {
    offline: cmd.offline,
    manifestFile: cmd.manifestFile,
  });
  return {
    channel,
    fetched,
    comparison: compareInstalledToChannel(installedManifest, fetched.manifest),
    integrity: deps.template && fetched.manifest
      ? verifyTemplateAgainstManifest(deps.template, fetched.manifest)
      : { ok: null, reason: 'no channel manifest to verify against' },
  };
}


export { hasMidasInstall, detectContext, isMidasEngineRepository };
