import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runTraceWrite } from '../../trace-write.mjs';
import { runFilePath } from '../trace-store.mjs';

function makeProject() {
  const root = mkdtempSync(join(tmpdir(), 'midas-trace-write-'));
  mkdirSync(join(root, '.harness'), { recursive: true });
  writeFileSync(
    join(root, '.harness', 'state.yaml'),
    [
      'midas_version: 2.10.3',
      'layout: harness',
      'stage: sprint_execution',
      'stage_status: in_progress',
      'sprints:',
      '  - id: 01-demo',
      '    status: active',
      '',
    ].join('\n'),
    'utf8',
  );
  return root;
}

describe('trace-write loadStateDigest', () => {
  it('snapshot reads .harness/state.yaml via resolvePaths(root, layout)', () => {
    const root = makeProject();
    const tracesRoot = join(root, '.harness', 'cache', 'traces');
    const chunks = [];
    const stdout = { write: (s) => { chunks.push(s); return true; } };
    const stderr = { write: () => true };
    try {
      const start = runTraceWrite(['start-run'], { projectRoot: root, tracesRoot, stdout, stderr });
      assert.equal(start, 0);
      const started = JSON.parse(chunks[0]);
      assert.ok(started.session_id && started.run_id);
      const snap = runTraceWrite(['snapshot'], { projectRoot: root, tracesRoot, stdout, stderr });
      assert.equal(snap, 0);
      const jsonl = readFileSync(runFilePath(tracesRoot, started.session_id, started.run_id), 'utf8');
      const snapshotLine = jsonl
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .find((env) => env.type === 'state.snapshot');
      assert.ok(snapshotLine, 'state.snapshot envelope');
      assert.equal(snapshotLine.attrs.stage, 'sprint_execution');
      assert.equal(snapshotLine.attrs.stage_status, 'in_progress');
      assert.equal(snapshotLine.attrs.active_sprint, '01-demo');
      assert.notEqual(snapshotLine.attrs.state, 'error');
      assert.notEqual(snapshotLine.attrs.state, 'missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
