// install-diagnose.mjs — read-only: what Midas install state is this directory in, and the single next step.
// Used by: create-midas --diagnose (pre/post install) and template/scripts/install-diagnose.mjs in projects.
//
// Context helpers live in cli/lib/core/context.mjs (installer package) and are mirrored to
// .harness/scripts/install-context.mjs on product installs (see scripts/build-create.mjs).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const contextPath = existsSync(join(HERE, 'lib', 'core', 'context.mjs'))
  ? join(HERE, 'lib', 'core', 'context.mjs')
  : join(HERE, 'install-context.mjs');
const installCmdPath = existsSync(join(HERE, 'lib', 'core', 'install-cmd.mjs'))
  ? join(HERE, 'lib', 'core', 'install-cmd.mjs')
  : join(HERE, 'lib', 'install-cmd.mjs');
const {
  detectContext,
  hasMidasInstall,
  findAncestorMidasRoot,
  yamlScalar,
  isV1Install,
  isMidasEngineRepository,
  V1_REFUSE_MESSAGE,
} = await import(pathToFileURL(contextPath).href);
const {
  formatInstallCmd,
  formatUpdateCmd,
} = await import(pathToFileURL(installCmdPath).href);

export { hasMidasInstall, findAncestorMidasRoot, yamlScalar };

/**
 * Optional autopilot hint when the project is in Phase 7 without a ready capability.
 * @param {string} dir
 * @param {string|null} stateRaw
 */
export function autonomyDiagnoseHint(dir, stateRaw) {
  const stage = yamlScalar(stateRaw, 'stage');
  if (stage !== 'sprint_execution') return null;
  const capability = join(dir, '.harness', 'autonomy', 'bin', 'midas-autopilot.mjs');
  if (!existsSync(capability)) {
    return 'Optional bounded sprint ticks: reinstall with --autonomy, then /midas-auto-pilot setup (or `midas-autopilot setup`).';
  }
  const policyPath = join(dir, '.harness', 'autonomy', 'policy.yaml');
  if (!existsSync(policyPath)) return null;
  try {
    const policy = readFileSync(policyPath, 'utf8');
    if (/^enabled:\s*false/m.test(policy) || /^mode:\s*disabled/m.test(policy)) {
      return 'Autonomy installed but disabled — run `node .harness/autonomy/bin/midas-autopilot.mjs setup` or `/midas-auto-pilot setup`.';
    }
  } catch {
    return null;
  }
  return null;
}

/** Fallback when caller does not pass installCmd (prefer bundledVersion from create-midas). */
function defaultInstallCmd(bundledVersion) {
  return formatInstallCmd({ version: bundledVersion || null, tools: 'cursor' });
}

/**
 * @param {string} targetDir
 * @param {{ bundledVersion?: string, installCmd?: string }} [opts]
 */
