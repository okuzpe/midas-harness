// diff-paths.mjs — git diff path listing and production-path heuristic for gate runners.

import { execFileSync } from 'node:child_process';

/** Installed product roots (v2 harness, hub, classic/compact). */
/** @type {readonly string[]} */
const PRODUCT_ROOT_PREFIXES = [
  '.harness/product/',
  '.midas/product/',
  'product/',
];

/** Ritual / planning paths under product — not deployable source. */
/** @type {readonly string[]} */
const PRODUCT_RITUAL_PREFIXES = [
  'sprints/',
  'playbooks/',
  'adr/',
];

/** @type {readonly string[]} */
const NON_PRODUCTION_PREFIXES = [
  'docs/',
  'harness/',
  '.harness/engine/',
  '.harness/rules/',
  '.harness/scripts/',
  '.harness/cache/',
  '.harness/runs/',
  '.midas/engine/',
  'scripts/',
  'cli/',
];

/** @type {readonly string[]} */
const PRODUCTION_PREFIXES = [
  'src/',
  'app/',
  'apps/',
  'packages/',
  'server/',
  'backend/',
  'frontend/',
  'web/',
  'api/',
  'infra/',
  'deploy/',
  'k8s/',
  '.github/workflows/',
];

/** @type {readonly RegExp[]} */
const PRODUCTION_BASENAME_PATTERNS = [
  /^Dockerfile(\.|$)/i,
  /^docker-compose\./i,
];

/** @type {readonly RegExp[]} */
const PRODUCTION_PATH_PATTERNS = [
  /(^|\/)openapi\.(ya?ml|json)$/i,
  /(^|\/)swagger\.(ya?ml|json)$/i,
];

/**
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isTestPath(path) {
  return (
    path.includes('/tests/') ||
    path.startsWith('tests/') ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
  );
}

/**
 * @param {string} norm normalized repo-relative path
 * @returns {string | null} suffix after product root, or null if not under product
 */
function stripProductRoot(norm) {
  for (const prefix of PRODUCT_ROOT_PREFIXES) {
    if (norm.startsWith(prefix)) return norm.slice(prefix.length);
  }
  return null;
}

/**
 * @param {string} suffix path relative to product root
 * @returns {boolean}
 */
function isProductProductionSuffix(suffix) {
  if (!suffix || suffix.endsWith('.md')) return false;
  if (isTestPath(suffix)) return false;
  for (const ritual of PRODUCT_RITUAL_PREFIXES) {
    if (suffix.startsWith(ritual)) return false;
  }
  for (const prefix of PRODUCTION_PREFIXES) {
    if (suffix.startsWith(prefix)) return true;
  }
  const base = suffix.split('/').pop() || suffix;
  if (PRODUCTION_BASENAME_PATTERNS.some((re) => re.test(base))) return true;
  if (PRODUCTION_PATH_PATTERNS.some((re) => re.test(suffix))) return true;
  return false;
}

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isProductionPath(path) {
  const norm = normalizePath(path);
  if (norm.endsWith('.md')) return false;

  const productSuffix = stripProductRoot(norm);
  if (productSuffix !== null) {
    return isProductProductionSuffix(productSuffix);
  }

  if (isTestPath(norm)) return false;

  for (const prefix of NON_PRODUCTION_PREFIXES) {
    if (norm.startsWith(prefix)) return false;
  }

  if (/^packages\/[^/]+\/tests\//.test(norm)) return false;

  for (const prefix of PRODUCTION_PREFIXES) {
    if (norm.startsWith(prefix)) return true;
  }

  const base = norm.split('/').pop() || norm;
  if (PRODUCTION_BASENAME_PATTERNS.some((re) => re.test(base))) return true;
  if (PRODUCTION_PATH_PATTERNS.some((re) => re.test(norm))) return true;

  return false;
}

/**
 * @param {string[]} paths
 * @returns {boolean}
 */
export function hasProductionPaths(paths) {
  return paths.some(isProductionPath);
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 * @returns {string[]}
 */
function gitNameOnly(projectRoot, args) {
  try {
    const out = execFileSync('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {string} projectRoot
 * @param {{ base?: string }} [opts]
 * @returns {string[]}
 */
export function listChangedPaths(projectRoot, opts = {}) {
  if (opts.base) {
    return gitNameOnly(projectRoot, ['diff', '--name-only', opts.base]);
  }

  const paths = new Set([
    ...gitNameOnly(projectRoot, ['diff', '--name-only']),
    ...gitNameOnly(projectRoot, ['diff', '--name-only', '--cached']),
  ]);
  return [...paths];
}
