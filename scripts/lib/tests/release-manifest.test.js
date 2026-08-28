import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseManifest, CHANNELS } from '../../release-manifest.mjs';
import { computeOwnershipManifest, treeSha256 } from '../../ownership-manifest.mjs';

function bundle(files) {
  const root = mkdtempSync(join(tmpdir(), 'midas-release-manifest-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body, 'utf8');
  }
  return root;
}

const OPTS = { channel: 'edge', version: '9.9.9', ref: 'main', commit: 'abc123', publishedAt: 'fixed' };

describe('treeSha256', () => {
  it('is independent of input order', () => {
    const a = [{ path: 'b', sha256: '2' }, { path: 'a', sha256: '1' }];
    const b = [{ path: 'a', sha256: '1' }, { path: 'b', sha256: '2' }];
    assert.equal(treeSha256(a), treeSha256(b));
  });

  it('changes when any file hash changes', () => {
    const before = treeSha256([{ path: 'a', sha256: '1' }]);
    const after = treeSha256([{ path: 'a', sha256: '2' }]);
    assert.notEqual(before, after);
  });

  it('changes when a file is added or removed', () => {
    const one = treeSha256([{ path: 'a', sha256: '1' }]);
    const two = treeSha256([{ path: 'a', sha256: '1' }, { path: 'b', sha256: '2' }]);
    assert.notEqual(one, two);
  });

  it('ignores unhashed (user-owned) entries', () => {
    const withUser = treeSha256([{ path: 'a', sha256: '1' }, { path: 'u', sha256: null }]);
    assert.equal(withUser, treeSha256([{ path: 'a', sha256: '1' }]));
  });
});

describe('buildReleaseManifest', () => {
  it('hashes the vendor tree and is stable across rebuilds of identical content', () => {
    const first = bundle({ '.harness/engine/conventions.md': 'a', '.harness/scripts/doctor.mjs': 'b' });
    const second = bundle({ '.harness/engine/conventions.md': 'a', '.harness/scripts/doctor.mjs': 'b' });
    try {
      const one = buildReleaseManifest(first, OPTS);
      const two = buildReleaseManifest(second, OPTS);
      assert.equal(one.tree_sha256, two.tree_sha256);
      assert.equal(one.files.length, 2);
      assert.equal(one.channel, 'edge');
      assert.equal(one.ref, 'main');
      assert.equal(one.commit, 'abc123');
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });

  it('changes the tree hash when engine content changes', () => {
    const before = bundle({ '.harness/engine/conventions.md': 'a' });
    const after = bundle({ '.harness/engine/conventions.md': 'a changed' });
    try {
      assert.notEqual(
        buildReleaseManifest(before, OPTS).tree_sha256,
        buildReleaseManifest(after, OPTS).tree_sha256,
      );
    } finally {
      rmSync(before, { recursive: true, force: true });
      rmSync(after, { recursive: true, force: true });
    }
  });

  it('ignores files outside the vendor roots', () => {
    const root = bundle({ '.harness/engine/a.md': 'a', 'AGENTS.md': 'user', '.harness/product/idea.md': 'user' });
    try {
      const manifest = buildReleaseManifest(root, OPTS);
      assert.deepEqual(manifest.files.map((f) => f.path), ['.harness/engine/a.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installed tree hash ignores optional autonomy vendor files (same universe as the channel)', () => {
    const without = bundle({ '.harness/engine/a.md': 'a' });
    const withAuto = bundle({
      '.harness/engine/a.md': 'a',
      '.harness/autonomy/lib/x.mjs': 'opt-in',
    });
    try {
      assert.equal(
        computeOwnershipManifest(without, '1.0.0').tree_sha256,
        computeOwnershipManifest(withAuto, '1.0.0').tree_sha256,
      );
      const autoRoles = computeOwnershipManifest(withAuto, '1.0.0').files.filter((f) =>
        f.path.startsWith('.harness/autonomy/'),
      );
      assert.equal(autoRoles[0]?.role, 'vendor');
    } finally {
      rmSync(without, { recursive: true, force: true });
      rmSync(withAuto, { recursive: true, force: true });
    }
  });

  it('lists shipped state migrations by id', () => {
    const root = bundle({
      '.harness/engine/a.md': 'a',
      '.harness/engine/state-migrations/0001-first.mjs': 'export function up() {}\n',
      '.harness/engine/state-migrations/README.md': '# not a migration\n',
    });
    try {
      assert.deepEqual(buildReleaseManifest(root, OPTS).migrations, ['0001-first']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses an unbuilt bundle and an unknown channel', () => {
    const empty = mkdtempSync(join(tmpdir(), 'midas-release-empty-'));
    const root = bundle({ '.harness/engine/a.md': 'a' });
    try {
      assert.throws(() => buildReleaseManifest(empty, OPTS), /no vendor files/);
      assert.throws(() => buildReleaseManifest(root, { ...OPTS, channel: 'nightly' }), /unknown channel/);
      assert.deepEqual([...CHANNELS], ['stable', 'edge']);
    } finally {
      rmSync(empty, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });
});
