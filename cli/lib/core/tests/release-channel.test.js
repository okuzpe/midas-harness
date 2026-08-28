import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  channelCachePath,
  channelUrl,
  compareInstalledToChannel,
  fetchReleaseManifest,
  readCachedChannelManifest,
  resolveChannel,
  verifyTemplateAgainstManifest,
} from '../release-channel.mjs';

const REMOTE = { schema_version: 1, channel: 'edge', tree_sha256: 'b'.repeat(64), ref: 'main' };

function project() {
  return mkdtempSync(join(tmpdir(), 'midas-release-channel-'));
}

function ok(body) {
  return async () => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
}

describe('resolveChannel', () => {
  it('defaults to stable so edge is always opt-in', () => {
    assert.equal(resolveChannel(), 'stable');
    assert.equal(resolveChannel({ installedManifest: { channel: null } }), 'stable');
    assert.equal(resolveChannel({ flag: 'nightly' }), 'stable');
  });

  it('prefers the flag, then the recorded channel', () => {
    assert.equal(resolveChannel({ flag: 'edge' }), 'edge');
    assert.equal(resolveChannel({ installedManifest: { channel: 'edge' } }), 'edge');
    assert.equal(resolveChannel({ flag: 'stable', installedManifest: { channel: 'edge' } }), 'stable');
  });
});

describe('channelUrl', () => {
  it('points at the orphan releases branch', () => {
    assert.equal(channelUrl('edge'), 'https://raw.githubusercontent.com/okuzpe/midas-harness/releases/edge.json');
  });
});

describe('fetchReleaseManifest', () => {
  it('caches a fetched manifest for later offline use', async () => {
    const root = project();
    try {
      const first = await fetchReleaseManifest(root, 'edge', { fetchImpl: ok(REMOTE) });
      assert.equal(first.source, 'network');
      assert.equal(first.manifest.tree_sha256, REMOTE.tree_sha256);
      assert.equal(readCachedChannelManifest(root, 'edge').tree_sha256, REMOTE.tree_sha256);

      const offline = await fetchReleaseManifest(root, 'edge', { offline: true });
      assert.equal(offline.source, 'cache');
      assert.equal(offline.manifest.tree_sha256, REMOTE.tree_sha256);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('degrades to the cache when the network fails, never throwing', async () => {
    const root = project();
    try {
      await fetchReleaseManifest(root, 'edge', { fetchImpl: ok(REMOTE) });
      const failing = async () => { throw new Error('ENOTFOUND'); };
      const result = await fetchReleaseManifest(root, 'edge', { fetchImpl: failing });
      assert.equal(result.source, 'cache');
      assert.match(result.error, /channel fetch failed/);
      assert.equal(result.manifest.tree_sha256, REMOTE.tree_sha256);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports no manifest when offline with an empty cache', async () => {
    const root = project();
    try {
      const result = await fetchReleaseManifest(root, 'stable', { offline: true });
      assert.equal(result.manifest, null);
      assert.equal(result.source, 'none');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads an injected manifest file without touching the network', async () => {
    const root = project();
    try {
      const path = join(root, 'local.json');
      writeFileSync(path, JSON.stringify(REMOTE), 'utf8');
      const result = await fetchReleaseManifest(root, 'edge', {
        manifestFile: path,
        fetchImpl: () => { throw new Error('must not be called'); },
      });
      assert.equal(result.source, 'file');
      assert.equal(result.manifest.tree_sha256, REMOTE.tree_sha256);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a manifest with no tree hash', async () => {
    const root = project();
    try {
      const result = await fetchReleaseManifest(root, 'edge', { fetchImpl: ok({ channel: 'edge' }) });
      assert.equal(result.manifest, null);
      assert.match(result.error, /tree_sha256|fetch failed/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes its cache inside the gitignored .harness/cache tree', () => {
    assert.match(
      channelCachePath('/p', 'edge').replace(/\\/g, '/'),
      /\.harness\/cache\/update\/edge\.json$/,
    );
  });
});

describe('compareInstalledToChannel', () => {
  it('detects up-to-date and behind', () => {
    const same = compareInstalledToChannel({ tree_sha256: REMOTE.tree_sha256 }, REMOTE);
    assert.equal(same.upToDate, true);
    const behind = compareInstalledToChannel({ tree_sha256: 'a'.repeat(64) }, REMOTE);
    assert.equal(behind.upToDate, false);
    assert.match(behind.reason, /edge publishes/);
  });

  it('returns unknown rather than guessing when either side lacks a hash', () => {
    assert.equal(compareInstalledToChannel({ tree_sha256: null }, REMOTE).upToDate, null);
    assert.equal(compareInstalledToChannel({ tree_sha256: 'a'.repeat(64) }, null).upToDate, null);
  });
});

describe('verifyTemplateAgainstManifest', () => {
  it('flags a bundle that does not match the published hash', () => {
    const root = project();
    try {
      mkdirSync(join(root, '.harness', 'engine'), { recursive: true });
      writeFileSync(join(root, '.harness', 'engine', 'a.md'), 'a', 'utf8');
      const mismatch = verifyTemplateAgainstManifest(root, REMOTE);
      assert.equal(mismatch.ok, false);
      const match = verifyTemplateAgainstManifest(root, { ...REMOTE, tree_sha256: mismatch.actual });
      assert.equal(match.ok, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('stays neutral when there is nothing to verify against', () => {
    assert.equal(verifyTemplateAgainstManifest('/p', null).ok, null);
  });
});

describe('cached manifest', () => {
  it('ignores a corrupt cache file', () => {
    const root = project();
    try {
      const path = channelCachePath(root, 'edge');
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, '{ not json', 'utf8');
      assert.equal(readCachedChannelManifest(root, 'edge'), null);
      assert.equal(readFileSync(path, 'utf8'), '{ not json');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
