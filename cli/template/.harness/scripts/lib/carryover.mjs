// carryover.mjs — mid-session allow-list snapshot for active sprint/explore (ADR-012).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { resolvePaths } from '../paths.mjs';
import { parseSprints } from '../yaml-lite.mjs';

export const CARRYOVER_SCHEMA_VERSION = 1;
export const MAX_SPRINT_FILES = 12;

/** @typedef {'sprint' | 'explore' | 'idle'} CarryoverMode */

/** @typedef {{
 *   schema_version: 1,
 *   ok: true,
 *   generated_at: string,
 *   mode: CarryoverMode,
 *   stage: string | null,
 *   sprint_id: string | null,
 *   explore_slug: string | null,
 *   files: string[],
 *   approx_tokens: number,
 *   notes?: string,
 * }} CarryoverSnapshot */

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
function useHarnessCache(projectRoot) {
  if (existsSync(join(projectRoot, '.harness'))) return true;
  const layout = resolvePaths(projectRoot).layout;
  return layout === 'harness';
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
export function resolveCarryoverPath(projectRoot) {
  return join(resolveCacheRoot(projectRoot), 'metrics', 'current-carryover.json');
}

/**
 * @param {string} relPath
 * @returns {string}
 */
function normalizeRel(relPath) {
  return relPath.replace(/\\/g, '/');
}

/**
 * @param {string} yaml
 * @returns {string | null}
 */
function parseStage(yaml) {
  const m = yaml.match(/^stage:\s*(.+)$/m);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

/**
 * @param {string} yaml
 * @returns {string | null}
 */
function findActiveSprintId(yaml) {
  const sprints = parseSprints(yaml);
  for (const [id, status] of sprints) {
    if (status === 'active') return id;
  }
  return null;
}

/**
 * @param {string} projectRoot
 * @param {ReturnType<typeof resolvePaths>} paths
 * @returns {string | null}
 */
function readExploreSlug(projectRoot, paths) {
  const marker = join(projectRoot, paths.runs, 'explore', '.active');
  if (!existsSync(marker)) return null;
  const slug = readFileSync(marker, 'utf8').trim();
  return slug || null;
}

/**
 * @param {string} projectRoot
 * @param {string} productDir
 * @param {string} sprintId
 * @returns {string | null}
 */
function discoverSprintMarkdown(projectRoot, productDir, sprintId) {
  const sprintsDir = join(projectRoot, productDir, 'sprints');
  if (!existsSync(sprintsDir)) return null;
  const prefixes = [sprintId, sprintId.padStart(2, '0')];
  for (const name of readdirSync(sprintsDir)) {
    if (!name.endsWith('.md')) continue;
    if (prefixes.some((p) => name.startsWith(`${p}-`))) {
      return normalizeRel(join(productDir, 'sprints', name));
    }
  }
  return null;
}

/**
 * @param {string} projectRoot
 * @param {ReturnType<typeof resolvePaths>} paths
 * @param {string} sprintId
 * @returns {string[]}
 */
function buildSprintFiles(projectRoot, paths, sprintId) {
  /** @type {string[]} */
  const files = [];
  const add = (rel) => {
    if (files.length >= MAX_SPRINT_FILES) return;
    const norm = normalizeRel(rel);
    if (existsSync(join(projectRoot, norm)) && !files.includes(norm)) {
      files.push(norm);
    }
  };

  add(paths.state);

  const sprintMd = discoverSprintMarkdown(projectRoot, paths.product, sprintId);
  if (sprintMd) add(sprintMd);

  add(join(paths.runs, 'sprints', `${sprintId}-progress.md`));
  add(join(paths.product, 'idea.md'));
  add(join(paths.product, 'architecture.md'));

  return files.slice(0, MAX_SPRINT_FILES);
}

/**
 * @param {string} projectRoot
 * @param {ReturnType<typeof resolvePaths>} paths
 * @param {string} slug
 * @returns {string[]}
 */
function buildExploreFiles(projectRoot, paths, slug) {
  /** @type {string[]} */
  const files = [];
  for (const name of ['meta.yaml', 'notes.md']) {
    const rel = normalizeRel(join(paths.runs, 'explore', slug, name));
    if (existsSync(join(projectRoot, rel))) files.push(rel);
  }
  return files;
}

/**
 * @param {string} projectRoot
 * @param {string[]} files
 * @returns {number}
 */
function approxTokens(projectRoot, files) {
  let bytes = 0;
  for (const rel of files) {
    const abs = join(projectRoot, rel);
    if (!existsSync(abs)) continue;
    try {
      bytes += statSync(abs).size;
    } catch {
      /* skip unreadable */
    }
  }
  return Math.floor(bytes / 4);
}

/**
 * @param {unknown} value
 * @returns {value is CarryoverSnapshot}
 */
export function validateCarryoverSnapshot(value) {
  if (!value || typeof value !== 'object') return false;
  const s = /** @type {Record<string, unknown>} */ (value);
  if (s.schema_version !== CARRYOVER_SCHEMA_VERSION) return false;
  if (s.ok !== true) return false;
  if (typeof s.generated_at !== 'string' || Number.isNaN(Date.parse(s.generated_at))) return false;
  if (s.mode !== 'sprint' && s.mode !== 'explore' && s.mode !== 'idle') return false;
  if (s.stage !== null && typeof s.stage !== 'string') return false;
  if (s.sprint_id !== null && typeof s.sprint_id !== 'string') return false;
  if (s.explore_slug !== null && typeof s.explore_slug !== 'string') return false;
  if (!Array.isArray(s.files) || !s.files.every((f) => typeof f === 'string')) return false;
  if (typeof s.approx_tokens !== 'number' || !Number.isFinite(s.approx_tokens)) return false;
  if (s.notes !== undefined && typeof s.notes !== 'string') return false;
  return true;
}

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
export function isActiveSession(projectRoot) {
  const paths = resolvePaths(projectRoot);
  const stateFile = join(projectRoot, paths.state);
  if (existsSync(stateFile)) {
    try {
      const yaml = readFileSync(stateFile, 'utf8');
      if (findActiveSprintId(yaml)) return true;
    } catch {
      /* fall through */
    }
  }
  return readExploreSlug(projectRoot, paths) !== null;
}

/**
 * @param {string} projectRoot
 * @returns {CarryoverSnapshot}
 */
export function buildCarryoverSnapshot(projectRoot) {
  const paths = resolvePaths(projectRoot);
  const stateFile = join(projectRoot, paths.state);
  let yaml = '';
  if (existsSync(stateFile)) {
    try {
      yaml = readFileSync(stateFile, 'utf8');
    } catch {
      yaml = '';
    }
  }

  const stage = yaml ? parseStage(yaml) : null;
  const sprintId = yaml ? findActiveSprintId(yaml) : null;
  const exploreSlug = readExploreSlug(projectRoot, paths);

  /** @type {CarryoverMode} */
  let mode = 'idle';
  /** @type {string[]} */
  let files = [];
  let resolvedSprintId = null;
  let resolvedExploreSlug = null;

  if (sprintId) {
    mode = 'sprint';
    resolvedSprintId = sprintId;
    files = buildSprintFiles(projectRoot, paths, sprintId);
  } else if (exploreSlug) {
    mode = 'explore';
    resolvedExploreSlug = exploreSlug;
    files = buildExploreFiles(projectRoot, paths, exploreSlug);
  }

  return {
    schema_version: CARRYOVER_SCHEMA_VERSION,
    ok: true,
    generated_at: new Date().toISOString(),
    mode,
    stage,
    sprint_id: resolvedSprintId,
    explore_slug: resolvedExploreSlug,
    files,
    approx_tokens: approxTokens(projectRoot, files),
  };
}

/**
 * @param {string} projectRoot
 * @param {CarryoverSnapshot} [snapshot]
 * @returns {CarryoverSnapshot}
 */
export function writeCarryoverSnapshot(projectRoot, snapshot) {
  const payload = snapshot ?? buildCarryoverSnapshot(projectRoot);
  if (!validateCarryoverSnapshot(payload)) {
    throw new Error('Invalid carryover snapshot payload');
  }
  const path = resolveCarryoverPath(projectRoot);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload)}\n`, 'utf8');
  return payload;
}

/**
 * @param {string} projectRoot
 * @returns {CarryoverSnapshot | null}
 */
export function readCarryoverSnapshot(projectRoot) {
  const path = resolveCarryoverPath(projectRoot);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!validateCarryoverSnapshot(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
