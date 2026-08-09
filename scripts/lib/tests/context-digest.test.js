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
import {
  buildDigest,
  queryDigest,
  readDigest,
  resolveDigestPath,
  validateDigest,
  writeDigest,
} from '../context-digest.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-context-digest-${suffix}-`));
}

describe('context-digest', () => {
  it('resolveDigestPath prefers runs/cache for engine-style roots', () => {
    const root = makeProject('engine');
    try {
      const path = resolveDigestPath(root);
      assert.equal(path, join(root, 'runs', 'cache', 'context', 'digest.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolveDigestPath prefers .harness/cache when .harness exists', () => {
    const root = makeProject('harness');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      const path = resolveDigestPath(root);
      assert.equal(path, join(root, '.harness', 'cache', 'context', 'digest.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buildDigest walks preferred dirs and skips node_modules', () => {
    const root = makeProject('walk');
    try {
      mkdirSync(join(root, 'scripts', 'lib'), { recursive: true });
      mkdirSync(join(root, 'scripts', 'node_modules', 'pkg'), { recursive: true });
      writeFileSync(join(root, 'scripts', 'lib', 'alpha.mjs'), 'export const a = 1;\n', 'utf8');
      writeFileSync(join(root, 'scripts', 'node_modules', 'pkg', 'skip.mjs'), 'skip\n', 'utf8');

      const digest = buildDigest(root, { maxFiles: 50 });
      assert.equal(digest.schema_version, 1);
      assert.ok(validateDigest(digest));
      assert.ok(digest.files.some((f) => f.path === 'scripts/lib/alpha.mjs'));
      assert.equal(digest.files.some((f) => f.path.includes('node_modules')), false);
      assert.equal(digest.files.find((f) => f.path === 'scripts/lib/alpha.mjs')?.ext, '.mjs');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buildDigest indexes installed product source trees', () => {
    const root = makeProject('product');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      writeFileSync(join(root, '.harness', 'state.yaml'), 'layout: harness\n', 'utf8');
      mkdirSync(join(root, '.harness', 'product', 'src'), { recursive: true });
      writeFileSync(join(root, '.harness', 'product', 'src', 'app.ts'), 'export {};\n', 'utf8');

      const digest = buildDigest(root, { maxFiles: 50 });
      assert.ok(digest.files.some((f) => f.path === '.harness/product/src/app.ts'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buildDigest respects maxFiles cap', () => {
    const root = makeProject('cap');
    try {
      mkdirSync(join(root, 'lib'), { recursive: true });
      for (let i = 0; i < 10; i += 1) {
        writeFileSync(join(root, 'lib', `file-${i}.txt`), 'x', 'utf8');
      }
      const digest = buildDigest(root, { maxFiles: 3 });
      assert.equal(digest.files.length, 3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('queryDigest returns substring/path matches up to 20 hits', () => {
    const digest = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      files: Array.from({ length: 30 }, (_, i) => ({
        path: `scripts/lib/item-${i}.mjs`,
        bytes: 10,
        ext: '.mjs',
      })),
    };

    const hits = queryDigest(digest, 'item-2');
    assert.ok(hits.length <= 20);
    assert.ok(hits.length > 0);
    assert.ok(hits.every((h) => h.path.includes('item-2')));
    assert.deepEqual(queryDigest(null, 'x'), []);
    assert.deepEqual(queryDigest(digest, '   '), []);
  });

  it('write/read roundtrip', () => {
    const root = makeProject('roundtrip');
    try {
      mkdirSync(join(root, 'scripts'), { recursive: true });
      writeFileSync(join(root, 'scripts', 'one.mjs'), 'one\n', 'utf8');

      const written = writeDigest(root);
      assert.equal(written.schema_version, 1);
      assert.ok(written.files.length >= 1);

      const read = readDigest(root);
      assert.deepEqual(read, written);

      const path = resolveDigestPath(root);
      assert.ok(existsSync(path));
      const raw = readFileSync(path, 'utf8');
      assert.ok(raw.endsWith('\n'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
