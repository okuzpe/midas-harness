// paths.mjs — layout-aware path resolver (classic | compact | hub). Dependency-free.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fixed subdirs under the runs base (classic: .harness/, compact/hub: .midas/). */
export const RUNS_SUBDIRS = ['audits', 'verifications', 'debates', 'sprints', 'sweeps', 'cache'];

const CLASSIC = {
  layout: 'classic',
  engine: 'harness',
  scripts: 'scripts',
  state: 'harness/state.yaml',
  version: 'harness/VERSION',
  runs: '.harness',
  product: 'product',
  agentsDoc: 'docs/agents-and-models.md',
};

const COMPACT = {
  layout: 'compact',
  engine: '.midas/engine',
  scripts: '.midas/scripts',
  state: '.midas/state.yaml',
  version: '.midas/engine/VERSION',
  runs: '.midas',
  product: 'product',
  agentsDoc: '.midas/docs/agents-and-models.md',
};

const HUB = {
  layout: 'hub',
  engine: '.midas/engine',
  scripts: '.midas/scripts',
  state: '.midas/state.yaml',
  version: '.midas/engine/VERSION',
  runs: '.midas',
  product: '.midas/product',
  agentsDoc: '.midas/docs/agents-and-models.md',
};

/** @param {string} root */
function readLayoutFromState(root) {
  const candidates = [
    join(root, '.midas', 'state.yaml'),
    join(root, 'harness', 'state.yaml'),
  ];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    const raw = readFileSync(f, 'utf8');
    const m = raw.match(/^layout:\s*(\S+)/m);
    if (m && ['classic', 'compact', 'hub'].includes(m[1])) return m[1];
  }
  return null;
}

/**
 * Detect installed layout from disk markers.
 * @param {string} root project root
 * @returns {'classic' | 'compact' | 'hub' | null}
 */
export function detectLayout(root) {
  const r = resolve(root);
  const fromState = readLayoutFromState(r);
  if (fromState) return fromState;

  const hasClassic =
    existsSync(join(r, 'harness', 'state.yaml')) || existsSync(join(r, 'harness', 'VERSION'));
  const hasMidas =
    existsSync(join(r, '.midas', 'state.yaml')) || existsSync(join(r, '.midas', 'engine', 'VERSION'));
  const hasHubProduct = existsSync(join(r, '.midas', 'product'));
  const hasRootProduct = existsSync(join(r, 'product'));

  if (hasClassic && hasMidas) return null;
  if (hasMidas && hasHubProduct) return 'hub';
  if (hasMidas) return hasRootProduct ? 'compact' : 'hub';
  if (hasClassic) return 'classic';
  return null;
}

/**
 * Resolve Midas path map for a project root.
 * @param {string} [root='.'] project root
 * @param {'classic' | 'compact' | 'hub'} [layout] force layout; default = detect or classic
 * @returns {object & { projectRoot: string, layoutConflict: boolean }}
 */
export function resolvePaths(root = '.', layout) {
  const projectRoot = resolve(root);
  const detected = detectLayout(projectRoot);
  const layoutConflict = detected === null && (
    (existsSync(join(projectRoot, '.midas', 'state.yaml')) ||
      existsSync(join(projectRoot, '.midas', 'engine', 'VERSION'))) &&
    (existsSync(join(projectRoot, 'harness', 'state.yaml')) ||
      existsSync(join(projectRoot, 'harness', 'VERSION')))
  );

  const chosen = layout || detected || 'classic';
  const base =
    chosen === 'hub' ? { ...HUB } : chosen === 'compact' ? { ...COMPACT } : { ...CLASSIC };

  return {
    ...base,
    projectRoot,
    layoutConflict,
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
      if (base.layout === 'classic') {
        return join(projectRoot, base.runs, 'adapters.hash');
      }
      return join(projectRoot, base.runs, 'cache', 'adapters.hash');
    },
  };
}

/** Classic → compact relocation map (repo-relative). */
export const MIGRATION_MAP = [
  { from: 'harness', to: '.midas/engine', type: 'dir' },
  { from: 'harness/state.yaml', to: '.midas/state.yaml', type: 'file' },
  { from: 'scripts', to: '.midas/scripts', type: 'dir' },
  { from: 'docs/agents-and-models.md', to: '.midas/docs/agents-and-models.md', type: 'file' },
  { from: '.harness/audits', to: '.midas/audits', type: 'dir' },
  { from: '.harness/verifications', to: '.midas/verifications', type: 'dir' },
  { from: '.harness/debates', to: '.midas/debates', type: 'dir' },
  { from: '.harness/sprints', to: '.midas/sprints', type: 'dir' },
  { from: '.harness/sweeps', to: '.midas/sweeps', type: 'dir' },
  { from: '.harness/cache', to: '.midas/cache', type: 'dir' },
  { from: '.harness/adapters.hash', to: '.midas/cache/adapters.hash', type: 'file' },
];

/** Additional moves for hub (product under .midas/). */
export const HUB_PRODUCT_MOVE = { from: 'product', to: '.midas/product', type: 'dir' };

/** Full classic → hub plan (compact engine moves + product). */
export const MIGRATION_MAP_HUB = [...MIGRATION_MAP, HUB_PRODUCT_MOVE];

/** YAML block for compact layout paths (for state.yaml). */
export function compactPathsYaml() {
  return {
    engine: COMPACT.engine,
    scripts: COMPACT.scripts,
    state: COMPACT.state,
    runs: COMPACT.runs,
    product: COMPACT.product,
  };
}

/** YAML block for hub layout paths (for state.yaml). */
export function hubPathsYaml() {
  return {
    engine: HUB.engine,
    scripts: HUB.scripts,
    state: HUB.state,
    runs: HUB.runs,
    product: HUB.product,
  };
}

/**
 * Project root when a Midas script is invoked with no directory argument.
 * Classic: `scripts/foo.mjs` → parent; hub/compact: `.midas/scripts/foo.mjs` → grandparent.
 * @param {string} metaUrl import.meta.url
 */
export function resolveProjectRootFromScript(metaUrl) {
  const scriptDir = dirname(fileURLToPath(metaUrl));
  const norm = scriptDir.replace(/\\/g, '/');
  if (norm.endsWith('/.midas/scripts')) return resolve(scriptDir, '..', '..');
  return resolve(scriptDir, '..');
}