export function diagnoseProject(targetDir, opts = {}) {
  const ctx = detectContext(targetDir);
  const dir = ctx.dir;
  const installCmd = opts.installCmd || defaultInstallCmd(opts.bundledVersion);
  const ancestor = ctx.ancestorRoot;
  const hasEngine = existsSync(join(dir, '.harness', 'engine', 'VERSION'));
  const hasProduct = existsSync(join(dir, '.harness', 'product'));
  const hasState = existsSync(join(dir, '.harness', 'state.yaml'));
  const activeRun = existsSync(join(dir, '.harness', 'cache', 'installer', 'active.json'));

  // Broken mid-migrate / failed verify+bad rollback trees (pre-2.9.8 SinFalta-shape).
  if (!hasEngine && (hasProduct || hasState)) {
    const updateCmd = formatUpdateCmd({ version: opts.bundledVersion || null });
    return {
      status: 'partial_migrate',
      dir,
      summary: 'Partial harness migrate detected (.harness/product or state without .harness/engine).',
      nextCli: activeRun
        ? `${updateCmd} --rollback --yes`
        : null,
      nextSlash: '/midas-init',
      detail:
        (activeRun
          ? `Installer journal still active — prefer \`${updateCmd} --rollback --yes\` to restore the pre-migrate tree, then re-run a pinned \`update\`.\n\n`
          : `No usable installer journal — restore classic/harness files with \`git restore\` / checkout, then re-run \`${updateCmd} --yes\`.\n\n`) +
        'Do not treat this as a fresh install unless you intend to discard the leftover `.harness/product` tree.',
    };
  }

  if (!ctx.installed) {
    if (ancestor) {
      return {
        status: 'nested_or_wrong_cwd',
        dir,
        ancestor,
        summary: 'This folder has no Midas install, but a parent directory does.',
        nextCli: null,
        nextSlash: '/midas-status',
        detail:
          `Midas is installed at:\n  ${ancestor}\n\n` +
          'Run slash commands from that project root, or install Midas here only if you intend a nested project (--force).',
      };
    }
    return {
      status: 'not_installed',
      dir,
      summary: 'No Midas install detected.',
      nextCli: installCmd,
      nextSlash: '/midas-init',
      detail:
        'Do not use `update` on a fresh project. Install first, then run /midas-init once in your editor.',
    };
  }

  if (isV1Install(dir) || (ctx.layout && ctx.layout !== 'harness' && !isMidasEngineRepository(dir))) {
    return {
      status: 'unsupported_v1',
      dir,
      summary: 'A Midas 1.x classic/compact/hub layout was detected; 3.x refuses to write.',
      nextCli: 'npx create-midas@2.10.3 update --yes',
      nextSlash: '/midas-reconcile',
      detail: V1_REFUSE_MESSAGE,
    };
  }

  if (activeRun && hasEngine) {
    const updateCmd = formatUpdateCmd({ version: opts.bundledVersion || null });
    return {
      status: 'installer_incomplete',
      dir,
      summary: 'An installer run is still active (active.json). Resume or roll back before other work.',
      nextCli: `${updateCmd} --resume`,
      nextSlash: '/midas-init',
      detail:
        `Installer journal is still active under .harness/cache/installer/. ` +
        `Resume with \`${updateCmd} --resume\` (verify-only if apply already finished) ` +
        `or undo with \`${updateCmd} --rollback\`. Do not start a new update until that run is cleared.`,
    };
  }

  const setupComplete = ctx.setupComplete;
  const midasVersion = ctx.midasVersion;
  const mode = ctx.mode || 'greenfield';
  const engineVersion = ctx.engineVersion;
  const scriptsDir = ctx.scriptsDir;

  if (!setupComplete) {
    return {
      status: 'setup_pending',
      dir,
      midasVersion,
      engineVersion,
      mode,
      summary: 'Midas is installed but one-time setup is not complete (setup_complete ≠ true).',
      nextCli: null,
      nextSlash: '/midas-init',
      detail:
        mode === 'brownfield'
          ? '/midas-init runs setup (may route to /midas-adopt for existing code).'
          : '/midas-init runs one-time setup — classifies maturity and places the project.',
    };
  }

  if (engineVersion && midasVersion && midasVersion !== engineVersion) {
    return {
      status: 'version_behind',
      dir,
      midasVersion,
      engineVersion,
      summary: `Engine on disk is ${engineVersion} but state.yaml records midas_version ${midasVersion}.`,
      nextCli: formatUpdateCmd({ version: engineVersion }),
      nextSlash: '/midas-init',
      detail:
        'Pick one (not both): `npx ... update` (full refresh — done when verify ok) or `/midas-init` (interactive tip that points at the same refresh).',
    };
  }

  return {
    status: 'ready',
    dir,
    midasVersion: midasVersion || engineVersion,
    engineVersion,
    mode,
    summary: 'Midas is installed and setup_complete.',
    nextCli: scriptsDir ? `node ${scriptsDir}/doctor.mjs --strict` : null,
    nextSlash: '/midas-status',
    detail:
      'Use /midas-status for phase and next ritual. /midas-reconcile re-runs this check anytime.' +
      (() => {
        const hint = autonomyDiagnoseHint(dir, ctx.stateRaw);
        return hint ? `\n\nAutonomy: ${hint}` : '';
      })(),
  };
}

/** @param {ReturnType<typeof diagnoseProject>} result */
export function formatDiagnosis(result) {
  const lines = [
    `Midas diagnose — ${result.dir}`,
    '',
    `Status: ${result.status}`,
    result.summary,
    '',
  ];
  if (result.midasVersion || result.engineVersion) {
    lines.push(
      `Versions: state ${result.midasVersion ?? '—'} · engine ${result.engineVersion ?? '—'}`,
      '',
    );
  }
  if (result.nextCli) {
    lines.push('Next (terminal):');
    lines.push(`  ${result.nextCli}`);
    lines.push('');
  }
  if (result.nextSlash) {
    lines.push('Next (editor slash command):');
    lines.push(`  ${result.nextSlash}`);
    lines.push('');
  }
  if (result.detail) lines.push(result.detail);
  return lines.join('\n');
}

/** CLI entry when run directly */
export function runDiagnoseCli(targetDir = '.', opts = {}) {
  const result = diagnoseProject(targetDir, opts);
  console.log(formatDiagnosis(result));
  return result.status === 'ready' ? 0 : 1;
}

const isMain = (() => {
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '');
  } catch {
    return false;
  }
})();

if (isMain) {
  const target = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : '.';
  process.exit(runDiagnoseCli(target));
}
