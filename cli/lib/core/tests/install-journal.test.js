import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendJournal,
  backupPath,
  clearActiveRun,
  readActiveRun,
  resolveInstallerCacheRoot,
  validateActiveRun,
  writeActiveRun,
} from '../install-journal.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-install-journal-${suffix}-`));
}

function seedEngineRepo(root) {
  mkdirSync(join(root, 'harness'), { recursive: true });
  mkdirSync(join(root, 'cli'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(join(root, 'harness', 'VERSION'), '0.0.0\n', 'utf8');
  writeFileSync(join(root, 'cli', 'package.json'), '{}\n', 'utf8');
  writeFileSync(join(root, 'scripts', 'build-create.mjs'), '// stub\n', 'utf8');
}

const ACTIVE = {
  run_id: 'run-abc',
  started_at: '2026-08-09T12:00:00.000Z',
  command: 'update',
  step: 'apply',
};

describe('install-journal', () => {
  it('resolveInstallerCacheRoot uses .harness/cache for install targets', () => {
    const root = makeProject('install');
    try {
      const cache = resolveInstallerCacheRoot(root);
      assert.equal(cache, join(root, '.harness', 'cache', 'installer'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolveInstallerCacheRoot uses runs/cache for engine repository', () => {
    const root = makeProject('engine');
    try {
      seedEngineRepo(root);
      const cache = resolveInstallerCacheRoot(root);
      assert.equal(cache, join(root, 'runs', 'cache', 'installer'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writeActiveRun/readActiveRun roundtrip with pid and hostname defaults', () => {
    const root = makeProject('active');
    try {
      const written = writeActiveRun(root, ACTIVE);
      assert.equal(written.run_id, ACTIVE.run_id);
      assert.equal(written.started_at, ACTIVE.started_at);
      assert.equal(written.command, ACTIVE.command);
      assert.equal(written.step, ACTIVE.step);
      assert.equal(written.pid, process.pid);
      assert.ok(written.hostname);

      const read = readActiveRun(root);
      assert.deepEqual(read, written);

      const raw = readFileSync(join(root, '.harness', 'cache', 'installer', 'active.json'), 'utf8');
      assert.ok(raw.endsWith('\n'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('clearActiveRun removes active.json', () => {
    const root = makeProject('clear');
    try {
      writeActiveRun(root, { ...ACTIVE, pid: 1, hostname: 'test-host' });
      const path = join(root, '.harness', 'cache', 'installer', 'active.json');
      assert.ok(existsSync(path));

      clearActiveRun(root);
      assert.equal(existsSync(path), false);
      assert.equal(readActiveRun(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('validateActiveRun rejects incomplete payloads', () => {
    assert.equal(validateActiveRun(null), false);
    assert.equal(validateActiveRun({ ...ACTIVE, pid: 'nope', hostname: 'x' }), false);
    assert.equal(validateActiveRun({ ...ACTIVE, pid: 1, hostname: 'host' }), true);
  });

  it('appendJournal writes NDJSON lines under the run directory', () => {
    const root = makeProject('journal');
    try {
      appendJournal(root, 'run-1', { phase: 'plan', detail: 'start' });
      appendJournal(root, 'run-1', { phase: 'apply', detail: 'copy engine', ts: '2026-08-09T12:01:00.000Z' });

      const journalPath = join(root, '.harness', 'cache', 'installer', 'runs', 'run-1', 'journal.ndjson');
      const lines = readFileSync(journalPath, 'utf8').trim().split('\n');
      assert.equal(lines.length, 2);

      const first = JSON.parse(lines[0]);
      assert.equal(first.phase, 'plan');
      assert.equal(first.detail, 'start');
      assert.ok(first.ts);

      const second = JSON.parse(lines[1]);
      assert.equal(second.ts, '2026-08-09T12:01:00.000Z');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('backupPath resolves under runs/<runId>/backups', () => {
    const root = makeProject('backup');
    try {
      const path = backupPath(root, 'run-9', 'engine/VERSION');
      assert.equal(
        path,
        join(root, '.harness', 'cache', 'installer', 'runs', 'run-9', 'backups', 'engine', 'VERSION'),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('backupPath rejects traversal rel paths', () => {
    const root = makeProject('traversal');
    try {
      assert.throws(() => backupPath(root, 'run-9', '../secrets'), /relPath/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
