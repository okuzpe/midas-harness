// conflicts.mjs — read-only vendor / generated-mirror conflict checks for update.

import {
  findVendorConflicts,
  findGeneratedMirrorConflicts,
  readOwnershipManifest,
} from '../../template/.harness/scripts/ownership-manifest.mjs';
import { isConflictVendorPath } from './preserve-policy.mjs';

/** True when many vendor hashes drifted (typical after engine bump without manifest rewrite). */
export function isStaleManifestDrift(conflicts) {
  return conflicts.length >= 5 && conflicts.every(isConflictVendorPath);
}

/**
 * Read-only update conflict assessment. Never writes.
 * @param {string} targetDir
 * @returns {{
 *   manifest: object|null,
 *   vendorConflicts: string[],
 *   mirrorConflicts: string[],
 *   staleDrift: boolean,
 *   needsRebaseline: boolean,
 * }}
 */
export function assessUpdateConflicts(targetDir) {
  const manifest = readOwnershipManifest(targetDir);
  if (!manifest) {
    return {
      manifest: null,
      vendorConflicts: [],
      mirrorConflicts: [],
      staleDrift: false,
      needsRebaseline: false,
    };
  }
  let vendorConflicts = findVendorConflicts(targetDir, manifest);
  const staleDrift = vendorConflicts.length > 0 && isStaleManifestDrift(vendorConflicts);
  // Stale drift is deferred to execute (rebaseline after confirm) — not a hard fail.
  const hardVendor = staleDrift ? [] : vendorConflicts;
  const mirrorConflicts = findGeneratedMirrorConflicts(targetDir, manifest);
  return {
    manifest,
    vendorConflicts: hardVendor,
    mirrorConflicts,
    staleDrift,
    needsRebaseline: staleDrift,
  };
}

export { findVendorConflicts, findGeneratedMirrorConflicts, readOwnershipManifest };
