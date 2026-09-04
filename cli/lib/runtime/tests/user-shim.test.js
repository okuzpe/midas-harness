import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTempInstall, pathListHasDir, installMidasShims } from '../user-shim.mjs';

describe('midas shim', () => {
  it('matches Windows PATH entries case-insensitively', () => {
    assert.equal(
      pathListHasDir('C:\\Users\\Me\\.midas\\bin;C:\\Windows', 'c:\\users\\me\\.midas\\bin\\'),
      true,
    );
    assert.equal(pathListHasDir('C:\\Windows', 'c:\\users\\me\\.midas\\bin'), false);
  });

  it('writes .harness/bin and skips the user PATH for temp installs', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-shim-unit-'));
    try {
      assert.equal(isTempInstall(root), true);
      const shim = installMidasShims({ target: root });
      assert.equal(shim.userBin, null);
      assert.equal(shim.pathUpdated, false);
      assert.equal(
        existsSync(join(root, '.harness', 'bin', 'midas.cmd')) ||
          existsSync(join(root, '.harness', 'bin', 'midas')),
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
