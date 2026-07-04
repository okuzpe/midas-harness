// paths.mjs — layout-aware path resolver (classic vs compact). Dependency-free.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Fixed subdirs under the runs base (classic: .harness/, compact: .midas/). */
export const RUNS_SUBDIRS = ['audits', 'verifications', 'debates', 'sprints', 'sweeps', 'cache'];

const CLASSIC = {
  layout: 'classic',
  engine: 'harness',
  scripts: 'scripts',
  state: 'harness/state.yaml',
  version: 'harness/VERSION',
  runs: '.harness',
  agentsDoc: 'docs/agents-and-models.md',
};

const COMPACT = {
  layout: 'compact',
  engine: '.midas/engine',
  scripts: '.midas/scripts',
  state: '.midas/state.yaml',
  version: '.midas/engine/VERSION',
  runs: '.midas',
  agentsDoc: '.midas/docs/agents-and-models.md',
};

/**
 * Detect installed layout from disk markers.
 * @param {string} root project root
 * @returns {'classic' | 'compact' | null}
 */
export function detectLayout(root) {
  const r = resolve(root);
  const compact =
    existsSync(join(r, '.midas', 'state.yaml')) || existsSync(join(r, '.midas', 'engine', 'VERSION'));
  const classic =
    existsSync(join(r, 'harness', 'state.yaml')) || existsSync(join(r, 'harness', 'VERSION'));
  if (compact && classic) return null; // corruption — both layouts present
  if (compact) return 'compact';
  if (classic) return 'classic';
  return null;
}

/**
 * Resolve Midas path map for a project root.
 * @param {string} [root='.'] project root
 * @param {'classic' | 'compact'} [layout] force layout; default = detect or classic
 * @returns {object & { projectRoot: string, layoutConflict: boolean }}
 */
export function resolvePaths(root = '.', layout) {
  const projectRoot = resolve(root);
  const detected = detectLayout(projectRoot);
  const layoutConflict = detected === null && (
    existsSync(join(projectRoot, '.midas', 'state.yaml')) ||
    existsSync(join(projectRoot, '.midas', 'engine', 'VERSION'))
  ) && (
    existsSync(join(projectRoot, 'harness', 'state.yaml')) ||
    existsSync(join(projectRoot, 'harness', 'VERSION'))
  );

  const chosen = layout || detected || 'classic';
  const base = chosen === 'compact' ? { ...COMPACT } : { ...CLASSIC };

  return {
    ...base,
    projectRoot,
    layoutConflict,
    /** Join project root with a repo-relative segment. */
    join(...segments) {
      return join(projectRoot, ...segments);
    },
    /** Path to a runs subdir, e.g. runsPath('audits') → '.harness/audits' or '.midas/audits'. */
    runsPath(subdir) {
      const p = join(base.runs, subdir);
      return p.replace(/\\/g, '/');
    },
    /** Absolute path to doctor/render script directory entry. */
    doctorScript() {
      return join(projectRoot, base.scripts, 'doctor.mjs');
    },
    renderScript() {
      return join(projectRoot, base.scripts, 'render-adapters.mjs');
    },
    adaptersHash() {
      if (base.layout === 'compact') return join(projectRoot, base.runs, 'cache', 'adapters.hash');
      return join(projectRoot, base.runs, 'adapters.hash');
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

/** YAML block for compact layout paths (for state.yaml). */
export function compactPathsYaml() {
  return {
    engine: COMPACT.engine,
    scripts: COMPACT.scripts,
    state: COMPACT.state,
    runs: COMPACT.runs,
  };
}
