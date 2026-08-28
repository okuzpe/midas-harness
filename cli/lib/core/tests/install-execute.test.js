import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { acquireInstallLock, releaseInstallLock } from '../install-lock.mjs';
import { appendJournal, writeActiveRun } from '../install-journal.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const CLI = join(ROOT, 'cli', 'index.mjs');

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-install-exec-${suffix}-`));
}

function installCursor(root) {
  const result = spawnSync(
    process.execPath,
    [CLI, '--tools=cursor', root],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

/**
 * @param {string[]} args
 * @returns {{ status: number | null, envelope: Record<string, unknown> | null }}
 */
function runInstallerJson(args) {
  const result = spawnSync(
    process.execPath,
    [CLI, '--json', ...args],
    { cwd: ROOT, encoding: 'utf8' },
  );
  let envelope = null;
  try {
    envelope = JSON.parse((result.stdout || '').trim() || '{}');
  } catch {
    envelope = null;
  }
  return { status: result.status, envelope };
}

describe('install execute outcomes', () => {
  it('returns LOCK_HELD (exit 2) when installer lock is held', () => {
    const root = makeProject('lock');
    try {
      installCursor(root);
      const lock = acquireInstallLock(root);
      assert.equal(lock.ok, true);
      const { status, envelope } = runInstallerJson(['update', '--offline', '--yes', root]);
      assert.equal(status, 2);
      assert.equal(envelope?.outcome, 'LOCK_HELD');
      assert.match(String(envelope?.message || ''), /installer lock held/i);
    } finally {
      releaseInstallLock(root, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns INCOMPLETE (exit 3) when active.json exists without --resume', () => {
    const root = makeProject('incomplete');
    try {
      installCursor(root);
      writeActiveRun(root, {
        run_id: 'run-incomplete-test',
        started_at: '2026-08-09T12:00:00.000Z',
        command: 'update',
        step: 'apply',
      });
      const { status, envelope } = runInstallerJson(['update', '--offline', '--yes', root]);
      assert.equal(status, 3);
      assert.equal(envelope?.outcome, 'INCOMPLETE');
      assert.match(String(envelope?.message || ''), /incomplete installer run/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns FAILED_FATAL when --resume has no journal backups', () => {
    const root = makeProject('resume-empty');
    const runId = 'run-resume-empty';
    try {
      installCursor(root);
      writeActiveRun(root, {
        run_id: runId,
        started_at: '2026-08-09T12:00:00.000Z',
        command: 'update',
        step: 'resume',
      });
      appendJournal(root, runId, { op: 'start', command: 'update' });
      const { status, envelope } = runInstallerJson(['update', '--offline', '--resume', '--yes', root]);
      assert.equal(status, 1);
      assert.equal(envelope?.outcome, 'FAILED_FATAL');
      assert.match(String(envelope?.message || ''), /no journal backups/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
