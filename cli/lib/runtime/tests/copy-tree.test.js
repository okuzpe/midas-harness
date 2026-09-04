import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyVendorRemovals } from '../copy-tree.mjs';

describe('applyVendorRemovals', () => {
  it('refuses traversal paths and does not delete outside the target', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-copy-tree-'));
    try {
      const target = join(root, 'proj');
      mkdirSync(target, { recursive: true });
      writeFileSync(join(root, 'secret.txt'), 'keep', 'utf8');
      const ctx = {
        target,
        template: '',
        update: true,
        migrate: false,
        force: false,
        written: [],
        skipped: [],
      };
      assert.throws(
        () => applyVendorRemovals(ctx, { delete: [{ path: '../secret.txt' }] }),
        /escapes/,
      );
      assert.equal(readFileSync(join(root, 'secret.txt'), 'utf8'), 'keep');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
