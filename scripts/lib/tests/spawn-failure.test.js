import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSpawnedTestFailure, UNIT_TEST_MAX_BUFFER } from '../spawn-failure.mjs';

describe('formatSpawnedTestFailure', () => {
  it('surfaces failing spec lines instead of the first 500 chars of passing output', () => {
    const head = '▶ durable transaction + journal\n  ✔ beginRollbackSession (22ms)\n';
    const tail = '✖ adapter / template snapshots match live generators\n  AssertionError [ERR_ASSERTION]: cli/template digest drifted\n';
    const detail = formatSpawnedTestFailure({
      status: 1,
      stdout: `${head}${tail}`,
      stderr: '',
    });
    assert.match(detail, /digest drifted/);
    assert.doesNotMatch(detail, /durable transaction/);
  });

  it('includes spawnSync ENOBUFS when maxBuffer is exceeded', () => {
    const err = new Error('stdout maxBuffer exceeded');
    err.code = 'ENOBUFS';
    const detail = formatSpawnedTestFailure({ status: null, error: err, stdout: '✔ pass\n', stderr: '' });
    assert.match(detail, /ENOBUFS/);
    assert.match(detail, /maxBuffer/);
  });
});

describe('UNIT_TEST_MAX_BUFFER', () => {
  it('is larger than Node spawnSync default (1MiB)', () => {
    assert.ok(UNIT_TEST_MAX_BUFFER > 1024 * 1024);
  });
});
