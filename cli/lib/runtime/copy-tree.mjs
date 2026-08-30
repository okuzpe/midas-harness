// copy-tree.mjs — template → target copy + manifest-driven vendor reconciliation for install/update.

import { existsSync, mkdirSync, copyFileSync, rmSync, rmdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { decideTemplateCopyAction } from '../core/preserve-policy.mjs';
import { walkTemplate } from '../core/walk-template.mjs';
import { readOwnershipManifest } from '../shared/ownership-manifest.mjs';
import {
  RECONCILE_ROOTS,
  planReconcile,
  reconcilePreservedEdits,
  reconcileRemovals,
  scanVendorTree,
} from '../shared/lib/reconcile.mjs';

/**
 * @typedef {{
 *   target: string,
 *   template: string,
 *   update: boolean,
 *   migrate: boolean,
 *   force: boolean,
 *   written: string[],
 *   skipped: string[],
 * }} CopyCtx
 */

/** Wipe engine/scripts on fresh install so copy starts clean. */
export function resetFreshVendorTrees(ctx) {
  if (ctx.update || ctx.migrate) return;
  for (const rel of ['.harness/engine', '.harness/scripts']) {
    rmSync(join(ctx.target, rel), { recursive: true, force: true });
  }
}

/**
 * Recursive template copy with preserve/skip policy matching plan-tree.
 * @param {string} srcDir
 * @param {string} dstDir
 * @param {CopyCtx} ctx
 */
export function copyTree(srcDir, dstDir, ctx) {
  walkTemplate(srcDir, dstDir, { target: ctx.target }, (node) => {
    if (node.type === 'dir') {
      mkdirSync(node.dst, { recursive: true });
      return;
    }
    const decided = decideTemplateCopyAction(node.rel, {
      exists: existsSync(node.dst),
      force: ctx.force,
      update: ctx.update,
    });
    if (decided.action === 'skip') {
      ctx.skipped.push(node.rel);
      return;
    }
    mkdirSync(dirname(node.dst), { recursive: true });
    copyFileSync(node.src, node.dst);
    ctx.written.push(node.rel);
  });
}

/** Where a vendor file you edited is preserved when the bundle overwrites it. */
export const VENDOR_CONFLICTS_DIR = '.harness/conflicts';

/**
 * Diff installed manifest × bundle × disk for the vendor roots.
 * Read-only: safe to call during a dry run.
 * @returns {ReturnType<typeof planReconcile> | null} null when there is no baseline to diff against
 */
export function planVendorReconcile(ctx) {
  const oldManifest = readOwnershipManifest(ctx.target);
  return planReconcile({
    oldManifest,
    newVendorFiles: scanVendorTree(ctx.template),
    diskScan: scanVendorTree(ctx.target),
  });
}

/**
 * Copy locally-edited vendor files aside before the bundle overwrites or deletes them.
 *
 * Covers two cases: still-shipped files that will be overwritten, and files the bundle dropped
 * whose disk bytes no longer match the last install. Untracked files are not copied and not
 * deleted — they were never in a manifest, so they stay put.
 *
 * Vendor is vendor: the bundle wins. The edit lands in `.harness/conflicts/`, and `doctor` reports
 * it until the user clears it. Deliberately *not* under `.harness/cache/`: that tree is gitignored
 * and scrubbed on rollback.
 *
 * @returns {{ dir: string|null, paths: string[] }}
 */
export function preserveVendorConflicts(ctx, plan) {
  const toSave = reconcilePreservedEdits(plan);
  if (!toSave.length) return { dir: null, paths: [] };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dirRel = `${VENDOR_CONFLICTS_DIR}/${stamp}`;
  const paths = [];
  for (const entry of toSave) {
    const src = join(ctx.target, entry.path);
    if (!existsSync(src)) continue;
    const dst = join(ctx.target, dirRel, `${entry.path}.midas-conflict`);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    paths.push(entry.path);
  }
  return { dir: paths.length ? dirRel : null, paths };
}

/** Remove empty directories under the vendor roots, leaving the roots themselves in place. */
function pruneEmptyVendorDirs(ctx, roots = RECONCILE_ROOTS) {
  const visit = (rel) => {
    const abs = join(ctx.target, rel);
    if (!existsSync(abs)) return true;
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return false;
    }
    let empty = true;
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!visit(`${rel}/${entry.name}`)) empty = false;
      } else {
        empty = false;
      }
    }
    if (empty && !roots.includes(rel)) {
      try {
        rmdirSync(abs);
        return true;
      } catch {
        return false;
      }
    }
    return empty;
  };
  for (const root of roots) visit(root);
}

/**
 * Delete vendor files the bundle dropped (already copied aside when they had local edits).
 * Untracked files inside a vendor root are left in place — they were never in a manifest.
 */
export function applyVendorRemovals(ctx, plan) {
  const removals = reconcileRemovals(plan);
  for (const rel of removals) {
    rmSync(join(ctx.target, rel), { force: true });
    ctx.written.push(`removed:${rel}`);
  }
  if (removals.length) pruneEmptyVendorDirs(ctx);
  return removals;
}
