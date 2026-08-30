// verify.mjs — install phase: run doctor verify after apply.

/**
 * @param {object} bag
 * @param {object} session
 */
export async function applyVerifyDoctor(bag, session) {
  const paths = session.paths || await bag.loadPaths(bag.TARGET);
  session.paths = paths;
  bag.verifyResult = bag.update || bag.migrate || bag.rendered ? bag.verifyInstall(paths) : null;
}

/**
 * @param {object} bag
 * @param {object} session
 */
export async function verifyDoctorOk(bag, session) {
  if (bag.verifyResult?.missing) {
    throw new Error(`strict doctor missing at ${session.paths.scripts}/doctor.mjs`);
  }
}
