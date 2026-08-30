// context-digest.mjs — optional workspace file index (ADR-012 P2; F-034–036).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, relative } from 'node:path';
import { resolvePaths } from '../paths.mjs';
import { walkFiles } from './walk.mjs';
import { resolveCacheRoot } from './cache-paths.mjs';

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

const PRODUCT_SOURCE_DIRS = ['src', 'app', 'lib', 'ui', 'web', 'api', 'server', 'backend', 'frontend'];

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
function discoverPreferredRoots(projectRoot) {
  /** @type {string[]} */
  const roots = [];
  const seen = new Set();
  const addRoot = (rel) => {
    const norm = normalizeRel(rel);
    if (!seen.has(norm) && existsSync(join(projectRoot, norm))) {
      seen.add(norm);
      roots.push(norm);
    }
  };

  for (const dir of PREFERRED_DIRS) {
    addRoot(dir);
  }

  try {
    const paths = resolvePaths(projectRoot);
    const product = paths.product?.replace(/\\/g, '/');
    if (product) {
      for (const dir of PRODUCT_SOURCE_DIRS) {
        addRoot(join(product, dir));
      }
    }
  } catch {
    /* fail-open */
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
function collectDir(projectRoot, dirRel, maxFiles, files) {
  const remaining = maxFiles - files.length;
  if (remaining <= 0) return;
  const abs = join(projectRoot, dirRel);
  if (!existsSync(abs)) return;
  const hits = walkFiles(abs, {
    exclude: [...SKIP_DIR_NAMES],
    maxDepth: MAX_WALK_DEPTH,
    maxFiles: remaining,
    skipDir: (name, dirAbs) => shouldSkipDir(name, relative(projectRoot, dirAbs)),
  });
  for (const fileAbs of hits) {
    if (files.length >= maxFiles) break;
    try {
      const st = statSync(fileAbs);
      files.push({
        path: normalizeRel(relative(projectRoot, fileAbs)),
        bytes: st.size,
        ext: extname(fileAbs).toLowerCase(),
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
      collectDir(projectRoot, root, maxFiles, files);
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
