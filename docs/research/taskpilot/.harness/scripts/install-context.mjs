// context.mjs — unified install/layout detection for diagnose, migrate, install, uninstall.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function readMaybe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

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
    existsSync(join(dir, '.harness', 'engine', 'VERSION')) ||
    existsSync(join(dir, '.harness', 'state.yaml')) ||
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

/**
 * Detect layout markers. Returns 'conflict' when canonical and legacy markers coexist,
 * null when nothing is installed.
 * @param {string} root
 * @returns {'harness'|'classic'|'compact'|'hub'|'conflict'|null}
 */
export function detectLegacyLayout(root) {
  const canonical = existsSync(join(root, '.harness', 'state.yaml')) ||
    existsSync(join(root, '.harness', 'engine', 'VERSION'));
  const midas = existsSync(join(root, '.midas', 'state.yaml')) ||
    existsSync(join(root, '.midas', 'engine', 'VERSION'));
  const classic = existsSync(join(root, 'harness', 'state.yaml')) ||
    existsSync(join(root, 'harness', 'VERSION'));
  const groups = [canonical, midas, classic].filter(Boolean).length;
  if (groups > 1) return 'conflict';
  if (canonical) return 'harness';
  if (classic) return 'classic';
  if (midas) {
    const raw = readMaybe(join(root, '.midas', 'state.yaml')) || '';
    if (/^layout:\s*hub\b/m.test(raw) || existsSync(join(root, '.midas', 'product'))) return 'hub';
    return 'compact';
  }
  return null;
}

/**
 * Uninstall-oriented layout detect (defaults to harness when unknown).
 * @param {string} dir
 */
export function detectInstallLayout(dir) {
  const layout = detectLegacyLayout(dir);
  if (layout === 'conflict' || layout == null) return 'harness';
  return layout;
}

function resolveStatePath(dir) {
  const canonical = join(dir, '.harness', 'state.yaml');
  if (existsSync(canonical)) return canonical;
  const hub = join(dir, '.midas', 'state.yaml');
  if (existsSync(hub)) return hub;
  const classic = join(dir, 'harness', 'state.yaml');
  if (existsSync(classic)) return classic;
  return null;
}

function resolveEngineVersionPath(dir) {
  const canonical = join(dir, '.harness', 'engine', 'VERSION');
  if (existsSync(canonical)) return canonical;
  const hub = join(dir, '.midas', 'engine', 'VERSION');
  if (existsSync(hub)) return hub;
  const classic = join(dir, 'harness', 'VERSION');
  if (existsSync(classic)) return classic;
  return null;
}

function resolveScriptsDir(dir) {
  if (existsSync(join(dir, '.harness', 'scripts', 'paths.mjs'))) return '.harness/scripts';
  if (existsSync(join(dir, '.midas', 'scripts', 'paths.mjs'))) return '.midas/scripts';
  if (existsSync(join(dir, 'scripts', 'paths.mjs'))) return 'scripts';
  return null;
}

/**
 * Single read-only install context for all installer modes.
 * @param {string} targetDir
 */
export function detectContext(targetDir) {
  const dir = resolve(targetDir);
  const layout = detectLegacyLayout(dir);
  const installed = hasMidasInstall(dir);
  const ancestorRoot = findAncestorMidasRoot(dir);
  const statePath = resolveStatePath(dir);
  const stateRaw = statePath ? readMaybe(statePath) : null;
  const versionPath = resolveEngineVersionPath(dir);
  const engineVersion = (versionPath ? readMaybe(versionPath) : null)?.trim() || null;
  const midasVersion = yamlScalar(stateRaw, 'midas_version');
  const setupComplete = yamlScalar(stateRaw, 'setup_complete') === 'true';
  const mode = yamlScalar(stateRaw, 'mode') || null;
  const toolsRaw = stateRaw?.match(/^tools:\s*\[([^\]]*)\]/m);
  const tools = toolsRaw
    ? toolsRaw[1].split(',').map((t) => t.trim()).filter(Boolean)
    : null;

  return {
    dir,
    layout,
    installed,
    ancestorRoot: ancestorRoot && ancestorRoot !== dir ? ancestorRoot : null,
    statePath,
    stateRaw,
    midasVersion,
    engineVersion,
    setupComplete,
    mode,
    tools,
    scriptsDir: resolveScriptsDir(dir),
    hasManifest: existsSync(join(dir, '.harness', 'manifest.json')),
  };
}

/** Semver-ish compare including `-rc.N` pre-release tails. Returns <0 when a<b. */
export function compareVersions(a, b) {
  const parse = (v) => {
    const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?/);
    if (!m) return [0, 0, 0, 0];
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : 9999];
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 4; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}
