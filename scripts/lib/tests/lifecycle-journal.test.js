import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendLifecycleEvent,
  isValidLifecycleEvent,
  LIFECYCLE_JOURNAL_SCHEMA_VERSION,
  resolveLifecycleJournalPath,
  validateLifecycleJournalEntry,
  VALID_LIFECYCLE_EVENTS,
} from '../lifecycle-journal.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-lifecycle-journal-${suffix}-`));
}

function readJournalLines(root) {
  const path = resolveLifecycleJournalPath(root);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('lifecycle-journal', () => {
  it('resolveLifecycleJournalPath prefers runs/cache for engine-style roots', () => {
    const root = makeProject('engine');
    try {
      const path = resolveLifecycleJournalPath(root);
      assert.equal(path, join(root, 'runs', 'cache', 'metrics', 'lifecycle.jsonl'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolveLifecycleJournalPath prefers .harness/cache when .harness exists', () => {
    const root = makeProject('harness');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      const path = resolveLifecycleJournalPath(root);
      assert.equal(path, join(root, '.harness', 'cache', 'metrics', 'lifecycle.jsonl'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('appendLifecycleEvent writes schema_version 1 entry with pid', () => {
    const root = makeProject('append');
    try {
      const ok = appendLifecycleEvent(root, { event: 'start_sprint' });
      assert.equal(ok, true);

      const lines = readJournalLines(root);
      assert.equal(lines.length, 1);
      const entry = lines[0];
      assert.equal(entry.schema_version, LIFECYCLE_JOURNAL_SCHEMA_VERSION);
      assert.equal(entry.event, 'start_sprint');
      assert.equal(typeof entry.ts, 'string');
      assert.ok(!Number.isNaN(Date.parse(entry.ts)));
      assert.equal(typeof entry.pid, 'number');
      assert.equal(entry.pid, process.pid);
      assert.equal(entry.detail, undefined);
      assert.equal(validateLifecycleJournalEntry(entry), true);

      const raw = readFileSync(resolveLifecycleJournalPath(root), 'utf8');
      assert.ok(raw.endsWith('\n'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('appendLifecycleEvent includes optional detail', () => {
    const root = makeProject('detail');
    try {
      const ok = appendLifecycleEvent(root, {
        event: 'verify',
        detail: 'sprint-03 login flow',
      });
      assert.equal(ok, true);

      const entry = readJournalLines(root)[0];
      assert.equal(entry.event, 'verify');
      assert.equal(entry.detail, 'sprint-03 login flow');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('appendLifecycleEvent appends multiple lines', () => {
    const root = makeProject('multi');
    try {
      assert.equal(appendLifecycleEvent(root, { event: 'explore_start' }), true);
      assert.equal(appendLifecycleEvent(root, { event: 'explore_end' }), true);

      const lines = readJournalLines(root);
      assert.equal(lines.length, 2);
      assert.equal(lines[0].event, 'explore_start');
      assert.equal(lines[1].event, 'explore_end');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('invalid event returns false without writing', () => {
    const root = makeProject('invalid');
    try {
      assert.equal(isValidLifecycleEvent('not_an_event'), false);
      assert.equal(appendLifecycleEvent(root, { event: 'not_an_event' }), false);
      assert.equal(existsSync(resolveLifecycleJournalPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('non-string detail returns false without writing', () => {
    const root = makeProject('bad-detail');
    try {
      assert.equal(appendLifecycleEvent(root, { event: 'session_note', detail: 42 }), false);
      assert.equal(existsSync(resolveLifecycleJournalPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('VALID_LIFECYCLE_EVENTS covers expected names', () => {
    assert.deepEqual(VALID_LIFECYCLE_EVENTS, [
      'start_sprint',
      'close_sprint',
      'explore_start',
      'explore_end',
      'verify',
      'session_note',
    ]);
  });
});
