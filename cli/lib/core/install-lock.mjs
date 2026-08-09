// install-lock.mjs — exclusive installer lock (pid + host), ADR-012 P1.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { hostname as osHostname } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveInstallerCacheRoot } from './install-journal.mjs';

export const INSTALL_LOCK_SCHEMA_VERSION = 1;
export const DEFAULT_STALE_MS = 2 * 60 * 60 * 1000; // 2h

/** @typedef {{
 *   schema_version: 1,
 *   pid: number,
 *   hostname: string,
 *   acquired_at: string,
 * }} InstallLock */

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function resolveInstallLockPath(projectRoot) {
  return join(resolveInstallerCacheRoot(projectRoot), 'install.lock');
}

/**
 * @param {number} pid
 * @returns {boolean}
 */
export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {value is InstallLock}
 */
export function validateInstallLock(value) {
  if (!value || typeof value !== 'object') return false;
  const l = /** @type {Record<string, unknown>} */ (value);
  if (l.schema_version !== INSTALL_LOCK_SCHEMA_VERSION) return false;
  if (typeof l.pid !== 'number' || !Number.isInteger(l.pid) || l.pid <= 0) return false;
  if (typeof l.hostname !== 'string' || !l.hostname) return false;
  if (typeof l.acquired_at !== 'string' || Number.isNaN(Date.parse(l.acquired_at))) return false;
  return true;
}

/**
 * @param {string} projectRoot
 * @returns {InstallLock | null}
 */
export function readInstallLock(projectRoot) {
  const path = resolveInstallLockPath(projectRoot);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return validateInstallLock(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {InstallLock} lock
 * @param {number} nowMs
 * @param {number} staleMs
 * @returns {boolean}
 */
export function isLockStale(lock, nowMs = Date.now(), staleMs = DEFAULT_STALE_MS) {
  const acquired = Date.parse(lock.acquired_at);
  if (Number.isNaN(acquired)) return true;
  return nowMs - acquired > staleMs;
}

/**
 * @param {string} projectRoot
 * @param {{ pid?: number, hostname?: string, staleMs?: number }} [opts]
 * @returns {{ ok: true, lock: InstallLock } | { ok: false, reason: string, holder: InstallLock | null }}
 */
export function acquireInstallLock(projectRoot, opts = {}) {
  const path = resolveInstallLockPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  const pid = opts.pid ?? process.pid;
  const host = opts.hostname ?? osHostname();
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const existing = readInstallLock(projectRoot);

  if (existing) {
    const sameOwner = existing.pid === pid && existing.hostname === host;
    const alive = isPidAlive(existing.pid);
    const stale = isLockStale(existing, Date.now(), staleMs);
    if (!sameOwner && alive && !stale) {
      return { ok: false, reason: 'lock-held', holder: existing };
    }
  }

  /** @type {InstallLock} */
  const lock = {
    schema_version: INSTALL_LOCK_SCHEMA_VERSION,
    pid,
    hostname: host,
    acquired_at: new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return { ok: true, lock };
}

/**
 * @param {string} projectRoot
 * @param {{ force?: boolean, pid?: number, hostname?: string }} [opts]
 * @returns {boolean} true if removed or already absent
 */
export function releaseInstallLock(projectRoot, opts = {}) {
  const path = resolveInstallLockPath(projectRoot);
  if (!existsSync(path)) return true;
  const existing = readInstallLock(projectRoot);
  if (!existing) {
    unlinkSync(path);
    return true;
  }
  const pid = opts.pid ?? process.pid;
  const host = opts.hostname ?? osHostname();
  const owned = existing.pid === pid && existing.hostname === host;
  if (!owned && !opts.force) return false;
  unlinkSync(path);
  return true;
}
