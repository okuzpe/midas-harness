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
import { hasProductionPaths, isProductionPath, listChangedPaths } from '../lib/diff-paths.mjs';
import { listGateRunDir } from '../../lib/gate-result.mjs';
import {
  exitCodeForResult,
  resolveTestScript,
  runTestGate,
} from '../test-gate.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-test-gate-${suffix}-`));
}

function writeHarnessState(root) {
  mkdirSync(join(root, '.harness'), { recursive: true });
  writeFileSync(join(root, '.harness', 'state.yaml'), 'layout: harness\n', 'utf8');
}

describe('diff-paths production heuristic', () => {
  it('treats common production prefixes as production', () => {
    assert.equal(isProductionPath('src/index.ts'), true);
    assert.equal(isProductionPath('app/page.tsx'), true);
    assert.equal(isProductionPath('apps/web/main.ts'), true);
    assert.equal(isProductionPath('packages/core/index.ts'), true);
    assert.equal(isProductionPath('server/app.mjs'), true);
    assert.equal(isProductionPath('backend/api.ts'), true);
    assert.equal(isProductionPath('frontend/App.vue'), true);
    assert.equal(isProductionPath('web/index.html'), true);
    assert.equal(isProductionPath('api/routes.ts'), true);
  });

  it('excludes docs, markdown, harness, engine tooling, and tests', () => {
    assert.equal(isProductionPath('docs/guide.md'), false);
    assert.equal(isProductionPath('README.md'), false);
    assert.equal(isProductionPath('harness/conventions.md'), false);
    assert.equal(isProductionPath('.harness/engine/rules/testing.md'), false);
    assert.equal(isProductionPath('scripts/doctor.mjs'), false);
    assert.equal(isProductionPath('cli/index.mjs'), false);
    assert.equal(isProductionPath('src/tests/setup.ts'), false);
    assert.equal(isProductionPath('src/foo.test.ts'), false);
    assert.equal(isProductionPath('src/foo.spec.js'), false);
    assert.equal(isProductionPath('packages/core/tests/unit.test.ts'), false);
  });

  it('hasProductionPaths returns true when any path qualifies', () => {
    assert.equal(hasProductionPaths(['docs/a.md', 'src/a.ts']), true);
    assert.equal(hasProductionPaths(['docs/a.md', 'scripts/x.mjs']), false);
    assert.equal(hasProductionPaths([]), false);
  });

  it('listChangedPaths returns empty on git failure', () => {
    const root = makeProject('no-git');
    try {
      assert.deepEqual(listChangedPaths(root), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('resolveTestScript', () => {
  it('prefers test, then test:unit, then test:ci', () => {
    assert.equal(resolveTestScript({ test: 'vitest run' }), 'test');
    assert.equal(resolveTestScript({ 'test:unit': 'vitest', test: 'jest' }), 'test');
    assert.equal(resolveTestScript({ 'test:ci': 'jest --ci', 'test:unit': 'vitest' }), 'test:unit');
    assert.equal(resolveTestScript({ 'test:ci': 'jest --ci' }), 'test:ci');
    assert.equal(resolveTestScript({ lint: 'eslint .' }), null);
    assert.equal(resolveTestScript(undefined), null);
  });
});

describe('runTestGate', () => {
  it('skips when changed paths have no production surface', () => {
    const root = makeProject('skip');
    /** @type {unknown[]} */
    const written = [];
    try {
      writeHarnessState(root);
      const result = runTestGate(root, {
        runId: 'run-skip',
        listChangedPaths: () => ['docs/readme.md', 'harness/rules/testing.md'],
        writeResult: (_root, runId, payload) => {
          written.push({ runId, payload });
          return payload;
        },
      });

      assert.equal(result.status, 'skipped');
      assert.equal(result.reason, 'no-production-paths');
      assert.equal(result.gate, 'test');
      assert.equal(written.length, 1);
      assert.equal(written[0].runId, 'run-skip');
      assert.equal(exitCodeForResult(result), 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when production paths change but no test script exists', () => {
    const root = makeProject('blocked');
    try {
      writeHarnessState(root);
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'demo', scripts: {} }), 'utf8');

      const result = runTestGate(root, {
        runId: 'run-blocked',
        listChangedPaths: () => ['src/index.ts'],
        readPackageJson: () => ({ scripts: {} }),
        writeResult: (_r, _id, payload) => payload,
      });

      assert.equal(result.status, 'blocked');
      assert.equal(result.reason, 'no-test-script');
      assert.equal(result.production_paths, true);
      assert.equal(exitCodeForResult(result), 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes and fails based on stubbed test command exit code', () => {
    const root = makeProject('run');
    try {
      writeHarnessState(root);
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'demo', scripts: { test: 'node --test' } }),
        'utf8',
      );

      const pass = runTestGate(root, {
        runId: 'run-pass',
        listChangedPaths: () => ['src/app.ts'],
        readPackageJson: () => ({ scripts: { test: 'node --test' } }),
        runCommand: () => ({ exitCode: 0, signal: null, stdout: 'ok', stderr: '' }),
        writeResult: (_r, _id, payload) => payload,
      });
      assert.equal(pass.status, 'pass');
      assert.equal(pass.command, 'npm run test');
      assert.equal(exitCodeForResult(pass), 0);

      const fail = runTestGate(root, {
        runId: 'run-fail',
        listChangedPaths: () => ['src/app.ts'],
        readPackageJson: () => ({ scripts: { test: 'node --test' } }),
        runCommand: () => ({ exitCode: 1, signal: null, stdout: '', stderr: 'boom' }),
        writeResult: (_r, _id, payload) => payload,
      });
      assert.equal(fail.status, 'fail');
      assert.equal(fail.reason, 'tests-failed');
      assert.equal(exitCodeForResult(fail), 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes gate result under cache/gates via default writer', () => {
    const root = makeProject('write');
    try {
      writeHarnessState(root);
      runTestGate(root, {
        runId: 'run-write',
        listChangedPaths: () => ['docs/only.md'],
      });
      const resultPath = join(listGateRunDir(root, 'run-write'), 'test.json');
      assert.equal(existsSync(resultPath), true);
      const saved = JSON.parse(readFileSync(resultPath, 'utf8'));
      assert.equal(saved.status, 'skipped');
      assert.equal(saved.gate, 'test');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
