// transaction.mjs — single snapshot / commit / rollback primitive for install & migrate.
// Optional durable mode stores backups under `{cache}/installer/runs/<runId>/backups`
// and appends journal lines (ADR-012 P1). Callers must not pass a relPath that contains
// the installer cache (see installRollbackPaths in execute.mjs).

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendJournal,
  backupPath,
  resolveInstallerCacheRoot,
} from './install-journal.mjs';

/**
 * @typedef {{
 *   root: string,
 *   backupRoot: string,
 *   relPaths: string[],
 *   entries: { rel: string, kind: 'dir'|'file' }[],
 *   durable?: { runId: string },
 * }} RollbackSession
 */

/**
 * @param {string} root
 * @param {string} abs
 */
function isUnderInstallerCache(root, abs) {
  const cacheRoot = resolveInstallerCacheRoot(root);
  const rel = relative(cacheRoot, abs);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..');
}

/**
 * Snapshot existing paths under root into a temp or durable backup directory.
 * @param {string} root
 * @param {string[]} relPaths
 * @param {{ runId?: string }} [opts]
 * @returns {RollbackSession}
 */
export function beginRollbackSession(root, relPaths, opts = {}) {
  const runId = opts.runId && typeof opts.runId === 'string' ? opts.runId : null;
  const backupRoot = runId
    ? join(resolveInstallerCacheRoot(root), 'runs', runId, 'backups')
    : mkdtempSync(join(tmpdir(), 'midas-install-backup-'));
  mkdirSync(backupRoot, { recursive: true });
  const entries = [];
  for (const rel of relPaths) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    // Never snapshot the installer cache (durable backups live there).
    if (isUnderInstallerCache(root, abs)) continue;
    const info = statSync(abs);
    const kind = info.isDirectory() ? 'dir' : 'file';
    const backupAbs = runId ? backupPath(root, runId, rel) : join(backupRoot, rel);
    // Dest must not sit inside src (Node cpSync rejects self-subdir copies).
    const destRel = relative(abs, backupAbs);
    if (destRel === '' || (!destRel.startsWith(`..${sep}`) && destRel !== '..')) {
      throw new Error(
        `durable backup for "${rel}" would nest inside the source tree; ` +
          'omit installer-cache parents from rollback paths',
      );
    }
    mkdirSync(dirname(backupAbs), { recursive: true });
    cpSync(abs, backupAbs, {
      recursive: kind === 'dir',
      force: true,
      preserveTimestamps: true,
      filter: (src) => !isUnderInstallerCache(root, src),
    });
    entries.push({ rel, kind });
    if (runId) {
      appendJournal(root, runId, { op: 'backup', path: rel, kind });
    }
  }
  return {
    root,
    backupRoot,
    relPaths: [...relPaths],
    entries,
    ...(runId ? { durable: { runId } } : {}),
  };
}

/** Restore snapshotted paths and delete anything newly created under the watched set. */
export function rollbackInstall(session) {
  if (!session) return;
  const cleanupPaths = [...new Set(session.relPaths)].sort((a, b) => b.length - a.length);
  for (const rel of cleanupPaths) {
    const abs = join(session.root, rel);
    if (isUnderInstallerCache(session.root, abs)) continue;
    rmSync(abs, { recursive: true, force: true });
  }
  for (const { rel, kind } of session.entries) {
    const backupAbs = join(session.backupRoot, rel);
    if (!existsSync(backupAbs)) continue;
    const dst = join(session.root, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(backupAbs, dst, { recursive: kind === 'dir', force: true, preserveTimestamps: true });
  }
  scrubNonInstallerCache(session.root);
  if (!session.durable) {
    rmSync(session.backupRoot, { recursive: true, force: true });
  }
}

/**
 * Drop `.harness/cache/*` except `installer/` (durable run state).
 * Fresh installs previously snapshotted the whole `.harness` tree; durable
 * mode cannot, so this keeps rollback digests clean.
 * @param {string} root
 */
function scrubNonInstallerCache(root) {
  const cache = join(root, '.harness', 'cache');
  if (!existsSync(cache)) return;
  for (const name of readdirSync(cache)) {
    if (name === 'installer') continue;
    rmSync(join(cache, name), { recursive: true, force: true });
  }
}

/** Discard a successful session's backup. */
export function discardRollbackSession(session) {
  if (!session) return;
  if (session.durable) {
    // Keep journal; drop file backups for this run after success.
    rmSync(session.backupRoot, { recursive: true, force: true });
    return;
  }
  rmSync(session.backupRoot, { recursive: true, force: true });
}

/**
 * Run fn inside a rollback session. On throw, restore and rethrow.
 * @template T
 * @param {string} root
 * @param {string[]} relPaths
 * @param {(session: RollbackSession) => Promise<T>|T} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(root, relPaths, fn) {
  const session = beginRollbackSession(root, relPaths);
  try {
    const result = await fn(session);
    discardRollbackSession(session);
    return result;
  } catch (err) {
    rollbackInstall(session);
    throw err;
  }
}
