// conflicts.mjs — read-only vendor / generated-mirror conflict checks for update.

import {
  findVendorConflicts,
  findGeneratedMirrorConflicts,
  readOwnershipManifest,
} from '../../template/.harness/scripts/ownership-manifest.mjs';

function isVendorManagedPath(rel) {
  return (
    rel.startsWith('.harness/engine/') ||
    rel.startsWith('.harness/scripts/') ||
    // Optional autonomy capability is vendor-owned except user runtime files
    // (policy.yaml, control.json, …) which are never hash-checked.
    (rel.startsWith('.harness/autonomy/') &&
      !rel.startsWith('.harness/autonomy/authz/') &&
      !rel.endsWith('/policy.yaml') &&
      !rel.endsWith('/control.json') &&
      !rel.endsWith('/budget-ledger.json') &&
      !rel.endsWith('/journal-anchor.json'))
  );
}

/** True when many vendor hashes drifted (typical after engine bump without manifest rewrite). */
export function isStaleManifestDrift(conflicts) {
  return conflicts.length >= 5 && conflicts.every(isVendorManagedPath);
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
