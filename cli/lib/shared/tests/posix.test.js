import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeRelPath, resolveContained, toPosixRel } from '../posix.mjs';

describe('posix containment', () => {
  it('toPosixRel normalizes separators', () => {
    assert.equal(toPosixRel('.harness\\engine\\a.md'), '.harness/engine/a.md');
  });

  it('isSafeRelPath rejects traversal and absolute paths', () => {
    assert.equal(isSafeRelPath('.harness/engine/rules/a.md'), true);
    assert.equal(isSafeRelPath('.harness/engine/../../package.json'), false);
    assert.equal(isSafeRelPath('../secrets'), false);
    assert.equal(isSafeRelPath('/etc/passwd'), false);
    assert.equal(isSafeRelPath('C:/Windows'), false);
    assert.equal(isSafeRelPath(''), false);
  });

  it('resolveContained refuses to leave the project root', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-posix-'));
    try {
      mkdirSync(join(root, '.harness', 'engine'), { recursive: true });
      writeFileSync(join(root, 'secret.txt'), 'keep', 'utf8');
      const inside = resolveContained(root, '.harness/engine/VERSION');
      assert.equal(inside, join(root, '.harness', 'engine', 'VERSION'));
      assert.throws(() => resolveContained(root, '../secret.txt'), /escapes/);
      assert.throws(() => resolveContained(root, '.harness/engine/../../secret.txt'), /escapes/);
      assert.equal(readFileSync(join(root, 'secret.txt'), 'utf8'), 'keep');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
