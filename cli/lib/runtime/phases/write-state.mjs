// write-state.mjs — install phase: state.yaml, tools, skill mirrors, field migrations.

import { DEFAULT_TOOLS } from '../../cli/args.mjs';

/**
 * @param {object} bag
 * @param {object} session
 */
export async function applyWriteState(bag, session) {
  session.paths = await bag.loadPaths(bag.TARGET);
  bag.ensureUserLayoutDirs(session.paths);
  if ((bag.update || bag.migrate) && bag.hasToolsFlag()) {
    session.selectedTools = await bag.resolveSelectedTools();
  } else if (bag.update || bag.migrate) {
    session.selectedTools = null;
  } else {
    session.selectedTools = await bag.resolveSelectedTools();
  }
  bag.stateMode = bag.writeState(session.selectedTools, session.paths, bag.installRoutingProfile);
  bag.maybeFail('after-state');
  if (bag.migrate) bag.ensureMigratedStateShape(session.paths);
  if ((bag.update || bag.migrate) && session.selectedTools) {
    bag.rewriteStateTools(session.paths, session.selectedTools);
  } else if (bag.migrate && !(bag.readToolsFromState(session.paths)?.length)) {
    bag.rewriteStateTools(session.paths, DEFAULT_TOOLS);
  }
  session.activeTools = session.selectedTools || bag.readToolsFromState(session.paths) || DEFAULT_TOOLS;
  await bag.syncSkillMirrors(session.activeTools, session.paths, { merge: !bag.update });
  await bag.runStateMigrations(session.paths);
}
