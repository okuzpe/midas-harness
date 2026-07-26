// install-diagnose.mjs — read-only: what Midas install state is this directory in, and the single next step.
// Used by: create-midas --diagnose (pre/post install) and template/scripts/install-diagnose.mjs in projects.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_INSTALL_CMD = 'npx github:okuzpe/midas-harness#v1.1.3 --tools=cursor';

function stripYamlComment(value) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '#' && !inSingle && !inDouble) {
      const prev = i === 0 ? ' ' : value[i - 1];
      if (/\s/.test(prev)) return value.slice(0, i).trim();
    }
  }
  return value.trim();
}

/** @param {string|null|undefined} raw @param {string} key */
export function yamlScalar(raw, key) {
  if (!raw) return null;
  const m = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!m) return null;
  return stripYamlComment(m[1]).replace(/^["']|["']$/g, '');
}

/** @param {string} dir */
export function hasMidasInstall(dir) {
  return (
    existsSync(join(dir, 'harness', 'VERSION')) ||
    existsSync(join(dir, 'harness', 'state.yaml')) ||
    existsSync(join(dir, '.midas', 'engine', 'VERSION')) ||
    existsSync(join(dir, '.midas', 'state.yaml'))
  );
}

/** @param {string} startDir */
export function findAncestorMidasRoot(startDir) {
  let dir = dirname(startDir);
  for (;;) {
    if (hasMidasInstall(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readMaybe(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

/** @param {string} dir */
function resolveStatePath(dir) {
  const hub = join(dir, '.midas', 'state.yaml');
  if (existsSync(hub)) return hub;
  const classic = join(dir, 'harness', 'state.yaml');
  if (existsSync(classic)) return classic;
  return null;
}

/** @param {string} dir */
function resolveEngineVersionPath(dir) {
  const hub = join(dir, '.midas', 'engine', 'VERSION');
  if (existsSync(hub)) return hub;
  const classic = join(dir, 'harness', 'VERSION');
  if (existsSync(classic)) return classic;
  return null;
}

/** @param {string} dir */
function resolveScriptsDir(dir) {
  if (existsSync(join(dir, '.midas', 'scripts', 'paths.mjs'))) return '.midas/scripts';
  if (existsSync(join(dir, 'scripts', 'paths.mjs'))) return 'scripts';
  return null;
}

/**
 * @param {string} targetDir
 * @param {{ bundledVersion?: string, installCmd?: string }} [opts]
 */
export function diagnoseProject(targetDir, opts = {}) {
  const dir = resolve(targetDir);
  const installCmd = opts.installCmd || DEFAULT_INSTALL_CMD;
  const ancestor = findAncestorMidasRoot(dir);

  if (!hasMidasInstall(dir)) {
    if (ancestor && ancestor !== dir) {
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
      summary: 'No Midas install detected (no harness/ or .midas/ engine stamp).',
      nextCli: installCmd,
      nextSlash: '/midas-init',
      detail:
        'Do not use --update on a fresh project. Install first, then run /midas-init once in your editor.',
    };
  }

  const statePath = resolveStatePath(dir);
  const stateRaw = statePath ? readMaybe(statePath) : null;
  const setupComplete = yamlScalar(stateRaw, 'setup_complete') === 'true';
  const midasVersion = yamlScalar(stateRaw, 'midas_version');
  const mode = yamlScalar(stateRaw, 'mode') || 'greenfield';

  const versionPath = resolveEngineVersionPath(dir);
  const engineVersion = (versionPath ? readMaybe(versionPath) : null)?.trim() || null;
  const scriptsDir = resolveScriptsDir(dir);

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
      detail: 'Refresh the engine (--update) or run /midas-update for a diff-confirmed migration.',
    };
  }

  return {
    status: 'ready',
    dir,
    midasVersion: midasVersion || engineVersion,
    engineVersion,
    mode,
    summary: 'Midas is installed and setup_complete.',
    nextCli: scriptsDir ? `node ${scriptsDir}/doctor.mjs` : null,
    nextSlash: '/midas-status',
    detail: 'Use /midas-status for phase and next ritual. /midas-reconcile re-runs this check anytime.',
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
