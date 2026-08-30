// plan-tree.mjs — build a dry-run plan of template copy / preserve decisions.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createPlan } from '../core/plan.mjs';
import { decideTemplateCopyAction } from '../core/preserve-policy.mjs';
import { walkTemplate } from '../core/walk-template.mjs';
import { planVendorReconcile } from '../runtime/copy-tree.mjs';

/**
 * Walk template and emit write/skip ops without touching the target.
 * @param {{ template: string, target: string, mode: string, force: boolean, update: boolean, autonomy?: boolean }} opts
 */
export function planTemplateCopy(opts) {
  const { template, target, mode, force, update, autonomy = false } = opts;
  const ops = [];
  let n = 0;

  function visit(srcDir, dstDir) {
    walkTemplate(srcDir, dstDir, { target }, (node) => {
      if (node.type === 'dir') return;
      const exists = existsSync(node.dst);
      const decided = decideTemplateCopyAction(node.rel, { exists, force, update });
      n += 1;
      const id = `copy-${String(n).padStart(4, '0')}`;
      if (decided.action === 'skip') {
        ops.push({
          id,
          kind: 'skip',
          path: node.rel,
          ownership: decided.ownership,
          reason: decided.preserve ? 'user-owned / preserve policy' : 'already present',
          dependsOn: ['phase-copy'],
        });
      } else {
        ops.push({
          id,
          kind: decided.action,
          path: node.rel,
          ownership: decided.ownership,
          reason: decided.mustRefreshVendor
            ? 'vendor engine/scripts'
            : (exists ? 'force overwrite' : 'new file'),
          dependsOn: ['phase-copy'],
        });
      }
    });
  }

  ops.push({
    id: 'phase-copy',
    kind: 'phase',
    reason: 'copy template tree',
  });
  // Execute also wipes/prunes vendor trees outside per-file ops (see copy-tree.mjs).
  if (!update && mode !== 'update' && mode !== 'migrate') {
    ops.push({
      id: 'vendor-fresh-reset',
      kind: 'note',
      path: '.harness/engine|.harness/scripts',
      ownership: 'vendor',
      reason: 'execute wipes leftover vendor trees on fresh install before copy',
      dependsOn: ['phase-copy'],
    });
  } else {
    ops.push({
      id: 'vendor-stale-prune',
      kind: 'note',
      path: '.harness/engine|.harness/scripts',
      ownership: 'vendor',
      reason: 'execute reconciles the vendor roots against the installed manifest',
      dependsOn: ['phase-copy'],
    });
    // Removals and overwritten local edits are real, destructive operations — surface them as ops
    // so `--dry-run` shows the full picture instead of a note.
    let reconcile = null;
    try {
      reconcile = planVendorReconcile({ target, template });
    } catch {
      reconcile = null;
    }
    if (reconcile) {
      let r = 0;
      for (const entry of reconcile.delete) {
        r += 1;
        ops.push({
          id: `vendor-remove-${String(r).padStart(4, '0')}`,
          kind: 'remove',
          path: entry.path,
          ownership: 'vendor',
          reason: entry.modified
            ? `${entry.reason} — local edit saved to .harness/conflicts/ before delete`
            : entry.reason,
          dependsOn: ['phase-copy'],
        });
      }
      let u = 0;
      for (const entry of reconcile.untracked) {
        u += 1;
        ops.push({
          id: `vendor-untracked-${String(u).padStart(4, '0')}`,
          kind: 'note',
          path: entry.path,
          ownership: 'vendor',
          reason: `${entry.reason} — left in place`,
          dependsOn: ['phase-copy'],
        });
      }
      let c = 0;
      for (const entry of reconcile.modified) {
        c += 1;
        ops.push({
          id: `vendor-conflict-${String(c).padStart(4, '0')}`,
          kind: 'conflict',
          path: entry.path,
          ownership: 'vendor',
          reason: `${entry.reason} — bundle wins; local copy saved to .harness/conflicts/`,
          dependsOn: ['phase-copy'],
        });
      }
    }
  }
  visit(template, target);

  if (autonomy) {
    const autonomySrc = join(template, '.optional', 'autonomy');
    if (existsSync(autonomySrc)) {
      ops.push({
        id: 'autonomy-capability',
        kind: 'autonomy',
        path: '.harness/autonomy',
        ownership: 'vendor',
        reason: '--autonomy requested — execute copies/prunes files (user policy/authz preserved)',
        dependsOn: ['phase-copy'],
      });
    }
  }

  if (update || mode === 'update' || mode === 'migrate') {
    ops.push({
      id: 'render-adapters',
      kind: 'render',
      path: 'adapters',
      ownership: 'generated',
      reason: 're-render tool adapters + registries',
      dependsOn: ['phase-copy'],
    });
    ops.push({
      id: 'ownership-manifest',
      kind: 'manifest',
      path: '.harness/manifest.json',
      ownership: 'system',
      reason: 'rewrite ownership ledger',
      dependsOn: ['render-adapters'],
    });
    ops.push({
      id: 'verify-doctor',
      kind: 'verify',
      path: '.harness/scripts/doctor.mjs',
      ownership: 'system',
      reason: 'strict doctor verification',
      dependsOn: ['ownership-manifest'],
    });
  } else {
    ops.push({
      id: 'write-state',
      kind: 'state',
      path: '.harness/state.yaml',
      ownership: 'user',
      reason: 'create default state when missing',
      dependsOn: ['phase-copy'],
    });
    ops.push({
      id: 'render-adapters',
      kind: 'render',
      path: 'adapters',
      ownership: 'generated',
      reason: 'generate tool adapters',
      dependsOn: ['write-state'],
    });
    ops.push({
      id: 'verify-doctor',
      kind: 'verify',
      path: '.harness/scripts/doctor.mjs',
      ownership: 'system',
      reason: 'strict doctor verification',
      dependsOn: ['render-adapters'],
    });
  }

  return createPlan({
    mode,
    target,
    ops,
    requirements: [],
    checks: [],
  });
}
