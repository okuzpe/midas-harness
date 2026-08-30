import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { maybeHelp, isMainModule, EXIT } from '../cli-io.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('cli-io', () => {
  it('exports stable exit codes', () => {
    assert.equal(EXIT.ok, 0);
    assert.equal(EXIT.fail, 1);
    assert.equal(EXIT.usage, 2);
  });

  it('maybeHelp is a no-op when the target module is not main', () => {
    const other = pathToFileURL(join(ROOT, 'scripts', 'yaml-lite.mjs')).href;
    assert.equal(maybeHelp(other, undefined, ['--help']), false);
    assert.equal(isMainModule(other), false);
  });
});

describe('shebang CLIs --help', () => {
  for (const rel of [
    'scripts/yaml-lite.mjs',
    'scripts/coverage.mjs',
    'scripts/build-create.mjs',
    'scripts/render-adapters.mjs',
  ]) {
    it(`${rel} --help exits 0 and prints header text`, () => {
      const r = spawnSync(process.execPath, [join(ROOT, rel), '--help'], {
        encoding: 'utf8',
        cwd: ROOT,
      });
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /\S/);
      assert.doesNotMatch(r.stdout, /SyntaxError/);
    });
  }
});
