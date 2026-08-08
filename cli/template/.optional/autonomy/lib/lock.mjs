import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { newToken } from './digest.mjs';

export function lockPath(projectRoot) {
  return join(projectRoot, '.harness', 'cache', 'autonomy', 'lease.lock');
}

/**
 * Acquire a single-writer lease with fencing token.
 * Uses exclusive create (`wx`) when no lock file exists; stale locks may be stolen.
 */
export function acquireLease(projectRoot, { holder, ttlMs = 30 * 60 * 1000 } = {}) {
  const path = lockPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  const now = Date.now();
  if (existsSync(path)) {
    try {
      const existing = JSON.parse(readFileSync(path, 'utf8'));
      const expires = Date.parse(existing.expires_at || 0);
      if (Number.isFinite(expires) && expires > now && existing.holder !== holder) {
        return { ok: false, reason: 'held', lease: existing };
      }
      // Stale or same-holder — clear before exclusive recreate.
      unlinkSync(path);
    } catch {
      try {
        unlinkSync(path);
      } catch {
        // ignore
      }
    }
  }
  const fencing_token = newToken('lease');
  const lease = {
    holder: holder || `pid:${process.pid}`,
    fencing_token,
    acquired_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttlMs).toISOString(),
  };
  const body = `${JSON.stringify(lease, null, 2)}\n`;
  try {
    writeFileSync(path, body, { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      try {
        const verify = JSON.parse(readFileSync(path, 'utf8'));
        return { ok: false, reason: 'race', lease: verify };
      } catch {
        return { ok: false, reason: 'race', lease: null };
      }
    }
    throw err;
  }
  const verify = JSON.parse(readFileSync(path, 'utf8'));
  if (verify.fencing_token !== fencing_token) {
    return { ok: false, reason: 'race', lease: verify };
  }
  return { ok: true, lease };
}

/**
 * Release a lease. Requires the fencing token — never unlink on parse failure without a match.
 */
export function releaseLease(projectRoot, fencingToken) {
  const path = lockPath(projectRoot);
  if (!existsSync(path)) return { ok: true };
  if (!fencingToken) {
    return { ok: false, reason: 'fencing_required' };
  }
  let existing;
  try {
    existing = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { ok: false, reason: 'corrupt_lock' };
  }
  if (existing.fencing_token !== fencingToken) {
    return { ok: false, reason: 'fencing_mismatch', lease: existing };
  }
  unlinkSync(path);
  return { ok: true };
}

export function readLease(projectRoot) {
  const path = lockPath(projectRoot);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}
