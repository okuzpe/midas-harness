// plan-tree.mjs — build a dry-run plan of template copy / preserve decisions.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createPlan } from '../core/plan.mjs';

function isVendorManagedPath(rel) {
  return rel.startsWith('.harness/engine/') || rel.startsWith('.harness/scripts/');
}

function alwaysPreservePath(rel, update) {
  return (
    rel === '.mcp.json' ||
    rel === 'AGENTS.md' ||
    rel === '.gitignore' ||
    rel === '.harness/state.yaml' ||
    rel === '.harness/manifest.json' ||
    rel.startsWith('.harness/product/') ||
    rel.startsWith('.harness/rules/') ||
    rel.startsWith('.harness/runs/') ||
    rel.startsWith('.harness/cache/') ||
    rel.startsWith('.harness/migrations/') ||
    rel === '.harness/autonomy/policy.yaml' ||
    rel.startsWith('.harness/autonomy/authz/') ||
    rel === '.harness/autonomy/control.json' ||
    rel === '.harness/autonomy/budget-ledger.json' ||
    rel === '.harness/autonomy/journal-anchor.json' ||
    ((!update) && (
      rel.startsWith('.claude/skills/') ||
      rel.startsWith('.claude/agents/') ||
      rel.startsWith('.agents/skills/')
    ))
  );
}

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
      const mustRefreshVendor = isVendorManagedPath(rel);
      const preserve = alwaysPreservePath(rel, update);
      const exists = existsSync(dst);
      n += 1;
      const id = `copy-${String(n).padStart(4, '0')}`;
      if (exists && !mustRefreshVendor && (!force || preserve)) {
        ops.push({
          id,
          kind: 'skip',
          path: rel,
          ownership: preserve ? 'user' : 'generated',
          reason: preserve ? 'user-owned / preserve policy' : 'already present',
          dependsOn: ['phase-copy'],
        });
      } else {
        ops.push({
          id,
          kind: mustRefreshVendor || (exists && force) ? 'refresh' : 'write',
          path: rel,
          ownership: mustRefreshVendor ? 'vendor' : 'generated',
          reason: mustRefreshVendor ? 'vendor engine/scripts' : (exists ? 'force overwrite' : 'new file'),
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
  visit(template, target);

  if (autonomy) {
    const autonomySrc = join(template, '.optional', 'autonomy');
    if (existsSync(autonomySrc)) {
      ops.push({
        id: 'autonomy-capability',
        kind: 'autonomy',
        path: '.harness/autonomy',
        ownership: 'vendor',
        reason: '--autonomy requested',
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

/** Quick existence helper for callers. */
export function pathIsFile(abs) {
  try {
    return existsSync(abs) && statSync(abs).isFile();
  } catch {
    return false;
  }
}
