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
import { validateGateResult, readGateResult } from '../../lib/gate-result.mjs';
import { hasProductionPaths, isProductionPath } from '../lib/diff-paths.mjs';
import {
  defaultRunId,
  parseQualityGateArgs,
  resolveQualityScripts,
  runQualityGate,
} from '../quality-gate.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-quality-gate-${suffix}-`));
}

function writePackageJson(root, scripts) {
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', scripts }, null, 2)}\n`,
    'utf8',
  );
}

describe('diff-paths production heuristic', () => {
  it('hasProductionPaths detects src and ignores docs/tests', () => {
    assert.equal(isProductionPath('src/index.ts'), true);
    assert.equal(isProductionPath('app/page.tsx'), true);
    assert.equal(isProductionPath('packages/foo/lib.ts'), true);
    assert.equal(isProductionPath('packages/foo/tests/bar.test.ts'), false);
    assert.equal(isProductionPath('docs/guide.md'), false);
    assert.equal(isProductionPath('harness/foo.mjs'), false);
    assert.equal(isProductionPath('scripts/gates/foo.mjs'), false);
    assert.equal(isProductionPath('cli/index.mjs'), false);
    assert.equal(isProductionPath('src/foo.test.ts'), false);
    assert.equal(
      hasProductionPaths(['docs/readme.md', 'harness/state.yaml']),
      false,
    );
    assert.equal(hasProductionPaths(['docs/readme.md', 'src/app.ts']), true);
  });
});

describe('quality-gate helpers', () => {
  it('resolveQualityScripts preserves preference order for existing keys', () => {
    const keys = resolveQualityScripts({
      lint: 'eslint .',
      test: 'vitest',
      typecheck: 'tsc --noEmit',
      tsc: 'tsc',
    });
    assert.deepEqual(keys, ['typecheck', 'lint', 'tsc']);
  });

  it('parseQualityGateArgs reads --run and --base', () => {
    const parsed = parseQualityGateArgs([
      'node',
      'quality-gate.mjs',
      '--run',
      'run-42',
      '--base',
      'main',
    ]);
    assert.equal(parsed.runId, 'run-42');
    assert.equal(parsed.base, 'main');
  });

  it('defaultRunId returns a non-empty slug', () => {
    assert.match(defaultRunId(), /^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('runQualityGate', () => {
  it('skips when diff has no production paths', () => {
    const root = makeProject('skip');
    try {
      const result = runQualityGate({
        projectRoot: root,
        runId: 'skip-run',
        listPaths: () => ['docs/readme.md', 'harness/foo.md'],
      });
      assert.equal(result.gate, 'quality');
      assert.equal(result.status, 'skipped');
      assert.equal(result.reason, 'no-production-paths');
      assert.equal(validateGateResult(result), true);

      const written = readGateResult(root, 'skip-run', 'quality');
      assert.deepEqual(written, result);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when production paths exist but no quality scripts', () => {
    const root = makeProject('blocked');
    try {
      writePackageJson(root, { test: 'node test.mjs' });
      const result = runQualityGate({
        projectRoot: root,
        runId: 'blocked-run',
        listPaths: () => ['src/index.ts'],
      });
      assert.equal(result.status, 'blocked');
      assert.equal(result.reason, 'no-quality-scripts');
      assert.equal(validateGateResult(result), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes when all stubbed quality scripts exit 0', () => {
    const root = makeProject('pass');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      writePackageJson(root, {
        lint: 'eslint .',
        typecheck: 'tsc --noEmit',
      });
      const calls = [];
      const result = runQualityGate({
        projectRoot: root,
        runId: 'pass-run',
        listPaths: () => ['src/app.ts'],
        runScript: (key) => {
          calls.push(key);
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });
      assert.equal(result.status, 'pass');
      assert.deepEqual(calls, ['typecheck', 'lint']);
      assert.equal(result.command, 'npm run typecheck; npm run lint');
      assert.equal(result.exit_code, 0);
      assert.equal(validateGateResult(result), true);
      assert.equal(
        existsSync(join(root, '.harness', 'cache', 'gates', 'pass-run', 'quality.json')),
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when any stubbed quality script exits non-zero', () => {
    const root = makeProject('fail');
    try {
      writePackageJson(root, { lint: 'eslint .', typecheck: 'tsc --noEmit' });
      const result = runQualityGate({
        projectRoot: root,
        runId: 'fail-run',
        listPaths: () => ['frontend/page.tsx'],
        runScript: (key) => ({
          exitCode: key === 'lint' ? 2 : 0,
          stdout: '',
          stderr: key === 'lint' ? 'lint errors' : '',
        }),
      });
      assert.equal(result.status, 'fail');
      assert.equal(result.command, 'npm run lint');
      assert.equal(result.exit_code, 2);
      assert.match(result.summary, /fail: npm run lint/);
      assert.equal(validateGateResult(result), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes makeResult-shaped receipt JSON', () => {
    const root = makeProject('shape');
    try {
      const result = runQualityGate({
        projectRoot: root,
        runId: 'shape-run',
        listPaths: () => ['scripts/readme.md'],
      });
      const path = join(root, 'runs', 'cache', 'gates', 'shape-run', 'quality.json');
      assert.equal(existsSync(path), true);
      const parsed = JSON.parse(readFileSync(path, 'utf8'));
      assert.equal(parsed.schema_version, 1);
      assert.equal(parsed.gate, 'quality');
      assert.equal(typeof parsed.started_at, 'string');
      assert.equal(typeof parsed.finished_at, 'string');
      assert.equal(typeof parsed.duration_ms, 'number');
      assert.equal(Array.isArray(parsed.changed_paths), true);
      assert.equal(typeof parsed.summary, 'string');
      assert.deepEqual(parsed, result);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
