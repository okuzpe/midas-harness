import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectInstallLayout, V1_REFUSE_MESSAGE } from '../../core/context.mjs';
import { runUninstall } from '../uninstall.mjs';

function makeRoot(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-uninstall-unit-${suffix}-`));
}

function ctx(target, extra = {}) {
  return {
    target,
    template: join(import.meta.dirname, '..', '..', '..', 'template'),
    dryRun: false,
    purge: false,
    detectInstallLayout,
    ...extra,
  };
}

describe('runUninstall', () => {
  it('refuses a 1.x classic tree with zero writes', () => {
    const root = makeRoot('v1');
    try {
      mkdirSync(join(root, 'harness'), { recursive: true });
      writeFileSync(join(root, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
      writeFileSync(join(root, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\n', 'utf8');
      const before = readFileSync(join(root, 'harness', 'VERSION'), 'utf8');
      assert.throws(() => runUninstall(ctx(root)), (err) => {
        assert.equal(err instanceof Error, true);
        assert.equal(err.message, V1_REFUSE_MESSAGE);
        return true;
      });
      assert.equal(readFileSync(join(root, 'harness', 'VERSION'), 'utf8'), before);
      assert.equal(existsSync(join(root, 'harness', 'state.yaml')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a compact .midas tree with zero writes', () => {
    const root = makeRoot('compact');
    try {
      mkdirSync(join(root, '.midas', 'engine'), { recursive: true });
      writeFileSync(join(root, '.midas', 'state.yaml'), 'layout: compact\n', 'utf8');
      writeFileSync(join(root, '.midas', 'engine', 'VERSION'), '1.1.4\n', 'utf8');
      assert.throws(() => runUninstall(ctx(root)), (err) => err.message === V1_REFUSE_MESSAGE);
      assert.equal(existsSync(join(root, '.midas', 'engine', 'VERSION')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not delete files when manifest is missing', () => {
    const root = makeRoot('no-manifest');
    try {
      mkdirSync(join(root, '.harness', 'engine'), { recursive: true });
      writeFileSync(join(root, '.harness', 'state.yaml'), 'role: product\nlayout: harness\n', 'utf8');
      writeFileSync(join(root, '.harness', 'engine', 'VERSION'), '3.0.0\n', 'utf8');
      runUninstall(ctx(root, { dryRun: true }));
      assert.equal(existsSync(join(root, '.harness', 'engine', 'VERSION')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('dry-run leaves vendor files in place', () => {
    const root = makeRoot('dry');
    try {
      mkdirSync(join(root, '.harness', 'engine'), { recursive: true });
      writeFileSync(join(root, '.harness', 'state.yaml'), 'role: product\nlayout: harness\n', 'utf8');
      writeFileSync(join(root, '.harness', 'engine', 'keep.md'), '# vendor\n', 'utf8');
      const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      writeFileSync(
        join(root, '.harness', 'manifest.json'),
        JSON.stringify({
          schema_version: 1,
          layout: 'harness',
          files: [{ path: '.harness/engine/keep.md', role: 'vendor', sha256: sha, size: 1 }],
        }),
        'utf8',
      );
      runUninstall(ctx(root, { dryRun: true }));
      assert.equal(existsSync(join(root, '.harness', 'engine', 'keep.md')), true);
      assert.equal(existsSync(join(root, '.harness', 'manifest.json')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
