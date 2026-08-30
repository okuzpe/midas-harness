import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAdapters } from '../compute-adapters.mjs';
import { resolveExportPaths, VALID_PROFILES } from '../export-paths.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('computeAdapters', () => {
  it('returns adapter files for the engine repo', () => {
    const result = computeAdapters(ROOT);
    assert.ok(result.hash);
    assert.ok(Array.isArray(result.files));
    assert.ok(result.files.length > 0);
    const paths = result.files.map((f) => f.path);
    assert.ok(paths.includes('.cursor/rules/00-midas.mdc'));
  });
});

describe('resolveExportPaths', () => {
  it('lists knowledge files for the knowledge profile', () => {
    const result = resolveExportPaths(ROOT, { profile: 'knowledge' });
    assert.ok(Array.isArray(result.files));
    assert.ok(VALID_PROFILES.has('knowledge'));
  });
});
