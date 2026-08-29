// engine.mjs — lifecycle runner: requirements → checks → plan → confirm → execute → verify.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { detectContext, compareVersions, hasMidasInstall, detectLegacyLayout, isMidasEngineRepository, yamlScalar } from '../core/context.mjs';
import { formatUpdateCmd } from '../core/install-cmd.mjs';
import { createPlan } from '../core/plan.mjs';
import { assessUpdateConflicts, readOwnershipManifest } from '../core/conflicts.mjs';
import { planTemplateCopy } from '../steps/plan-tree.mjs';
import { runDiagnoseStep } from '../steps/diagnose.mjs';
import { runUpdateCheck } from '../steps/update-check.mjs';
import {
  compareInstalledToChannel,
  fetchReleaseManifest,
  resolveChannel,
  verifyTemplateAgainstManifest,
} from '../core/release-channel.mjs';
import { planMigrate } from '../steps/migrate.mjs';
import { planUninstall } from '../steps/uninstall.mjs';
import { confirm, isInteractive } from '../prompt.mjs';
import { emitPhase, emitResult, buildResultEnvelope } from '../report/render.mjs';
import { evaluateMcpGovernance } from '../../template/.harness/scripts/mcp-drift.mjs';

/**
 * `update` is the single refresh command: on a 1.x classic/compact/hub install it
 * promotes to migrate (+apply unless --dry-run). Explicit `--migrate` stays available.
 * @param {import('../cli/args.mjs').InstallCommand} cmd
 * @param {string} targetDir
 */
