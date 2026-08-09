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
  beginRollbackSession,
  discardRollbackSession,
  rollbackInstall,
} from '../transaction.mjs';
import {
  appendJournal,
  clearActiveRun,
  newInstallRunId,
  readJournal,
  sessionFromJournal,
  writeActiveRun,
} from '../install-journal.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-txn-${suffix}-`));
}

describe('durable transaction + journal', () => {
  it('beginRollbackSession with runId writes backups under installer cache and journals', () => {
    const root = makeProject('durable');
    try {
      mkdirSync(join(root, '.harness', 'engine'), { recursive: true });
      writeFileSync(join(root, '.harness', 'engine', 'VERSION'), '1.0.0\n', 'utf8');
      const runId = newInstallRunId();
      const session = beginRollbackSession(root, ['.harness/engine'], { runId });
      assert.ok(session.durable);
      assert.ok(existsSync(join(session.backupRoot, '.harness', 'engine', 'VERSION')));
      const events = readJournal(root, runId);
      assert.ok(events.some((e) => e.op === 'backup' && e.path === '.harness/engine'));
      discardRollbackSession(session);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sessionFromJournal restores after simulated crash', () => {
    const root = makeProject('crash');
    try {
      mkdirSync(join(root, '.harness', 'engine'), { recursive: true });
      writeFileSync(join(root, '.harness', 'engine', 'VERSION'), 'before\n', 'utf8');
      const runId = 'run-crash-1';
      const session = beginRollbackSession(root, ['.harness/engine'], { runId });
      writeActiveRun(root, {
        run_id: runId,
        started_at: new Date().toISOString(),
        command: 'update',
        step: 'apply',
        pid: 1,
        hostname: 'test',
      });
      // Simulate crash mid-apply: mutate tree, drop in-memory session.
      writeFileSync(join(root, '.harness', 'engine', 'VERSION'), 'partial\n', 'utf8');
      const rebuilt = sessionFromJournal(root, runId);
      assert.ok(rebuilt);
      rollbackInstall(rebuilt);
      assert.equal(readFileSync(join(root, '.harness', 'engine', 'VERSION'), 'utf8'), 'before\n');
      clearActiveRun(root);
      discardRollbackSession(rebuilt);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('tmpdir (non-durable) session still rolls back in-process', () => {
    const root = makeProject('tmp');
    try {
      mkdirSync(join(root, 'keep'), { recursive: true });
      writeFileSync(join(root, 'keep', 'a.txt'), 'orig\n', 'utf8');
      const session = beginRollbackSession(root, ['keep']);
      assert.equal(session.durable, undefined);
      writeFileSync(join(root, 'keep', 'a.txt'), 'changed\n', 'utf8');
      rollbackInstall(session);
      assert.equal(readFileSync(join(root, 'keep', 'a.txt'), 'utf8'), 'orig\n');
      assert.equal(existsSync(session.backupRoot), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('appendJournal + sessionFromJournal returns null without backup ops', () => {
    const root = makeProject('empty');
    try {
      appendJournal(root, 'run-x', { op: 'start' });
      assert.equal(sessionFromJournal(root, 'run-x'), null);
      assert.equal(sessionFromJournal(root, 'run-x', ['.harness/engine']), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
