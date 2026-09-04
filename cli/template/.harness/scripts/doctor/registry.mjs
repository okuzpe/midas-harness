// registry.mjs — doctor health-check registry (profile filtering is at report time).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseSprints, parseSprintLastTouched, parsePhases, parseEnforcement, parseRouting, parseToolsFromStateYaml } from '../yaml-lite.mjs';
import { detectLayout } from '../paths.mjs';
import { readOwnershipManifest, findVendorConflicts, sha256File } from '../ownership-manifest.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { formatUpdateCmd, formatUpdateCmdFromRelease } from '../lib/install-cmd.mjs';
import {
  normalizeRoutingProfile,
  normalizeCostProfile,
  resolveRoutingModels,
  resolveCostAwareRouting,
  knownRoutingModelIds,
} from '../model-profiles.mjs';
import { evaluateMcpDeclaredVsWired, evaluateMcpGovernance, evaluateSkillMcpRequired, collectSkillMcpRequired } from '../mcp-drift.mjs';
import { wrapMcpServersForWindows } from '../mcp-cursor-sync.mjs';
import { auditGitignore, auditTrackedKit } from '../gitignore-merge.mjs';
import { orphanRootMidasPaths, resolveSkillMirrorPlan } from '../tool-profiles.mjs';
import { renderPortableSkillText } from '../portable-skills.mjs';
import { checkSkillRegistry } from '../skill-registry.mjs';
import { missingEvidenceRequired } from '../lib/gate-evidence.mjs';
import { computeChecksIndex, computeGatesIndex } from '../render-adapters.mjs';
import { computeStageCommandTableYaml } from '../stage-command-table.mjs';
import { computeDesignSystemCss } from '../design-system.mjs';
import { createDoctorHelpers } from './helpers.mjs';
import * as state from './checks/state.mjs';
import * as layout from './checks/layout.mjs';
import * as mcp from './checks/mcp.mjs';
import * as gates from './checks/gates.mjs';
import * as registries from './checks/registries.mjs';

export const HEALTH_CHECKS = Object.freeze([state, layout, mcp, gates, registries]);

/**
 * Run every registered health check. Profile filtering happens when doctor maps warns to --strict.
 *
 * @param {{
 *   ROOT: string,
 *   paths: object,
 *   VERSION: string,
 *   doctorCmd: string,
 *   updateCheckCmd: string,
 *   pluginHelpers: object | null,
 *   health: Array<{ name: string, status: string, note: string }>,
 * }} opts
 */
export async function runHealthChecks(opts) {
  const { ROOT, paths, VERSION, doctorCmd, updateCheckCmd, pluginHelpers, health } = opts;
  const helpers = createDoctorHelpers(ROOT, paths);
  const check = (name, status, note) => health.push({ name, status, note: note || '' });
  const ctx = {
    ROOT,
    paths,
    VERSION,
    doctorCmd,
    updateCheckCmd,
    pluginHelpers,
    stateRaw: helpers.read(paths.state),
    check,
    ...helpers,
    existsSync,
    join,
    resolve,
    dirname,
    readFileSync,
    readdirSync,
    statSync,
    parseSprints,
    parseSprintLastTouched,
    parsePhases,
    parseEnforcement,
    parseRouting,
    parseToolsFromStateYaml,
    detectLayout,
    readOwnershipManifest,
    findVendorConflicts,
    sha256File,
    walkFiles,
    formatUpdateCmd,
    formatUpdateCmdFromRelease,
    normalizeRoutingProfile,
    normalizeCostProfile,
    resolveRoutingModels,
    resolveCostAwareRouting,
    knownRoutingModelIds,
    evaluateMcpDeclaredVsWired,
    evaluateMcpGovernance,
    evaluateSkillMcpRequired,
    collectSkillMcpRequired,
    wrapMcpServersForWindows,
    auditGitignore,
    auditTrackedKit,
    orphanRootMidasPaths,
    resolveSkillMirrorPlan,
    renderPortableSkillText,
    checkSkillRegistry,
    missingEvidenceRequired,
    computeStageCommandTableYaml,
    computeDesignSystemCss,
    computeChecksIndex,
    computeGatesIndex,
  };
  for (const entry of HEALTH_CHECKS) {
    await entry.run(ctx);
  }
  return health;
}
