// migrate.mjs — plan() for v1→v2 migration (execute lives in the installer callback).

import { createPlan } from '../core/plan.mjs';

/**
 * @param {{
 *   target: string,
 *   apply: boolean,
 *   dryRun?: boolean,
 *   requirements?: object[],
 *   checks?: object[],
 *   planMigration?: (target: string) => { from_layout?: string, rows?: { from: string, to: string }[] },
 * }} opts
 */
export function planMigrate(opts) {
  const {
    target,
    apply,
    dryRun = false,
    requirements = [],
    checks = [],
    planMigration,
  } = opts;

  const ops = [
    {
      id: 'migrate',
      kind: apply && !dryRun ? 'migrate-apply' : 'migrate-preview',
      reason: apply
        ? (dryRun ? 'would migrate transactionally + install (dry-run)' : 'transactional migrate + install')
        : 'preview only — pass --apply to write',
    },
  ];

  if (typeof planMigration === 'function') {
    try {
      const mig = planMigration(target);
      const rows = mig?.rows || [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        ops.push({
          id: `migrate-row-${String(i + 1).padStart(3, '0')}`,
          kind: 'migrate-row',
          path: `${row.from} → ${row.to}`,
          dependsOn: ['migrate'],
          ownership: 'system',
          reason: mig.from_layout ? `from ${mig.from_layout}` : 'layout move',
        });
      }
      if (apply) {
        ops.push({
          id: 'install-refresh',
          kind: 'refresh',
          path: '.harness/engine',
          dependsOn: ['migrate'],
          ownership: 'vendor',
          reason: 'refresh engine after migrate',
        });
        ops.push({
          id: 'verify-doctor',
          kind: 'verify',
          path: '.harness/scripts/doctor.mjs',
          dependsOn: ['install-refresh'],
          ownership: 'system',
          reason: 'strict doctor verification',
        });
      }
    } catch {
      // planMigration may throw on conflict layouts; requirements already cover that.
    }
  }

  return createPlan({
    mode: apply ? (dryRun ? 'migrate-apply-dry-run' : 'migrate-apply') : 'migrate-preview',
    target,
    requirements,
    checks,
    ops,
  });
}
