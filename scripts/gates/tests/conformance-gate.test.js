import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyCommandCheck,
  substituteTokens,
  evaluateCheck,
} from '../lib/conformance-eval.mjs';
import { writeConformanceReceipt, parseConformanceArgs } from '../conformance-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const paths = {
  scripts: 'scripts',
  engine: 'harness',
  rules: 'harness/rules',
  product: 'product',
  runs: '.harness',
  state: 'harness/state.yaml',
};

describe('conformance-eval', () => {
  it('substitutes path tokens', () => {
    const out = substituteTokens('node <paths.scripts>/doctor.mjs --gates-only', paths);
    assert.equal(out, 'node scripts/doctor.mjs --gates-only');
  });

  it('skips manual CHECKs', () => {
    const c = classifyCommandCheck('`manual:` read the sprint file', paths);
    assert.equal(c.runnable, false);
    assert.equal(c.reason, 'manual');
  });

  it('classifies grep-empty commands', () => {
    const c = classifyCommandCheck('`grep -nE "foo" package.json` → empty', paths);
    assert.equal(c.runnable, true);
    assert.equal(c.expectsEmpty, true);
  });

  it('evaluates a passing grep-empty against package.json', () => {
    const result = evaluateCheck(
      { kind: 'command', body: '`grep THIS_STRING_DOES_NOT_EXIST package.json` → empty' },
      { root: ROOT, paths },
    );
    assert.equal(result.status, 'pass');
  });
});

describe('conformance-gate receipt', () => {
  it('parses --root and --run', () => {
    const args = parseConformanceArgs(['node', 'conformance-gate.mjs', '--root', 'x', '--run', 'r1']);
    assert.equal(args.root, 'x');
    assert.equal(args.runId, 'r1');
  });

  it('writes MIDAS_CONFORMANCE_RESULT under runs/gates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'midas-conf-'));
    try {
      mkdirSync(join(dir, 'harness'), { recursive: true });
      writeFileSync(join(dir, 'harness', 'state.yaml'), 'layout: classic\nstage: shipped\n', 'utf8');
      const report = {
        verdict: 'pass',
        scanned: 2,
        failed: 0,
        skipped: 1,
        manual: 1,
        command: 1,
        rows: [],
      };
      const written = writeConformanceReceipt(dir, report, 'test-run');
      assert.equal(existsSync(written.mdPath), true);
      const md = readFileSync(written.mdPath, 'utf8');
      assert.match(md, /MIDAS_CONFORMANCE_RESULT: verdict=pass/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
