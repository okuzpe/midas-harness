// context-digest.mjs — optional workspace file index (ADR-012 P2; F-034–036).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { extname, join } from 'node:path';
import { resolvePaths } from '../paths.mjs';

export const DIGEST_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_FILES = 200;
export const MAX_QUERY_HITS = 20;
export const MAX_WALK_DEPTH = 4;

/** @typedef {{ path: string, bytes: number, ext: string }} DigestFileEntry */

/** @typedef {{
 *   schema_version: 1,
 *   generated_at: string,
 *   files: DigestFileEntry[],
 * }} ContextDigest */

const PREFERRED_DIRS = ['src', 'app', 'lib', 'cli', 'scripts', 'harness'];

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'runs',
  'cache',
]);

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
function useHarnessCache(projectRoot) {
  if (existsSync(join(projectRoot, '.harness'))) return true;
  try {
    return resolvePaths(projectRoot).layout === 'harness';
  } catch {
    return false;
  }
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function resolveCacheRoot(projectRoot) {
  if (useHarnessCache(projectRoot)) {
    return join(projectRoot, '.harness', 'cache');
  }
  return join(projectRoot, 'runs', 'cache');
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function resolveDigestPath(projectRoot) {
  return join(resolveCacheRoot(projectRoot), 'context', 'digest.json');
}

/**
 * @param {string} relPath
 * @returns {string}
 */
function normalizeRel(relPath) {
  return relPath.replace(/\\/g, '/');
}

/**
 * @param {string} dirName
 * @param {string} relPath
 * @returns {boolean}
 */
function shouldSkipDir(dirName, relPath) {
  if (SKIP_DIR_NAMES.has(dirName)) return true;
  const norm = normalizeRel(relPath);
  if (norm === '.harness/cache' || norm.startsWith('.harness/cache/')) return true;
  if (norm === '.harness/runs' || norm.startsWith('.harness/runs/')) return true;
  return false;
}

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
function discoverPreferredRoots(projectRoot) {
  /** @type {string[]} */
  const roots = [];
  for (const dir of PREFERRED_DIRS) {
    const rel = normalizeRel(dir);
    if (existsSync(join(projectRoot, rel))) roots.push(rel);
  }
  return roots;
}

/**
 * @param {string} projectRoot
 * @param {string} dirRel
 * @param {number} maxFiles
 * @param {DigestFileEntry[]} files
 * @param {number} [depth]
 */
function walkShallow(projectRoot, dirRel, maxFiles, files, depth = 0) {
  if (files.length >= maxFiles || depth > MAX_WALK_DEPTH) return;

  const abs = join(projectRoot, dirRel);
  if (!existsSync(abs)) return;

  /** @type {import('node:fs').Dirent[]} */
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= maxFiles) break;
    const childRel = normalizeRel(join(dirRel, entry.name));
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name, childRel)) continue;
      walkShallow(projectRoot, childRel, maxFiles, files, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      const st = statSync(join(projectRoot, childRel));
      files.push({
        path: childRel,
        bytes: st.size,
        ext: extname(entry.name).toLowerCase(),
      });
    } catch {
      /* fail-open: skip unreadable */
    }
  }
}

/**
 * @param {unknown} value
 * @returns {value is ContextDigest}
 */
export function validateDigest(value) {
  if (!value || typeof value !== 'object') return false;
  const d = /** @type {Record<string, unknown>} */ (value);
  if (d.schema_version !== DIGEST_SCHEMA_VERSION) return false;
  if (typeof d.generated_at !== 'string' || Number.isNaN(Date.parse(d.generated_at))) return false;
  if (!Array.isArray(d.files)) return false;
  return d.files.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const f = /** @type {Record<string, unknown>} */ (item);
    return (
      typeof f.path === 'string'
      && typeof f.bytes === 'number'
      && Number.isFinite(f.bytes)
      && typeof f.ext === 'string'
    );
  });
}

/**
 * @param {string} projectRoot
 * @param {{ maxFiles?: number }} [opts]
 * @returns {ContextDigest}
 */
export function buildDigest(projectRoot, opts = {}) {
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;
  /** @type {DigestFileEntry[]} */
  const files = [];

  try {
    for (const root of discoverPreferredRoots(projectRoot)) {
      walkShallow(projectRoot, root, maxFiles, files);
      if (files.length >= maxFiles) break;
    }
  } catch {
    /* fail-open: return partial/empty digest */
  }

  return {
    schema_version: DIGEST_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    files: files.slice(0, maxFiles),
  };
}

/**
 * @param {string} projectRoot
 * @param {ContextDigest} [digest]
 * @returns {ContextDigest}
 */
export function writeDigest(projectRoot, digest) {
  const payload = digest ?? buildDigest(projectRoot);
  if (!validateDigest(payload)) {
    throw new Error('Invalid context digest payload');
  }
  const path = resolveDigestPath(projectRoot);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload)}\n`, 'utf8');
  return payload;
}

/**
 * @param {string} projectRoot
 * @returns {ContextDigest | null}
 */
export function readDigest(projectRoot) {
  const path = resolveDigestPath(projectRoot);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!validateDigest(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {ContextDigest | null | undefined} digest
 * @param {string} query
 * @param {{ maxHits?: number }} [opts]
 * @returns {DigestFileEntry[]}
 */
export function queryDigest(digest, query, opts = {}) {
  const maxHits = opts.maxHits ?? MAX_QUERY_HITS;
  if (!digest || !validateDigest(digest)) return [];
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return [];

  /** @type {DigestFileEntry[]} */
  const hits = [];
  for (const file of digest.files) {
    if (hits.length >= maxHits) break;
    const hay = file.path.toLowerCase();
    if (hay.includes(needle) || file.ext.toLowerCase().includes(needle)) {
      hits.push(file);
    }
  }
  return hits;
}
