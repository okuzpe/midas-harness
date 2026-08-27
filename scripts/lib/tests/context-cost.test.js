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
  CONTEXT_COST_SCHEMA_VERSION,
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

  it('buildSessionStartCostRecord aggregates by_path and total (schema v2)', () => {
    const record = buildSessionStartCostRecord({
      projectRoot: '/tmp',
      samples: [
        { path: 'AGENTS.md', chars: 40 },
        { path: 'runs/cache/metrics/current-carryover.json', chars: 20 },
        { path: 'harness/state.yaml', chars: 0 },
        { path: '.cursor/rules/00-midas.mdc', chars: 400 },
      ],
    });
    assert.equal(record.schema_version, CONTEXT_COST_SCHEMA_VERSION);
    assert.equal(record.schema_version, 2);
    assert.equal(record.event, 'sessionStart');
    assert.equal(record.approx_tokens.by_path['AGENTS.md'], 10);
    assert.equal(record.approx_tokens.by_path['runs/cache/metrics/current-carryover.json'], 5);
    assert.equal(record.approx_tokens.by_path['.cursor/rules/00-midas.mdc'], 100);
    assert.equal(record.approx_tokens.by_bucket.agents, 10);
    assert.equal(record.approx_tokens.by_bucket.carryover, 5);
    assert.equal(record.approx_tokens.by_bucket.adapters, 100);
    assert.equal(record.approx_tokens.total, 115);
    assert.ok(record.paths_sampled.includes('AGENTS.md'));
    assert.ok(record.paths_sampled.includes('.cursor/rules/00-midas.mdc'));
    assert.ok(Date.parse(record.ts));
  });

  it('appendContextCost writes NDJSON and never throws', () => {
    const root = makeProject('append');
    try {
      const record = buildSessionStartCostRecord({
        projectRoot: root,
        samples: [{ path: 'AGENTS.md', chars: 8 }],
      });
      assert.equal(appendContextCost(root, record), true);
      const path = resolveContextCostPath(root);
      assert.equal(existsSync(path), true);
      const line = readFileSync(path, 'utf8').trim();
      const parsed = JSON.parse(line);
      assert.equal(parsed.event, 'sessionStart');
      assert.equal(parsed.approx_tokens.total, 2);
      assert.equal(parsed.schema_version, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refreshContextCost samples AGENTS.md, state, and adapter files when present', () => {
    const root = makeProject('refresh');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      mkdirSync(join(root, '.cursor', 'rules'), { recursive: true });
      writeFileSync(join(root, 'AGENTS.md'), 'x'.repeat(40), 'utf8');
      writeFileSync(join(root, '.harness', 'state.yaml'), 'y'.repeat(20), 'utf8');
      writeFileSync(join(root, '.cursor', 'rules', '00-midas.mdc'), 'z'.repeat(80), 'utf8');

      const { record, appended } = refreshContextCost(root);
      assert.equal(appended, true);
      assert.equal(record.schema_version, 2);
      assert.equal(record.approx_tokens.by_bucket.agents, 10);
      assert.equal(record.approx_tokens.by_bucket.state, 5);
      assert.ok(record.paths_sampled.includes('AGENTS.md'));
      assert.ok(record.paths_sampled.includes('.harness/state.yaml'));
      assert.ok(record.paths_sampled.includes('.cursor/rules/00-midas.mdc'));
      assert.equal(record.approx_tokens.by_path['.cursor/rules/00-midas.mdc'], 20);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
