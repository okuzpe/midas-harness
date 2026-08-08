// plan.mjs — typed install operations, stable topological sort, human/JSON render.

/**
 * @typedef {{
 *   id: string,
 *   kind: string,
 *   path?: string,
 *   dependsOn?: string[],
 *   ownership?: 'vendor'|'generated'|'user'|'system',
 *   reason?: string,
 *   detail?: string,
 * }} PlanOp
 */

/**
 * @typedef {{
 *   schema_version: 1,
 *   mode: string,
 *   target: string,
 *   phases: string[],
 *   requirements: { id: string, ok: boolean, message: string }[],
 *   checks: { id: string, ok: boolean, message: string }[],
 *   ops: PlanOp[],
 * }} InstallPlan
 */

/**
 * Stable topological sort. Rejects missing dependencies and cycles.
 * @param {PlanOp[]} ops
 * @returns {PlanOp[]}
 */
export function sortPlanOps(ops) {
  const byId = new Map();
  for (const op of ops) {
    if (byId.has(op.id)) throw new Error(`duplicate plan op id: ${op.id}`);
    byId.set(op.id, op);
  }
  for (const op of ops) {
    for (const dep of op.dependsOn || []) {
      if (!byId.has(dep)) throw new Error(`missing dependency "${dep}" for op "${op.id}"`);
    }
  }

  const sortedIds = [...byId.keys()].sort();
  const indegree = new Map(sortedIds.map((id) => [id, 0]));
  const children = new Map(sortedIds.map((id) => [id, []]));
  for (const id of sortedIds) {
    const deps = [...(byId.get(id).dependsOn || [])].sort();
    for (const dep of deps) {
      children.get(dep).push(id);
      indegree.set(id, indegree.get(id) + 1);
    }
  }
  for (const id of sortedIds) children.get(id).sort();

  const queue = sortedIds.filter((id) => indegree.get(id) === 0);
  const out = [];
  while (queue.length) {
    const id = queue.shift();
    out.push(byId.get(id));
    for (const child of children.get(id)) {
      const next = indegree.get(child) - 1;
      indegree.set(child, next);
      if (next === 0) {
        // insert in sorted order among ready nodes
        let i = 0;
        while (i < queue.length && queue[i] < child) i++;
        queue.splice(i, 0, child);
      }
    }
  }
  if (out.length !== ops.length) throw new Error('plan has a dependency cycle');
  return out;
}

/** @param {Partial<InstallPlan> & { mode: string, target: string }} partial */
export function createPlan(partial) {
  const ops = sortPlanOps(partial.ops || []);
  return {
    schema_version: 1,
    mode: partial.mode,
    target: partial.target,
    phases: partial.phases || [
      'requirements',
      'checks',
      'plan',
      'confirm',
      'execute',
      'verify',
      'complete',
    ],
    requirements: partial.requirements || [],
    checks: partial.checks || [],
    ops,
  };
}

/** @param {InstallPlan} plan */
export function planToJSON(plan) {
  return {
    schema_version: plan.schema_version,
    mode: plan.mode,
    target: plan.target,
    phases: plan.phases,
    requirements: plan.requirements,
    checks: plan.checks,
    ops: plan.ops.map(({ id, kind, path, dependsOn, ownership, reason, detail }) => ({
      id,
      kind,
      ...(path ? { path } : {}),
      ...(dependsOn?.length ? { dependsOn } : {}),
      ...(ownership ? { ownership } : {}),
      ...(reason ? { reason } : {}),
      ...(detail ? { detail } : {}),
    })),
  };
}

/** Human-readable plan listing. */
export function renderPlan(plan) {
  const lines = [
    `Midas ${plan.mode} plan — ${plan.target}`,
    '',
    `Ops: ${plan.ops.length}`,
  ];
  for (const op of plan.ops) {
    const path = op.path ? ` ${op.path}` : '';
    const reason = op.reason ? ` — ${op.reason}` : '';
    lines.push(`  [${op.kind}]${path}${reason}`);
  }
  if (plan.requirements.length) {
    lines.push('', 'Requirements:');
    for (const r of plan.requirements) {
      lines.push(`  ${r.ok ? 'ok' : 'FAIL'} ${r.id}: ${r.message}`);
    }
  }
  if (plan.checks.length) {
    lines.push('', 'Checks:');
    for (const c of plan.checks) {
      lines.push(`  ${c.ok ? 'ok' : 'FAIL'} ${c.id}: ${c.message}`);
    }
  }
  return lines.join('\n');
}

/** @param {InstallPlan} plan */
export function planHasFailures(plan) {
  return plan.requirements.some((r) => !r.ok) || plan.checks.some((c) => !c.ok);
}
