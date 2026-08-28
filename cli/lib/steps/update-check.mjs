// update-check.mjs — read-only "is there anything new?" against a published release channel.
//
// This is the cheap discovery path: a few KB of JSON instead of a bundle download. It never writes
// to the project beyond the channel cache, and never fails the caller for being offline.

import {
  compareInstalledToChannel,
  fetchReleaseManifest,
  resolveChannel,
} from '../core/release-channel.mjs';
import { readOwnershipManifest } from '../../template/.harness/scripts/ownership-manifest.mjs';
import { formatUpdateCmdFromRelease } from '../core/install-cmd.mjs';

/** Exit codes: 0 up to date, 1 update available, 2 undetermined. */
export const UPDATE_CHECK_EXIT = Object.freeze({ current: 0, available: 1, unknown: 2 });

/**
 * @param {string} target project root
 * @param {{ channel?: string|null, offline?: boolean, manifestFile?: string|null }} cmd
 * @returns {Promise<{ exitCode: number, status: string, channel: string, message: string, local: string|null, remote: string|null }>}
 */
export async function runUpdateCheck(target, cmd = {}) {
  const installedManifest = readOwnershipManifest(target);
  const channel = resolveChannel({ flag: cmd.channel, installedManifest });

  if (!installedManifest) {
    return {
      exitCode: UPDATE_CHECK_EXIT.unknown,
      status: 'not_installed',
      channel,
      local: null,
      remote: null,
      message: 'create-midas: no .harness/manifest.json here — nothing installed to check',
    };
  }

  const fetched = await fetchReleaseManifest(target, channel, {
    offline: cmd.offline,
    manifestFile: cmd.manifestFile,
  });
  const comparison = compareInstalledToChannel(installedManifest, fetched.manifest);

  if (comparison.upToDate === null) {
    return {
      exitCode: UPDATE_CHECK_EXIT.unknown,
      status: 'unknown',
      channel,
      local: comparison.local,
      remote: comparison.remote,
      message: `create-midas: cannot determine — ${fetched.error || comparison.reason}`,
    };
  }
  if (comparison.upToDate) {
    return {
      exitCode: UPDATE_CHECK_EXIT.current,
      status: 'current',
      channel,
      local: comparison.local,
      remote: comparison.remote,
      message: `create-midas: ${comparison.reason}`,
    };
  }
  const pin = formatUpdateCmdFromRelease(fetched.manifest, { channel });
  return {
    exitCode: UPDATE_CHECK_EXIT.available,
    status: 'available',
    channel,
    local: comparison.local,
    remote: comparison.remote,
    message:
      `create-midas: update available — ${comparison.reason}\n` +
      `  run: ${pin}\n` +
      '  (--check never downloads the bundle; re-run that command to apply it)',
  };
}