export function resolveRefreshCommand(cmd, targetDir) {
  if (cmd.command !== 'update') return { cmd, promoted: false, fromLayout: null };
  const legacy = detectLegacyLayout(targetDir);
  if (!legacy || legacy === 'harness' || legacy === 'conflict') {
    return { cmd, promoted: false, fromLayout: legacy };
  }
  return {
    cmd: {
      ...cmd,
      command: 'migrate',
      // dry-run stays preview-only; otherwise apply (same as --migrate --apply)
      apply: !cmd.dryRun,
    },
    promoted: true,
    fromLayout: legacy,
  };
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
  if (resolved.promoted && !json) {
    const tip = cmd.dryRun
      ? `1.x ${resolved.fromLayout} layout — update --dry-run shows the migrate preview (no writes)`
      : `1.x ${resolved.fromLayout} layout — update will migrate to harness layout then refresh (same as --migrate --apply)`;
    console.error(`create-midas: ${tip}`);
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
      message: 'v2 writes only --layout=harness. Existing classic/compact/hub installs: use --update (auto-migrates) or --migrate --apply.',
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
        : `update found no existing Midas install in ${ctx.dir} — install first: ${deps.installCmd}`,
    });
    const legacy = detectLegacyLayout(ctx.dir);
    out.push({
      id: 'not-legacy',
      ok: !legacy || legacy === 'harness',
      message: (!legacy || legacy === 'harness')
        ? 'canonical harness layout'
        : `layout conflict or unexpected 1.x markers — resolve partial migration, then: ${deps.installCmd.replace(/ --tools=\S+/, '')} update --yes`,
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

  if (cmd.command === 'install' && ctx.installed && ctx.layout === 'harness' && ctx.engineVersion) {
    const behind = compareVersions(ctx.engineVersion, deps.bundledVersion) < 0;
    if (behind) {
      out.push({
        id: 'install-vs-update',
        ok: false,
        message:
          `existing install at engine v${ctx.engineVersion}; use ${formatUpdateCmd({ version: deps.bundledVersion })} instead of a fresh install`,
      });
    }
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

function gatherChecks(cmd, ctx, deps, channelStatus = null) {
  const out = [];
  out.push({
    id: 'template',
    ok: true,
    message: `bundled template v${deps.bundledVersion}`,
  });

  if (cmd.command === 'update' || cmd.command === 'migrate') {
    const dirty = spawnSync('git', ['status', '--porcelain'], {
      cwd: ctx.dir,
      encoding: 'utf8',
    });
    if (dirty.status === 0 && (dirty.stdout || '').trim()) {
      const lines = (dirty.stdout || '').trim().split(/\r?\n/).length;
      out.push({
        id: 'git-dirty',
        ok: true,
        message: `working tree has ${lines} dirty path(s) — commit or stash before migrate/update if you need a clean restore point (not blocking)`,
      });
    }
  }

  if (cmd.command === 'migrate') {
    const layout = detectLegacyLayout(ctx.dir);
    if (layout === 'conflict') {
      out.push({
        id: 'layout-conflict',
        ok: false,
        message:
          'layout markers conflict (classic/hub and .harness coexist) — resolve manually or restore from git before migrate',
      });
    } else {
      out.push({
        id: 'layout',
        ok: true,
        message: layout ? `will migrate ${layout} → harness` : 'no legacy layout markers',
      });
    }

    const stateRaw = ctx.stateRaw || '';
    const hasGov = !!yamlScalar(stateRaw, 'mcp_governance');
    let mcpPath = join(ctx.dir, '.mcp.json');
    if (existsSync(mcpPath)) {
      try {
        const gov = evaluateMcpGovernance(readFileSync(mcpPath, 'utf8'));
        const shadows = gov.shadowServers || [];
        if (shadows.length && !hasGov) {
          out.push({
            id: 'mcp-self-managed',
            ok: true,
            message:
              `shadow MCP(s) ${shadows.join(', ')} — will set mcp_governance: self_managed on apply ` +
              `(switch to runlayer after moving servers to Runlayer-managed URLs)`,
          });
        } else if (shadows.length && hasGov) {
          out.push({
            id: 'mcp-governance',
            ok: true,
            message: `mcp_governance=${yamlScalar(stateRaw, 'mcp_governance')} with shadow MCP(s): ${shadows.join(', ')}`,
          });
        }
      } catch {
        out.push({
          id: 'mcp-json',
          ok: true,
          message: '.mcp.json present but not valid JSON — doctor will report after apply',
        });
      }
    }
  }

  if (cmd.command === 'update') {
    const assessment = assessUpdateConflicts(ctx.dir);
    out.push({
      id: 'manifest',
      ok: !!assessment.manifest,
      message: assessment.manifest
        ? `manifest midas_version=${assessment.manifest.midas_version}`
        : 'canonical install has no valid .harness/manifest.json — run --migrate for a legacy layout, or repair the manifest before updating',
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
      // Vendor and generated files are engine-owned: the bundle wins and the local version is
      // copied to .harness/conflicts/ before the overwrite. Report, do not block.
      out.push({
        id: 'vendor-conflicts',
        ok: true,
        message: assessment.vendorConflicts.length === 0
          ? 'no vendor conflicts'
          : `${assessment.vendorConflicts.length} locally-modified vendor file(s) will be overwritten` +
            ' (local versions saved to .harness/conflicts/) — project overrides belong in .harness/rules',
      });
      out.push({
        id: 'mirror-conflicts',
        ok: true,
        message: assessment.mirrorConflicts.length === 0
          ? 'no generated-mirror conflicts'
          : `${assessment.mirrorConflicts.length} modified generated mirror(s) will be regenerated: ${assessment.mirrorConflicts.join(', ')}`,
      });
    }
    if (channelStatus) {
      out.push({
        id: 'channel',
        ok: true,
        message: channelStatus.fetched.manifest
          ? `channel ${channelStatus.channel} (${channelStatus.fetched.source}) — ${channelStatus.comparison.reason}`
          : `channel ${channelStatus.channel} unavailable — ${channelStatus.fetched.error || 'no manifest'}; refreshing from the bundle`,
      });
      if (channelStatus.integrity.ok === false) {
        const stableMismatch = channelStatus.channel === 'stable';
        out.push({
          id: 'bundle-integrity',
          ok: !stableMismatch,
          message: stableMismatch
            ? `${channelStatus.integrity.reason} — this bundle is not the published stable release`
            : `${channelStatus.integrity.reason} — expected on unpinned main, edge, or a local build`,
        });
      }
    }
  }

  return out;
}

export { hasMidasInstall, detectContext, isMidasEngineRepository };
