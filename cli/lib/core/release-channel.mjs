// release-channel.mjs — read a published channel manifest so a project can learn about a new
// engine build, and verify that the bundle it was handed matches what CI published.
//
// Offline-first: every network path degrades to the on-disk cache and then to "unknown", and
// nothing here ever blocks an update. The point is discovery and integrity, not gatekeeping.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { MIDAS_REPO } from './install-cmd.mjs';
import { treeSha256 } from '../shared/ownership-manifest.mjs';
import { scanVendorTree } from '../shared/lib/reconcile.mjs';

export const CHANNELS = Object.freeze(['stable', 'edge']);
export const DEFAULT_CHANNEL = 'stable';
export const RELEASE_BRANCH = 'releases';
export const DEFAULT_TIMEOUT_MS = 3000;

/** Published manifest URL for a channel. */
export function channelUrl(channel) {
  return `https://raw.githubusercontent.com/${MIDAS_REPO}/${RELEASE_BRANCH}/${channel}.json`;
}

/** Cache path for a fetched channel manifest (gitignored under `.harness/cache/`). */
export function channelCachePath(root, channel) {
  return join(root, '.harness', 'cache', 'update', `${channel}.json`);
}

/**
 * Channel precedence: explicit flag, then whatever the install recorded, then `stable`.
 * `edge` tracks every push to main and must always be opt-in.
 */
export function resolveChannel({ flag = null, installedManifest = null } = {}) {
  const candidate = flag || installedManifest?.channel || DEFAULT_CHANNEL;
  return CHANNELS.includes(candidate) ? candidate : DEFAULT_CHANNEL;
}

function parseManifest(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed.tree_sha256 !== 'string') {
    throw new Error('release manifest has no tree_sha256');
  }
  return parsed;
}

export function readCachedChannelManifest(root, channel) {
  const path = channelCachePath(root, channel);
  if (!existsSync(path)) return null;
  try {
    return parseManifest(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function writeCachedChannelManifest(root, channel, manifest) {
  const path = channelCachePath(root, channel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return path;
}

/**
 * Fetch a channel manifest, falling back to cache.
 *
 * @param {string} root project root (for the cache)
 * @param {string} channel
 * @param {{ timeoutMs?: number, offline?: boolean, manifestFile?: string|null, fetchImpl?: Function }} [opts]
 * @returns {Promise<{ manifest: object|null, source: 'file'|'network'|'cache'|'none', error: string|null }>}
 */
export async function fetchReleaseManifest(root, channel, opts = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, offline = false, manifestFile = null } = opts;

  if (manifestFile) {
    try {
      const manifest = parseManifest(readFileSync(resolve(manifestFile), 'utf8'));
      return { manifest, source: 'file', error: null };
    } catch (err) {
      return { manifest: null, source: 'none', error: `--manifest-file unreadable: ${err.message}` };
    }
  }

  if (offline) {
    const cached = readCachedChannelManifest(root, channel);
    return { manifest: cached, source: cached ? 'cache' : 'none', error: cached ? null : 'offline and no cached manifest' };
  }

  const doFetch = opts.fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') {
    const cached = readCachedChannelManifest(root, channel);
    return { manifest: cached, source: cached ? 'cache' : 'none', error: 'no fetch available in this runtime' };
  }

  // A manual controller instead of `AbortSignal.timeout()`: that helper leaves its timer armed when
  // the response arrives first, and the stray handle is enough to abort the process on exit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    const res = await doFetch(channelUrl(channel), {
      signal: controller.signal,
      // `connection: close` matters more than it looks: a keep-alive socket outlives the response,
      // and a short-lived CLI that exits with one still open trips a libuv assertion on Windows.
      headers: { accept: 'application/json', connection: 'close' },
    });
    if (!res.ok) {
      // Drain the body: an unread stream holds the socket open past our exit.
      await res.arrayBuffer().catch(() => {});
      throw new Error(`HTTP ${res.status}`);
    }
    const manifest = parseManifest(await res.text());
    try {
      writeCachedChannelManifest(root, channel, manifest);
    } catch { /* cache is best-effort */ }
    return { manifest, source: 'network', error: null };
  } catch (err) {
    const cached = readCachedChannelManifest(root, channel);
    return {
      manifest: cached,
      source: cached ? 'cache' : 'none',
      error: `channel fetch failed (${err.message || err})`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Does the installed tree already match what the channel publishes?
 * Returns `null` for `upToDate` when the comparison cannot be made (v1 manifest, no channel data).
 */
export function compareInstalledToChannel(installedManifest, channelManifest) {
  const local = installedManifest?.tree_sha256 || null;
  const remote = channelManifest?.tree_sha256 || null;
  if (!local || !remote) {
    return {
      upToDate: null,
      local,
      remote,
      reason: !local
        ? 'installed manifest predates content hashing — the next update records it'
        : 'no channel manifest available',
    };
  }
  const upToDate = local === remote;
  return {
    upToDate,
    local,
    remote,
    reason: upToDate
      ? `up to date with ${channelManifest.channel} (${remote.slice(0, 12)})`
      : `${channelManifest.channel} publishes ${remote.slice(0, 12)}, installed is ${local.slice(0, 12)}`,
  };
}

/**
 * Integrity check: does the bundle npx handed us match what CI published for this channel?
 * A mismatch on `stable` means the payload is not the published release.
 */
export function verifyTemplateAgainstManifest(templateRoot, channelManifest) {
  if (!channelManifest?.tree_sha256) {
    return { ok: null, reason: 'no channel manifest to verify against' };
  }
  const actual = treeSha256(scanVendorTree(templateRoot));
  const ok = actual === channelManifest.tree_sha256;
  return {
    ok,
    actual,
    expected: channelManifest.tree_sha256,
    reason: ok
      ? `bundle matches ${channelManifest.channel} ${actual.slice(0, 12)}`
      : `bundle ${actual.slice(0, 12)} does not match published ${channelManifest.channel} ${channelManifest.tree_sha256.slice(0, 12)}`,
  };
}
