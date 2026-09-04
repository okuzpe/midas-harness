// paths.mjs — role-aware path resolver (Midas 3.0).
//
// `role: engine` — contributor tree (this repo): authored source in harness/ + scripts/.
// `role: product` — installed project: everything under .harness/.
// v1 classic/compact/hub product trees are refused, not migrated.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePathsBlock } from './yaml-lite.mjs';

/** Fixed evidence subdirs under the runs base. */
export const RUNS_SUBDIRS = ['audits', 'verifications', 'debates', 'sprints', 'sweeps', 'lean', 'retros', 'investigate', 'auto-pilot'];

export const ENGINE_DEFAULTS = Object.freeze({
  role: 'engine',
  layout: 'classic',
  engine: 'harness',
  scripts: 'scripts',
  state: 'harness/state.yaml',
  version: 'harness/VERSION',
  runs: 'runs',
  cache: 'runs/cache',
  product: 'docs/product',
  rules: 'harness/rules',
  agentsDoc: 'docs/agents-and-models.md',
});

export const PRODUCT_DEFAULTS = Object.freeze({
  role: 'product',
  layout: 'harness',
  root: '.harness',
  engine: '.harness/engine',
  scripts: '.harness/scripts',
  state: '.harness/state.yaml',
  version: '.harness/engine/VERSION',
  product: '.harness/product',
  rules: '.harness/rules',
  runs: '.harness/runs',
  cache: '.harness/cache',
  migrations: '.harness/migrations',
  manifest: '.harness/manifest.json',
  agentsDoc: '.harness/engine/docs/agents-and-models.md',
});

export const V1_REFUSE_MESSAGE =
  'Midas 3.x does not support 1.x classic/compact/hub layouts. Pin create-midas@2.10.x, run update --migrate, then upgrade to 3.x.';

function isEngineRepository(root) {
  return (
    existsSync(join(root, 'harness', 'VERSION')) &&
    existsSync(join(root, 'cli', 'package.json')) &&
    existsSync(join(root, 'scripts', 'build-create.mjs'))
  );
}

function readRoleFromState(root) {
  const candidates = [
    join(root, '.harness', 'state.yaml'),
    join(root, 'harness', 'state.yaml'),
  ];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    const raw = readFileSync(f, 'utf8');
    const role = (raw.match(/^role:\s*(\S+)/m) || [])[1];
    if (role === 'engine' || role === 'product') return role;
  }
  return null;
}

/**
 * True when the tree looks like a 1.x product install (not the engine repo).
 * @param {string} root
 */
export function isV1Install(root) {
  const r = resolve(root);
  if (isEngineRepository(r)) return false;
  if (existsSync(join(r, '.harness', 'state.yaml')) || existsSync(join(r, '.harness', 'engine', 'VERSION'))) {
    return false;
  }
  const classic = existsSync(join(r, 'harness', 'state.yaml')) || existsSync(join(r, 'harness', 'VERSION'));
  const midas = existsSync(join(r, '.midas', 'state.yaml')) || existsSync(join(r, '.midas', 'engine', 'VERSION'));
  return Boolean(classic || midas);
}

/**
 * @param {string} root
 * @returns {'engine' | 'product' | null}
 */
export function detectRole(root) {
  const r = resolve(root);
  const fromState = readRoleFromState(r);
  if (fromState) return fromState;
  if (isEngineRepository(r)) return 'engine';
  if (existsSync(join(r, '.harness', 'state.yaml')) || existsSync(join(r, '.harness', 'engine', 'VERSION'))) {
    return 'product';
  }
  return null;
}

/**
 * @deprecated 3.0 derived alias of detectRole. Product → harness, engine → classic, v1 → null.
 * @param {string} root
 */
export function detectLayout(root) {
  if (isV1Install(root)) return null;
  const role = detectRole(root);
  if (role === 'product') return 'harness';
  if (role === 'engine') return 'classic';
  return null;
}

/**
 * @param {string} [root='.']
 * @param {'harness' | 'classic' | 'engine' | 'product'} [forced]
 */
export function resolvePaths(root = '.', forced) {
  const projectRoot = resolve(root);
  let role = detectRole(projectRoot);
  if (forced === 'harness' || forced === 'product') role = 'product';
  if (forced === 'classic' || forced === 'engine') role = 'engine';
  if (!role) role = 'engine';

  const base = { ...(role === 'engine' ? ENGINE_DEFAULTS : PRODUCT_DEFAULTS) };
  const stateFile = join(projectRoot, base.state);
  if (existsSync(stateFile)) {
    try {
      const pathOverrides = parsePathsBlock(readFileSync(stateFile, 'utf8'));
      for (const [key, value] of Object.entries(pathOverrides)) {
        if (value && key in base) base[key] = value;
      }
    } catch {
      /* keep defaults */
    }
  }

  return {
    ...base,
    projectRoot,
    layoutConflict: false,
    join(...segments) {
      return join(projectRoot, ...segments);
    },
    runsPath(subdir) {
      const p = join(base.runs, subdir);
      return p.replace(/\\/g, '/');
    },
    doctorScript() {
      return join(projectRoot, base.scripts, 'doctor.mjs');
    },
    renderScript() {
      return join(projectRoot, base.scripts, 'render-adapters.mjs');
    },
    adaptersHash() {
      if (base.role === 'engine') {
        return join(projectRoot, base.runs, 'adapters.hash');
      }
      return join(projectRoot, base.cache || join(base.runs, 'cache'), 'adapters.hash');
    },
  };
}

export function harnessPathsYaml() {
  return {
    root: PRODUCT_DEFAULTS.root,
    engine: PRODUCT_DEFAULTS.engine,
    scripts: PRODUCT_DEFAULTS.scripts,
    state: PRODUCT_DEFAULTS.state,
    product: PRODUCT_DEFAULTS.product,
    rules: PRODUCT_DEFAULTS.rules,
    runs: PRODUCT_DEFAULTS.runs,
    cache: PRODUCT_DEFAULTS.cache,
  };
}

export function resolveProjectRootFromScript(metaUrl) {
  const scriptDir = dirname(fileURLToPath(metaUrl));
  let dir = scriptDir;
  for (let i = 0; i < 8; i++) {
    if (
      (existsSync(join(dir, 'harness', 'VERSION')) && existsSync(join(dir, 'scripts', 'test.mjs'))) ||
      existsSync(join(dir, '.harness', 'state.yaml')) ||
      existsSync(join(dir, '.harness', 'engine', 'VERSION'))
    ) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  const norm = scriptDir.replace(/\\/g, '/');
  if (norm.endsWith('/.midas/scripts') || norm.endsWith('/.harness/scripts')) {
    return resolve(scriptDir, '..', '..');
  }
  return resolve(scriptDir, '..');
}
