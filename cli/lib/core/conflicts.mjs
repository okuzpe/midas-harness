// conflicts.mjs — read-only vendor / generated-mirror drift assessment for update.
//
// Drift is reported, never silently discarded. Locally-modified vendor files are overwritten by the
// bundle during reconcile, with the local version copied aside first (see copy-tree.mjs), so a
// large drift set is informational rather than a hard stop.

import {
  findVendorConflicts,
  findGeneratedMirrorConflicts,
  readOwnershipManifest,
} from '../shared/ownership-manifest.mjs';

/**
 * Read-only update conflict assessment. Never writes.
 * @param {string} targetDir
 * @returns {{
 *   manifest: object|null,
 *   vendorConflicts: string[],
 *   mirrorConflicts: string[],
 * }}
 */
export function assessUpdateConflicts(targetDir) {
  const manifest = readOwnershipManifest(targetDir);
  if (!manifest) {
    return { manifest: null, vendorConflicts: [], mirrorConflicts: [] };
  }
  return {
    manifest,
    vendorConflicts: findVendorConflicts(targetDir, manifest),
    mirrorConflicts: findGeneratedMirrorConflicts(targetDir, manifest),
  };
}

export { findVendorConflicts, findGeneratedMirrorConflicts, readOwnershipManifest };
