// runner.mjs — walk topo-sorted plan ops; call apply then verify when present.

/**
 * Execute plan ops that carry apply/verify. Informational ops (no apply) are skipped.
 * @param {{ ops: object[] }} plan
 * @param {object} ctx session / runtime context passed to apply(op, ctx)
 * @returns {Promise<{ applied: number, verified: number }>}
 */
export async function runPlanOps(plan, ctx) {
  let applied = 0;
  let verified = 0;
  for (const op of plan.ops || []) {
    if (typeof op.apply === 'function') {
      await op.apply(op, ctx);
      applied += 1;
    }
    if (typeof op.verify === 'function') {
      await op.verify(op, ctx);
      verified += 1;
    }
  }
  return { applied, verified };
}

/** True when an op is executable (has apply). */
export function isExecutableOp(op) {
  return typeof op?.apply === 'function';
}
