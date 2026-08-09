// install-journal.mjs — durable installer run state + NDJSON journal (ADR-012 P1).

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { hostname } from 'node:os';
import { join, normalize } from 'node:path';
import { isMidasEngineRepository } from './context.mjs';

/** @typedef {{
 *   run_id: string,
 *   started_at: string,
 *   command: string,
 *   step: string,
 *   pid: number,
 *   hostname: string,
 * }} ActiveRun */

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function resolveInstallerCacheRoot(projectRoot) {
  if (isMidasEngineRepository(projectRoot)) {
    return join(projectRoot, 'runs', 'cache', 'installer');
  }
  return join(projectRoot, '.harness', 'cache', 'installer');
}

/**
 * @param {string} relPath
 */
function assertSafeRelPath(relPath) {
  const normalized = normalize(relPath).replace(/\\/g, '/');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('relPath must stay within the project');
  }
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error('relPath must stay within the project');
  }
}

/**
 * @param {string} projectRoot
 * @param {string} runId
 * @param {string} relPath
 * @returns {string}
 */
export function backupPath(projectRoot, runId, relPath) {
  if (!runId || typeof runId !== 'string') {
    throw new Error('runId must be a non-empty string');
  }
  if (!relPath || typeof relPath !== 'string') {
    throw new Error('relPath must be a non-empty string');
  }
  assertSafeRelPath(relPath);
  return join(
    resolveInstallerCacheRoot(projectRoot),
    'runs',
    runId,
    'backups',
    normalize(relPath),
  );
}

/**
 * @param {unknown} value
 * @returns {value is ActiveRun}
 */
export function validateActiveRun(value) {
  if (!value || typeof value !== 'object') return false;
  const r = /** @type {Record<string, unknown>} */ (value);
  if (typeof r.run_id !== 'string' || !r.run_id) return false;
  if (typeof r.started_at !== 'string' || Number.isNaN(Date.parse(r.started_at))) return false;
  if (typeof r.command !== 'string') return false;
  if (typeof r.step !== 'string') return false;
  if (typeof r.pid !== 'number' || !Number.isFinite(r.pid)) return false;
  if (typeof r.hostname !== 'string' || !r.hostname) return false;
  return true;
}

/**
 * @param {string} projectRoot
 * @returns {ActiveRun | null}
 */
export function readActiveRun(projectRoot) {
  const path = join(resolveInstallerCacheRoot(projectRoot), 'active.json');
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!validateActiveRun(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {string} projectRoot
 * @param {Omit<ActiveRun, 'pid' | 'hostname'> & Partial<Pick<ActiveRun, 'pid' | 'hostname'>>} active
 * @returns {ActiveRun}
 */
export function writeActiveRun(projectRoot, active) {
  const payload = {
    run_id: active.run_id,
    started_at: active.started_at,
    command: active.command,
    step: active.step,
    pid: active.pid ?? process.pid,
    hostname: active.hostname ?? hostname(),
  };
  if (!validateActiveRun(payload)) {
    throw new Error('Invalid active run payload');
  }
  const path = join(resolveInstallerCacheRoot(projectRoot), 'active.json');
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload)}\n`, 'utf8');
  return payload;
}

/**
 * @param {string} projectRoot
 */
export function clearActiveRun(projectRoot) {
  const path = join(resolveInstallerCacheRoot(projectRoot), 'active.json');
  if (!existsSync(path)) return;
  unlinkSync(path);
}

/**
 * Remove a finished/aborted run directory (journal + backups).
 * @param {string} projectRoot
 * @param {string} runId
 */
export function removeInstallRun(projectRoot, runId) {
  if (!runId || typeof runId !== 'string') {
    throw new Error('runId must be a non-empty string');
  }
  const cacheRoot = resolveInstallerCacheRoot(projectRoot);
  const runDir = join(cacheRoot, 'runs', runId);
  rmSync(runDir, { recursive: true, force: true });
  pruneEmptyDir(join(cacheRoot, 'runs'));
  if (!existsSync(join(cacheRoot, 'active.json')) && !existsSync(join(cacheRoot, 'install.lock'))) {
    const runsDir = join(cacheRoot, 'runs');
    if (!existsSync(runsDir) || readdirSyncSafe(runsDir).length === 0) {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  }
}

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return ['?'];
  }
}

function pruneEmptyDir(dir) {
  try {
    if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir);
  } catch {
    // ignore
  }
}

/**
 * @param {string} projectRoot
 * @param {string} runId
 * @param {Record<string, unknown>} event
 */
export function appendJournal(projectRoot, runId, event) {
  if (!runId || typeof runId !== 'string') {
    throw new Error('runId must be a non-empty string');
  }
  if (!event || typeof event !== 'object') {
    throw new Error('event must be an object');
  }
  const path = join(resolveInstallerCacheRoot(projectRoot), 'runs', runId, 'journal.ndjson');
  mkdirSync(join(path, '..'), { recursive: true });
  const line = {
    ...event,
    ts: typeof event.ts === 'string' ? event.ts : new Date().toISOString(),
  };
  appendFileSync(path, `${JSON.stringify(line)}\n`, 'utf8');
}

/**
 * @returns {string}
 */
export function newInstallRunId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `run-${stamp}-${process.pid}`;
}

/**
 * @param {string} projectRoot
 * @param {string} runId
 * @returns {Record<string, unknown>[]}
 */
export function readJournal(projectRoot, runId) {
  if (!runId || typeof runId !== 'string') {
    throw new Error('runId must be a non-empty string');
  }
  const path = join(resolveInstallerCacheRoot(projectRoot), 'runs', runId, 'journal.ndjson');
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return [];
  return raw.split('\n').map((line) => JSON.parse(line));
}

/**
 * Rebuild a durable RollbackSession-shaped object from journal backup ops
 * so `rollbackInstall` can restore after a process crash.
 * @param {string} projectRoot
 * @param {string} runId
 * @param {string[]} [fallbackRelPaths]
 * @returns {{ root: string, backupRoot: string, relPaths: string[], entries: { rel: string, kind: 'dir'|'file' }[], durable: { runId: string } } | null}
 */
export function sessionFromJournal(projectRoot, runId, fallbackRelPaths = []) {
  const events = readJournal(projectRoot, runId);
  const backups = events.filter((e) => e.op === 'backup' && typeof e.path === 'string');
  // Never fabricate entries from fallback paths alone — rollbackInstall would
  // delete those trees without any on-disk restore source (ADR-012 crash window).
  if (!backups.length) return null;
  const entries = backups.map((e) => ({
    rel: /** @type {string} */ (e.path),
    kind: e.kind === 'file' ? /** @type {'file'} */ ('file') : /** @type {'dir'} */ ('dir'),
  }));
  const relPaths = [...new Set(entries.map((e) => e.rel))];
  void fallbackRelPaths; // kept for call-site compat; ignored when no journal backups
  return {
    root: projectRoot,
    backupRoot: join(resolveInstallerCacheRoot(projectRoot), 'runs', runId, 'backups'),
    relPaths,
    entries,
    durable: { runId },
  };
}
