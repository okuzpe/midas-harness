import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GATE_RESULT_SCHEMA_VERSION,
  isPassingReceipt,
  listGateRunDir,
  makeResult,
  readGateResult,
  validateGateResult,
  findPassingGateRunForDiff,
  normalizeChangedPaths,
  receiptsMatchDiff,
  writeGateResult,
} from '../gate-result.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-gate-result-${suffix}-`));
}

function basePartial(overrides = {}) {
  return {
    gate: 'test',
    status: 'pass',
    summary: 'tests ok',
    ...overrides,
  };
}

describe('gate-result', () => {
  it('listGateRunDir prefers runs/cache for engine-style roots', () => {
    const root = makeProject('engine');
    try {
      const path = listGateRunDir(root, 'run-1');
      assert.equal(path, join(root, 'runs', 'cache', 'gates', 'run-1'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('listGateRunDir prefers .harness/cache when .harness exists', () => {
    const root = makeProject('harness');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      const path = listGateRunDir(root, 'run-1');
      assert.equal(path, join(root, '.harness', 'cache', 'gates', 'run-1'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('makeResult fills defaults and validates', () => {
    const result = makeResult(basePartial());
    assert.equal(result.schema_version, GATE_RESULT_SCHEMA_VERSION);
    assert.equal(result.gate, 'test');
    assert.equal(result.status, 'pass');
    assert.equal(result.reason, null);
    assert.equal(result.command, null);
    assert.equal(result.exit_code, null);
    assert.equal(result.production_paths, false);
    assert.deepEqual(result.changed_paths, []);
    assert.equal(result.summary, 'tests ok');
    assert.ok(result.started_at);
    assert.ok(result.finished_at);
    assert.equal(typeof result.duration_ms, 'number');
    assert.ok(validateGateResult(result));
  });

  it('makeResult computes duration_ms from timestamps', () => {
    const started = '2026-08-09T10:00:00.000Z';
    const finished = '2026-08-09T10:00:02.500Z';
    const result = makeResult({
      ...basePartial(),
      started_at: started,
      finished_at: finished,
    });
    assert.equal(result.duration_ms, 2500);
  });

  it('makeResult rejects invalid payloads', () => {
    assert.throws(() => makeResult({ gate: 'nope', status: 'pass', summary: 'x' }), /Invalid gate result/);
    assert.throws(() => makeResult({ gate: 'test', status: 'nope', summary: 'x' }), /Invalid gate result/);
  });

  it('validateGateResult rejects invalid payloads', () => {
    assert.equal(validateGateResult(null), false);
    assert.equal(validateGateResult({}), false);
    assert.equal(
      validateGateResult({
        schema_version: 2,
        gate: 'test',
        status: 'pass',
        reason: null,
        command: null,
        exit_code: null,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: 0,
        production_paths: false,
        changed_paths: [],
        summary: 'x',
      }),
      false,
    );
    assert.equal(
      validateGateResult({
        schema_version: 1,
        gate: 'test',
        status: 'pass',
        reason: null,
        command: null,
        exit_code: null,
        started_at: 'not-a-date',
        finished_at: new Date().toISOString(),
        duration_ms: 0,
        production_paths: false,
        changed_paths: [],
        summary: 'x',
      }),
      false,
    );
    assert.equal(
      validateGateResult({
        schema_version: 1,
        gate: 'test',
        status: 'pass',
        reason: null,
        command: null,
        exit_code: null,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: -1,
        production_paths: false,
        changed_paths: [],
        summary: 'x',
      }),
      false,
    );
  });

  it('isPassingReceipt matrix', () => {
    assert.equal(isPassingReceipt(makeResult({ ...basePartial(), status: 'pass' })), true);
    assert.equal(
      isPassingReceipt(makeResult({ ...basePartial(), status: 'skipped', reason: 'no production paths' })),
      true,
    );
    assert.equal(isPassingReceipt(makeResult({ ...basePartial(), status: 'skipped', reason: null })), false);
    assert.equal(isPassingReceipt(makeResult({ ...basePartial(), status: 'skipped', reason: '' })), false);
    assert.equal(isPassingReceipt(makeResult({ ...basePartial(), status: 'fail', reason: 'tests failed' })), false);
    assert.equal(isPassingReceipt(makeResult({ ...basePartial(), status: 'blocked', reason: 'deps' })), false);
    assert.equal(isPassingReceipt(null), false);
  });

  it('write/read roundtrip with aggregate result.json', () => {
    const root = makeProject('roundtrip');
    try {
      const runId = 'sprint-01';
      const written = writeGateResult(
        root,
        runId,
        makeResult({
          gate: 'test',
          status: 'pass',
          summary: 'all green',
          command: 'npm test',
          exit_code: 0,
          changed_paths: ['src/app.ts'],
          production_paths: true,
        }),
      );

      const gatePath = join(listGateRunDir(root, runId), 'test.json');
      const aggregatePath = join(listGateRunDir(root, runId), 'result.json');
      assert.ok(existsSync(gatePath));
      assert.ok(existsSync(aggregatePath));

      const read = readGateResult(root, runId, 'test');
      assert.deepEqual(read, written);

      const raw = readFileSync(gatePath, 'utf8');
      assert.ok(raw.endsWith('\n'));

      const aggregate = JSON.parse(readFileSync(aggregatePath, 'utf8'));
      assert.equal(aggregate.schema_version, 1);
      assert.equal(aggregate.run_id, runId);
      assert.equal(aggregate.passing, true);
      assert.deepEqual(aggregate.gates.test, written);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('aggregate passing is false when any gate fails', () => {
    const root = makeProject('aggregate');
    try {
      const runId = 'sprint-02';
      writeGateResult(root, runId, makeResult({ gate: 'test', status: 'pass', summary: 'ok' }));
      writeGateResult(
        root,
        runId,
        makeResult({ gate: 'quality', status: 'fail', summary: 'lint errors', exit_code: 1 }),
      );

      const aggregatePath = join(listGateRunDir(root, runId), 'result.json');
      const aggregate = JSON.parse(readFileSync(aggregatePath, 'utf8'));
      assert.equal(aggregate.passing, false);
      assert.equal(Object.keys(aggregate.gates).length, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('readGateResult returns null for missing or invalid files', () => {
    const root = makeProject('read-null');
    try {
      assert.equal(readGateResult(root, 'missing', 'test'), null);

      const runId = 'bad';
      const dir = listGateRunDir(root, runId);
      mkdirSync(dir, { recursive: true });
      const badPath = join(dir, 'test.json');
      writeFileSync(badPath, '{"schema_version":2}\n', 'utf8');
      assert.equal(readGateResult(root, runId, 'test'), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('normalizeChangedPaths dedupes, normalizes slashes, and sorts', () => {
    assert.deepEqual(
      normalizeChangedPaths(['src\\a.ts', 'src/a.ts', '', '  ', 'src/b.ts']),
      ['src/a.ts', 'src/b.ts'],
    );
  });

  it('receiptsMatchDiff requires passing receipts and exact path match', () => {
    const paths = ['src/app.ts', 'src/lib.ts'];
    const testPass = makeResult({
      gate: 'test',
      status: 'pass',
      summary: 'ok',
      changed_paths: paths,
    });
    const qualityPass = makeResult({
      gate: 'quality',
      status: 'pass',
      summary: 'ok',
      changed_paths: paths,
    });
    assert.equal(receiptsMatchDiff(testPass, qualityPass, paths), true);
    assert.equal(receiptsMatchDiff(testPass, qualityPass, ['src/app.ts']), false);
    assert.equal(
      receiptsMatchDiff(
        makeResult({ gate: 'test', status: 'fail', summary: 'no', changed_paths: paths }),
        qualityPass,
        paths,
      ),
      false,
    );
  });

  it('findPassingGateRunForDiff ignores stale runs with different changed_paths', () => {
    const root = makeProject('stale');
    try {
      const current = ['src/current.ts'];
      const staleId = 'stale-run';
      writeGateResult(
        root,
        staleId,
        makeResult({ gate: 'test', status: 'pass', summary: 'ok', changed_paths: ['src/old.ts'] }),
      );
      writeGateResult(
        root,
        staleId,
        makeResult({ gate: 'quality', status: 'pass', summary: 'ok', changed_paths: ['src/old.ts'] }),
      );
      assert.equal(findPassingGateRunForDiff(root, current), null);

      const matchId = 'match-run';
      writeGateResult(
        root,
        matchId,
        makeResult({ gate: 'test', status: 'pass', summary: 'ok', changed_paths: current }),
      );
      writeGateResult(
        root,
        matchId,
        makeResult({ gate: 'quality', status: 'pass', summary: 'ok', changed_paths: current }),
      );
      const match = findPassingGateRunForDiff(root, current);
      assert.ok(match);
      assert.equal(match.runId, matchId);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
