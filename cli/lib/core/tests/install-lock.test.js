import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, hostname } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireInstallLock,
  readInstallLock,
  releaseInstallLock,
  resolveInstallLockPath,
  isPidAlive,
} from '../install-lock.mjs';

function makeProject(suffix) {
  const root = mkdtempSync(join(tmpdir(), `midas-install-lock-${suffix}-`));
  mkdirSync(join(root, '.harness'), { recursive: true });
  return root;
}

describe('install-lock', () => {
  it('resolveInstallLockPath uses installer cache', () => {
    const root = makeProject('path');
    try {
      assert.equal(
        resolveInstallLockPath(root),
        join(root, '.harness', 'cache', 'installer', 'install.lock'),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('acquire/release roundtrip', () => {
    const root = makeProject('round');
    try {
      const got = acquireInstallLock(root);
      assert.equal(got.ok, true);
      assert.ok(existsSync(resolveInstallLockPath(root)));
      const read = readInstallLock(root);
      assert.equal(read?.pid, process.pid);
      assert.equal(releaseInstallLock(root), true);
      assert.equal(readInstallLock(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('second acquire fails while lock held by another live pid', () => {
    const root = makeProject('held');
    try {
      const first = acquireInstallLock(root, { pid: process.pid, hostname: hostname() });
      assert.equal(first.ok, true);
      const second = acquireInstallLock(root, { pid: process.pid + 99999, hostname: 'other-host' });
      assert.equal(second.ok, false);
      assert.equal(second.reason, 'lock-held');
      assert.equal(second.holder?.pid, process.pid);
    } finally {
      releaseInstallLock(root, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('EPERM/EACCES on pid probe counts as alive', () => {
    const orig = process.kill;
    process.kill = () => {
      const err = new Error('denied');
      err.code = 'EPERM';
      throw err;
    };
    try {
      assert.equal(isPidAlive(12345), true);
    } finally {
      process.kill = orig;
    }
  });

  it('same-owner acquire refreshes the lock file', () => {
    const root = makeProject('refresh');
    try {
      const first = acquireInstallLock(root);
      assert.equal(first.ok, true);
      const second = acquireInstallLock(root);
      assert.equal(second.ok, true);
      assert.equal(readInstallLock(root)?.pid, process.pid);
    } finally {
      releaseInstallLock(root, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('dead pid lock is overwritten', () => {
    const root = makeProject('dead');
    try {
      const lockPath = resolveInstallLockPath(root);
      mkdirSync(join(root, '.harness', 'cache', 'installer'), { recursive: true });
      // Extremely unlikely to be a live PID on this machine.
      const deadPid = 2_147_483_646;
      assert.equal(isPidAlive(deadPid), false);
      writeFileSync(
        lockPath,
        `${JSON.stringify({
          schema_version: 1,
          pid: deadPid,
          hostname: 'ghost',
          acquired_at: new Date().toISOString(),
        }, null, 2)}\n`,
      );
      const got = acquireInstallLock(root);
      assert.equal(got.ok, true);
      assert.equal(readInstallLock(root)?.pid, process.pid);
    } finally {
      releaseInstallLock(root, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('stale lock is overwritten', () => {
    const root = makeProject('stale');
    try {
      const lockPath = resolveInstallLockPath(root);
      mkdirSync(join(root, '.harness', 'cache', 'installer'), { recursive: true });
      writeFileSync(
        lockPath,
        `${JSON.stringify({
          schema_version: 1,
          pid: process.pid,
          hostname: 'old-host',
          acquired_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        }, null, 2)}\n`,
      );
      const got = acquireInstallLock(root, { staleMs: 60 * 60 * 1000 });
      assert.equal(got.ok, true);
      assert.equal(readInstallLock(root)?.hostname, hostname());
    } finally {
      releaseInstallLock(root, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('release without ownership fails unless force', () => {
    const root = makeProject('owner');
    try {
      acquireInstallLock(root, { pid: process.pid, hostname: hostname() });
      assert.equal(releaseInstallLock(root, { pid: 1, hostname: 'nope' }), false);
      assert.ok(readInstallLock(root));
      assert.equal(releaseInstallLock(root, { pid: 1, hostname: 'nope', force: true }), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
