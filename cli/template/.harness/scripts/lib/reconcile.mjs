// reconcile.mjs — manifest-driven reconciliation of the vendor trees on update.
//
// The installed manifest records what the last install laid down; the bundle records what this
// install should lay down; the disk records what is actually there. Diffing the three tells us
// exactly what to create, refresh, overwrite-with-backup, or delete — including files and whole
// directories dropped from the engine, which a template-only copy can never notice.
//
// Scope is deliberately narrow: only `vendor` files under the reconcile roots. Generated adapters
// and host mirrors are re-derived by render (they depend on `state.tools`, not on the bundle), and
// user files are never touched.

import { join } from 'node:path';
import {
  CHANNEL_TREE_ROOTS,
  roleForPath,
  sha256File,
  vendorFilesOf,
} from '../ownership-manifest.mjs';
import { walkFiles } from './walk.mjs';

/**
 * Same as CHANNEL_TREE_ROOTS: the bundle ships these at the same relative path it installs to.
 * `.harness/autonomy` is excluded — it lives under `.optional/autonomy` and has its own opt-in
 * prune path, so reconciling it here would read as "dropped from the bundle" and delete a working
 * install. The alias keeps call sites reading as "what reconcile covers".
 */
export const RECONCILE_ROOTS = CHANNEL_TREE_ROOTS;

function normalize(rel) {
  return String(rel).replace(/\\/g, '/');
}

/** True when `rel` sits under one of `roots`. */
export function isUnderRoots(rel, roots = RECONCILE_ROOTS) {
  const n = normalize(rel);
  return roots.some((root) => n === root || n.startsWith(`${root}/`));
}

function toMap(files, inScope) {
  const map = new Map();
  for (const file of files || []) {
    const path = normalize(file.path);
    if (!inScope(path)) continue;
    map.set(path, file.sha256 ?? null);
  }
  return map;
}

function byPath(a, b) {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/**
 * Pure three-way reconciliation. No I/O — callers pass hashed file lists.
 *
 * @param {{
 *   oldManifest?: object|null,
 *   newVendorFiles?: {path: string, sha256: string|null}[],
 *   diskScan?: {path: string, sha256: string|null}[],
 *   roots?: readonly string[],
 * }} input
 * @returns {{
 *   create: {path: string, reason: string}[],
 *   refresh: {path: string, reason: string}[],
 *   modified: {path: string, reason: string}[],
 *   delete: {path: string, reason: string, modified: boolean}[],
 *   keep: {path: string, reason: string}[],
 *   untracked: {path: string, reason: string}[],
 * }}
 */
export function planReconcile(input = {}) {
  const {
    oldManifest = null,
    newVendorFiles = [],
    diskScan = [],
    roots = RECONCILE_ROOTS,
  } = input;

  const inScope = (path) => isUnderRoots(path, roots) && roleForPath(path) === 'vendor';
  const oldMap = toMap(vendorFilesOf(oldManifest), inScope);
  const newMap = toMap(newVendorFiles, inScope);
  const diskMap = toMap(diskScan, inScope);

  const create = [];
  const refresh = [];
  const modified = [];
  const removals = [];
  const keep = [];
  const untracked = [];

  for (const [path, newSha] of newMap) {
    if (!diskMap.has(path)) {
      create.push({ path, reason: 'new in this bundle' });
      continue;
    }
    const diskSha = diskMap.get(path);
    if (diskSha === newSha) {
      keep.push({ path, reason: 'already current' });
      continue;
    }
    if (oldMap.has(path) && diskMap.get(path) === oldMap.get(path)) {
      refresh.push({ path, reason: 'unmodified since last install' });
      continue;
    }
    modified.push({
      path,
      reason: oldMap.has(path) ? 'edited since last install' : 'present but not in the manifest',
    });
  }

  for (const [path, oldSha] of oldMap) {
    if (newMap.has(path) || !diskMap.has(path)) continue;
    removals.push({
      path,
      reason: 'dropped from this bundle',
      modified: diskMap.get(path) !== oldSha,
    });
  }

  for (const path of diskMap.keys()) {
    if (newMap.has(path) || oldMap.has(path)) continue;
    untracked.push({ path, reason: 'untracked inside a vendor root' });
  }

  return {
    create: create.sort(byPath),
    refresh: refresh.sort(byPath),
    modified: modified.sort(byPath),
    delete: removals.sort(byPath),
    keep: keep.sort(byPath),
    untracked: untracked.sort(byPath),
  };
}

/**
 * Hash every vendor file under `roots` in `root`. Used for both the installed tree and the bundle,
 * which share the same relative layout.
 * @returns {{path: string, sha256: string}[]}
 */
export function scanVendorTree(root, { roots = RECONCILE_ROOTS } = {}) {
  const out = [];
  for (const rootRel of roots) {
    const abs = join(root, rootRel);
    for (const rel of walkFiles(abs, { relativeTo: root, exclude: [] })) {
      const path = normalize(rel);
      if (roleForPath(path) !== 'vendor') continue;
      out.push({ path, sha256: sha256File(join(root, path)) });
    }
  }
  return out.sort(byPath);
}

/** Paths this plan will remove from disk. Untracked files are reported, never deleted. */
export function reconcileRemovals(plan) {
  return (plan.delete || []).map((entry) => entry.path).sort();
}

/**
 * Local edits that must be copied aside before overwrite or delete.
 * Untracked files are not in this list: they are left on disk.
 */
export function reconcilePreservedEdits(plan) {
  return [
    ...(plan.modified || []),
    ...(plan.delete || []).filter((entry) => entry.modified),
  ];
}

/** One-line counts for CLI reporting. */
export function formatReconcileSummary(plan) {
  return [
    `${plan.create.length} new`,
    `${plan.refresh.length} refreshed`,
    `${plan.modified.length} overwritten (local edits saved)`,
    `${plan.delete.length} removed`,
    `${plan.untracked.length} untracked (left in place)`,
    `${plan.keep.length} unchanged`,
  ].join(', ');
}
