// uninstall.mjs — plan() for uninstall (execute lives in the installer callback).

import { createPlan } from '../core/plan.mjs';

/**
 * @param {{ target: string, purge?: boolean, requirements?: object[], checks?: object[] }} opts
 */
export function planUninstall(opts) {
  const { target, purge = false, requirements = [], checks = [] } = opts;
  return createPlan({
    mode: 'uninstall',
    target,
    requirements,
    checks,
    ops: [
      {
        id: 'uninstall-engine',
        kind: 'uninstall',
        path: '.harness/engine',
        ownership: 'vendor',
        reason: 'remove owned engine/scripts and generated mirrors',
      },
      {
        id: 'uninstall-manifest',
        kind: 'uninstall',
        path: '.harness/manifest.json',
        dependsOn: ['uninstall-engine'],
        ownership: 'system',
        reason: 'drop ownership ledger',
      },
      ...(purge
        ? [{
            id: 'purge-user-work',
            kind: 'purge',
            path: '.harness/product',
            dependsOn: ['uninstall-manifest'],
            ownership: 'user',
            reason: '--purge removes product/rules/runs/state',
          }]
        : [{
            id: 'keep-user-work',
            kind: 'skip',
            path: '.harness/product',
            dependsOn: ['uninstall-manifest'],
            ownership: 'user',
            reason: 'keep product/rules/runs/state (pass --purge to remove)',
          }]),
    ],
  });
}
