// ownership-manifest.mjs — install phase: version stamp + ownership ledger.

import { join } from 'node:path';
import { bundledVendorPaths, writeOwnershipManifest } from '../../shared/ownership-manifest.mjs';
import { installMidasShims } from '../user-shim.mjs';

/**
 * @param {object} bag
 * @param {object} session
 */
export async function applyOwnershipManifest(bag, session) {
  const paths = session.paths || await bag.loadPaths(bag.TARGET);
  session.paths = paths;
  bag.updatedTo = bag.bumpVersionStamp(paths);
  try {
    installMidasShims({ target: bag.TARGET });
  } catch (err) {
    console.warn(`create-midas: midas shim skipped — ${err instanceof Error ? err.message : err}`);
  }
  const installedVersion = (bag.readMaybe(join(bag.TARGET, paths.version)) || '0.0.0').trim();
  writeOwnershipManifest(bag.TARGET, installedVersion, {
    ...bag.channelMeta,
    vendorAllowlist: bundledVendorPaths(bag.TEMPLATE, bag.TARGET),
  });
}
