// transaction.mjs — single snapshot / commit / rollback primitive for install & migrate.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * @typedef {{ root: string, backupRoot: string, relPaths: string[], entries: { rel: string, kind: 'dir'|'file' }[] }} RollbackSession
 */

/**
 * Snapshot existing paths under root into a temp backup directory.
 * @param {string} root
 * @param {string[]} relPaths
 * @returns {RollbackSession}
 */
export function beginRollbackSession(root, relPaths) {
  const backupRoot = mkdtempSync(join(tmpdir(), 'midas-install-backup-'));
  const entries = [];
  for (const rel of relPaths) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const info = statSync(abs);
    const kind = info.isDirectory() ? 'dir' : 'file';
    const backupAbs = join(backupRoot, rel);
    mkdirSync(dirname(backupAbs), { recursive: true });
    cpSync(abs, backupAbs, { recursive: kind === 'dir', force: true, preserveTimestamps: true });
    entries.push({ rel, kind });
  }
  return { root, backupRoot, relPaths: [...relPaths], entries };
}

/** Restore snapshotted paths and delete anything newly created under the watched set. */
export function rollbackInstall(session) {
  if (!session) return;
  const cleanupPaths = [...new Set(session.relPaths)].sort((a, b) => b.length - a.length);
  for (const rel of cleanupPaths) {
    rmSync(join(session.root, rel), { recursive: true, force: true });
  }
  for (const { rel, kind } of session.entries) {
    const backupAbs = join(session.backupRoot, rel);
    if (!existsSync(backupAbs)) continue;
    const dst = join(session.root, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(backupAbs, dst, { recursive: kind === 'dir', force: true, preserveTimestamps: true });
  }
  rmSync(session.backupRoot, { recursive: true, force: true });
}

/** Discard a successful session's backup. */
export function discardRollbackSession(session) {
  if (!session) return;
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
