// plan-tree.mjs — build a dry-run plan of template copy / preserve decisions.

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createPlan } from '../core/plan.mjs';
import { decideTemplateCopyAction } from '../core/preserve-policy.mjs';

/**
 * Walk template and emit write/skip ops without touching the target.
 * @param {{ template: string, target: string, mode: string, force: boolean, update: boolean, autonomy?: boolean }} opts
 */
export function planTemplateCopy(opts) {
  const { template, target, mode, force, update, autonomy = false } = opts;
  const ops = [];
  let n = 0;

  function visit(srcDir, dstDir) {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.name === '.optional') continue;
      const src = join(srcDir, entry.name);
      const dst = join(dstDir, entry.name);
      if (entry.isDirectory()) {
        visit(src, dst);
        continue;
      }
      const rel = relative(target, dst).replace(/\\/g, '/');
      const exists = existsSync(dst);
      const decided = decideTemplateCopyAction(rel, { exists, force, update });
      n += 1;
      const id = `copy-${String(n).padStart(4, '0')}`;
      if (decided.action === 'skip') {
        ops.push({
          id,
          kind: 'skip',
          path: rel,
          ownership: decided.ownership,
          reason: decided.preserve ? 'user-owned / preserve policy' : 'already present',
          dependsOn: ['phase-copy'],
        });
      } else {
        ops.push({
          id,
          kind: decided.action,
          path: rel,
          ownership: decided.ownership,
          reason: decided.mustRefreshVendor
            ? 'vendor engine/scripts'
            : (exists ? 'force overwrite' : 'new file'),
          dependsOn: ['phase-copy'],
        });
      }
    }
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
      reason: 'execute prunes vendor files removed from the bundle (not listed as file ops)',
      dependsOn: ['phase-copy'],
    });
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
