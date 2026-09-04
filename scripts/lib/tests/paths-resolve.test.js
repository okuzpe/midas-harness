import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProjectRootFromScript } from '../../paths.mjs';

describe('resolveProjectRootFromScript', () => {
  it('walks up from scripts/safety/lib to the engine root', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-paths-engine-'));
    try {
      const lib = join(root, 'scripts', 'safety', 'lib');
      mkdirSync(lib, { recursive: true });
      mkdirSync(join(root, 'harness'), { recursive: true });
      mkdirSync(join(root, 'scripts'), { recursive: true });
      writeFileSync(join(root, 'harness', 'VERSION'), '0.0.0\n', 'utf8');
      writeFileSync(join(root, 'scripts', 'test.mjs'), '// stub\n', 'utf8');
      const got = resolveProjectRootFromScript(pathToFileURL(join(lib, 'hook-io.mjs')).href);
      assert.equal(got, root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('walks up from .harness/scripts to the product root', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-paths-product-'));
    try {
      const scripts = join(root, '.harness', 'scripts');
      mkdirSync(scripts, { recursive: true });
      writeFileSync(join(root, '.harness', 'state.yaml'), 'role: product\n', 'utf8');
      const got = resolveProjectRootFromScript(pathToFileURL(join(scripts, 'doctor.mjs')).href);
      assert.equal(got, root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
