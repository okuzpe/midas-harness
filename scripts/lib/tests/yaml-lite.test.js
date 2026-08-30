import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePathsBlock,
  parseToolsFromStateYaml,
  parseMcpList,
  parseSprints,
  findActiveSprintId,
  parseStateScalar,
  parseMidasVersion,
} from '../../yaml-lite.mjs';

const SAMPLE = `
name: sandbox-example
role: product
layout: harness
midas_version: 3.0.0
tools: [cursor, gemini]
mcp: [context7]
paths:
  product: .harness/product
  runs: .harness/runs
  engine: .harness/engine
sprints:
  - id: "01"
    status: done
  - id: "02"
    status: active
`.trim();

describe('yaml-lite', () => {
  it('parsePathsBlock reads nested path keys', () => {
    const paths = parsePathsBlock(SAMPLE);
    assert.equal(paths.product, '.harness/product');
    assert.equal(paths.runs, '.harness/runs');
    assert.equal(paths.engine, '.harness/engine');
  });

  it('parseToolsFromStateYaml and parseMcpList read inline lists', () => {
    assert.deepEqual(parseToolsFromStateYaml(SAMPLE), ['cursor', 'gemini']);
    assert.deepEqual(parseMcpList(SAMPLE), ['context7']);
  });

  it('parseSprints and findActiveSprintId track sprint status', () => {
    const sprints = parseSprints(SAMPLE);
    assert.equal(sprints.get('01'), 'done');
    assert.equal(sprints.get('02'), 'active');
    assert.equal(findActiveSprintId(SAMPLE), '02');
  });

  it('parseStateScalar and parseMidasVersion read top-level keys', () => {
    assert.equal(parseStateScalar(SAMPLE, 'role'), 'product');
    assert.equal(parseStateScalar(SAMPLE, 'layout'), 'harness');
    assert.equal(parseMidasVersion(SAMPLE), '3.0.0');
  });

  it('missing blocks yield empty / null', () => {
    assert.deepEqual(parsePathsBlock('name: x\n'), {});
    assert.equal(parseToolsFromStateYaml('name: x\n'), null);
    assert.deepEqual(parseMcpList('name: x\n'), []);
    assert.equal(findActiveSprintId('sprints:\n  - id: "01"\n    status: planned\n'), null);
  });
});
