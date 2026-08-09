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
  appendContextCost,
  buildSessionStartCostRecord,
  estimateApproxTokens,
  resolveContextCostPath,
} from '../context-cost.mjs';
import { refreshContextCost } from '../../context-cost-refresh.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-context-cost-${suffix}-`));
}

describe('context-cost', () => {
  it('resolveContextCostPath prefers runs/cache for engine-style roots', () => {
    const root = makeProject('engine');
    try {
      const path = resolveContextCostPath(root);
      assert.equal(path, join(root, 'runs', 'cache', 'metrics', 'context-cost.jsonl'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolveContextCostPath prefers .harness/cache when .harness exists', () => {
    const root = makeProject('harness');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      const path = resolveContextCostPath(root);
      assert.equal(path, join(root, '.harness', 'cache', 'metrics', 'context-cost.jsonl'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('estimateApproxTokens uses ceil(length/4)', () => {
    assert.equal(estimateApproxTokens(''), 0);
    assert.equal(estimateApproxTokens('abcd'), 1);
    assert.equal(estimateApproxTokens('abcde'), 2);
    assert.equal(estimateApproxTokens('x'.repeat(100)), 25);
  });

  it('buildSessionStartCostRecord aggregates approx_tokens', () => {
    const record = buildSessionStartCostRecord({
      projectRoot: '/tmp',
      agentsChars: 40,
      carryoverChars: 20,
      stateChars: 0,
      pathsSampled: ['AGENTS.md', '.harness/state.yaml'],
    });
    assert.equal(record.schema_version, 1);
    assert.equal(record.event, 'sessionStart');
    assert.equal(record.approx_tokens.agents, 10);
    assert.equal(record.approx_tokens.carryover, 5);
    assert.equal(record.approx_tokens.state, 0);
    assert.equal(record.approx_tokens.total, 15);
    assert.deepEqual(record.paths_sampled, ['AGENTS.md', '.harness/state.yaml']);
    assert.ok(Date.parse(record.ts));
  });

  it('appendContextCost writes NDJSON and never throws', () => {
    const root = makeProject('append');
    try {
      const record = buildSessionStartCostRecord({
        projectRoot: root,
        agentsChars: 8,
        carryoverChars: 0,
        stateChars: 0,
        pathsSampled: ['AGENTS.md'],
      });
      assert.equal(appendContextCost(root, record), true);
      const path = resolveContextCostPath(root);
      assert.equal(existsSync(path), true);
      const line = readFileSync(path, 'utf8').trim();
      const parsed = JSON.parse(line);
      assert.equal(parsed.event, 'sessionStart');
      assert.equal(parsed.approx_tokens.total, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refreshContextCost samples AGENTS.md and state when present', () => {
    const root = makeProject('refresh');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      writeFileSync(join(root, 'AGENTS.md'), 'x'.repeat(40), 'utf8');
      writeFileSync(join(root, '.harness', 'state.yaml'), 'y'.repeat(20), 'utf8');

      const { record, appended } = refreshContextCost(root);
      assert.equal(appended, true);
      assert.equal(record.approx_tokens.agents, 10);
      assert.equal(record.approx_tokens.state, 5);
      assert.ok(record.paths_sampled.includes('AGENTS.md'));
      assert.ok(record.paths_sampled.includes('.harness/state.yaml'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
