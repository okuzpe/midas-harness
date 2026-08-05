// bind-applies.mjs — attach apply/verify to executable phase ops (file-level ops stay informational).

/**
 * Bind session actions onto matching plan op ids. Mutates plan.ops in place.
 * @param {object} plan
 * @param {object} session — must expose the action methods used below
 * @param {{ update?: boolean, migrate?: boolean, autonomy?: boolean }} flags
 */
export function bindExecutableOps(plan, session, flags = {}) {
  const byId = new Map((plan.ops || []).map((op) => [op.id, op]));

  const bind = (id, apply, verify) => {
    const op = byId.get(id);
    if (!op) return;
    op.apply = apply;
    if (verify) op.verify = verify;
  };

  bind('migrate', async () => {
    await session.applyMigration();
  });

  bind('phase-copy', async () => {
    await session.applyPhaseCopy();
  });

  bind('autonomy-capability', async () => {
    await session.applyAutonomy();
  });

  bind('write-state', async () => {
    await session.applyWriteState();
  });

  bind('render-adapters', async () => {
    await session.applyRenderAdapters();
  });

  bind('ownership-manifest', async () => {
    await session.applyOwnershipManifest();
  });

  bind('install-refresh', async () => {
    // migrate-apply composite: copy + state + render + manifest (verify is separate op)
    await session.applyPhaseCopy();
    if (flags.autonomy) await session.applyAutonomy();
    await session.applyWriteState();
    await session.applyRenderAdapters();
    await session.applyOwnershipManifest();
  });

  bind('verify-doctor', async () => {
    await session.applyVerifyDoctor();
  }, async () => {
    await session.verifyDoctorOk();
  });

  bind('uninstall-engine', async () => {
    await session.applyUninstall();
  });

  bind('uninstall-manifest', async () => {
    /* handled inside applyUninstall */
  });

  bind('purge-user-work', async () => {
    /* handled inside applyUninstall when purge */
  });

  bind('keep-user-work', async () => {
    /* no-op informational */
  });

  return plan;
}
