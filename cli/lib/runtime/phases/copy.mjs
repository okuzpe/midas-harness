// copy.mjs — install phase: copy template + vendor reconcile.

import { mkdirSync } from 'node:fs';

/**
 * @param {object} bag createExecuteHandler mutable bag
 */
export async function applyPhaseCopy(bag) {
  mkdirSync(bag.TARGET, { recursive: true });
  if (bag.update && !bag.migrate) await bag.runUpdatePreflight();
  bag.resetFreshVendorTreesLocal();
  const reconcilePlan = bag.update ? bag.planVendorReconcile() : null;
  if (reconcilePlan) {
    const preserved = bag.preserveVendorConflicts(reconcilePlan);
    if (preserved.dir) {
      bag.vendorConflictBackup = preserved;
      console.warn(
        `create-midas: ${preserved.paths.length} locally-modified vendor file(s) saved to ${preserved.dir}`,
      );
    }
  }
  bag.copyTree(bag.TEMPLATE, bag.TARGET);
  bag.maybeFail('after-copy-tree');
  if (reconcilePlan) {
    bag.vendorRemovals = bag.applyVendorRemovals(reconcilePlan);
    bag.vendorUntracked = (reconcilePlan.untracked || []).map((entry) => entry.path);
    if (bag.installAutonomy) bag.pruneStaleAutonomyVendor();
  }
  bag.maybeFail('after-layout');
}
