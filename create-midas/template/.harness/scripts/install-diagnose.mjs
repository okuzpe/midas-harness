// install-diagnose.mjs — read-only: what Midas install state is this directory in, and the single next step.
// Used by: create-midas --diagnose (pre/post install) and template/scripts/install-diagnose.mjs in projects.
//
// Context helpers live in create-midas/lib/core/context.mjs (installer package) and are mirrored to
// .harness/scripts/install-context.mjs on product installs (see scripts/build-create.mjs).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const contextPath = existsSync(join(HERE, 'lib', 'core', 'context.mjs'))
  ? join(HERE, 'lib', 'core', 'context.mjs')
  : join(HERE, 'install-context.mjs');
const {
  detectContext,
  hasMidasInstall,
  findAncestorMidasRoot,
  yamlScalar,
} = await import(pathToFileURL(contextPath).href);

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
    return 'Optional bounded autopilot: reinstall with --autonomy, then /midas-autopilot (or `midas-autopilot setup`).';
  }
  const policyPath = join(dir, '.harness', 'autonomy', 'policy.yaml');
  if (!existsSync(policyPath)) return null;
  try {
    const policy = readFileSync(policyPath, 'utf8');
    if (/^enabled:\s*false/m.test(policy) || /^mode:\s*disabled/m.test(policy)) {
      return 'Autonomy installed but disabled — run `node .harness/autonomy/bin/midas-autopilot.mjs setup` or `/midas-autopilot`.';
    }
  } catch {
    return null;
  }
  return null;
}

/** Fallback when caller does not pass installCmd (prefer reading bundled VERSION in create-midas). */
const DEFAULT_INSTALL_CMD = 'npx github:okuzpe/midas-harness --tools=cursor';

/**
 * @param {string} installCmd
 * @param {'migrate' | 'update'} mode
 */
function relatedCli(installCmd, mode) {
  const base = installCmd.replace(/\s+--tools=\S+/g, '').trim();
  if (mode === 'migrate') return `${base} --migrate`;
  return `${base} --update`;
}

/**
 * @param {string} targetDir
 * @param {{ bundledVersion?: string, installCmd?: string }} [opts]
 */
export function diagnoseProject(targetDir, opts = {}) {
  const ctx = detectContext(targetDir);
  const dir = ctx.dir;
  const installCmd = opts.installCmd || DEFAULT_INSTALL_CMD;
  const ancestor = ctx.ancestorRoot;

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
        'Do not use --update on a fresh project. Install first, then run /midas-init once in your editor.',
    };
  }

  if (ctx.layout !== 'harness') {
    return {
      status: 'legacy_layout',
      dir,
      summary: 'A Midas 1.x classic/compact/hub layout was detected; update will not move it.',
      nextCli: relatedCli(installCmd, 'migrate'),
      nextSlash: '/midas-reconcile',
      detail: 'Review the read-only plan, then repeat with --migrate --apply to migrate transactionally.',
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
          ? '/midas-init will scan the repo and may route to /midas-adopt for existing code.'
          : '/midas-init classifies maturity and places the project at the right phase.',
    };
  }

  if (engineVersion && midasVersion && midasVersion !== engineVersion) {
    const pin = engineVersion ? `#v${engineVersion}` : '';
    return {
      status: 'version_behind',
      dir,
      midasVersion,
      engineVersion,
      summary: `Engine on disk is ${engineVersion} but state.yaml records midas_version ${midasVersion}.`,
      nextCli: `npx github:okuzpe/midas-harness${pin} --update`,
      nextSlash: '/midas-update',
      detail:
        'Pick one (not both): `npx ... --update` (full refresh — done when verify ok) or `/midas-update` (interactive confirm that runs the same refresh).',
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
