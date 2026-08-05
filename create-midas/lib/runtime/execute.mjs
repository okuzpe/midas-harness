// execute.mjs — install/update/migrate/uninstall execute leg + helpers (moved from index).
// Phase ops carry apply/verify; runPlanOps walks them. File-level copy-* ops stay informational.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, cpSync, rmSync, rmdirSync, mkdtempSync, statSync } from 'node:fs';
import { dirname, basename, join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ROUTING_PROFILE, normalizeRoutingProfile, resolveRoutingModels } from '../../template/.harness/scripts/model-profiles.mjs';
import {
  applyV2Migration,
  extractLegacyRuleOverrides,
  formatMigrationPlan,
  planV2Migration,
  writeMigrationReceipt,
} from '../../migrate-v2.mjs';
import {
  readOwnershipManifest,
  sha256File,
  writeOwnershipManifest,
} from '../../template/.harness/scripts/ownership-manifest.mjs';
import {
  KNOWN_TOOLS,
  DEFAULT_TOOLS,
  ALL_ADAPTER_TOOLS,
  parseToolsList,
} from '../cli/args.mjs';
import {
  hasMidasInstall as libHasMidasInstall,
  findAncestorMidasRoot as libFindAncestorMidasRoot,
  detectInstallLayout as libDetectInstallLayout,
  compareVersions as libCompareVersions,
} from '../core/context.mjs';
import {
  beginRollbackSession as libBeginRollbackSession,
  rollbackInstall as libRollbackInstall,
  discardRollbackSession as libDiscardRollbackSession,
} from '../core/transaction.mjs';
import { assessUpdateConflicts } from '../core/conflicts.mjs';
import { runPlanOps } from '../core/runner.mjs';
import { bindExecutableOps } from '../steps/bind-applies.mjs';

/**
 * @param {{
 *   template: string,
 *   target: string,
 *   name: string,
 *   targetArg: string,
 *   cmd: import('../cli/args.mjs').InstallCommand,
 *   routingProfile: string,
 *   autonomy: boolean,
 *   testFailStep: string,
 *   jsonOut: boolean,
 * }} env
 */
export function createExecuteHandler(env) {
  const TEMPLATE = env.template;
  const TARGET = env.target;
  const NAME = env.name;
  const targetArg = env.targetArg;
  const parsedCmd = env.cmd;
  const update = parsedCmd.command === 'update';
  const migrate = parsedCmd.command === 'migrate';
  const force = parsedCmd.force;
  const dryRun = parsedCmd.dryRun;
  const purge = parsedCmd.purge;
  const jsonOut = env.jsonOut;
  const installAutonomy = env.autonomy;
  const installRoutingProfile = env.routingProfile;
  const TEST_FAIL_STEP = env.testFailStep || '';

  const AUTONOMY_USER_NAMES = new Set([
    'policy.yaml',
    'control.json',
    'budget-ledger.json',
    'journal-anchor.json',
    'authz',
  ]);

  let written = [];
  let skipped = [];
  let gitignoreResult = null;
  let stateMode = null;
  let rendered = false;
  let verifyResult = null;
  let updatedTo = null;

  function trustedScriptPath(name) {
    const path = join(TEMPLATE, '.harness', 'scripts', name);
    if (!existsSync(path)) throw new Error(`bundled installer script missing: ${name}`);
    return path;
  }

  async function importTrustedScript(name) {
    return import(pathToFileURL(trustedScriptPath(name)).href);
  }

async function executeInstallerCommand(cmd, hooks) {
    if (cmd.command === 'uninstall') {
      const plan = hooks.plan;
      const session = makeSession({ migrationPlan: null });
      bindExecutableOps(plan, session, { update: false, migrate: false, autonomy: false });
      // Ensure uninstall-engine has apply even if plan shape differs
      const engineOp = plan.ops?.find((o) => o.id === 'uninstall-engine');
      if (engineOp) engineOp.apply = async () => { session.applyUninstall(); };
      await runPlanOps(plan, session);
      return { ok: true, message: cmd.dryRun ? 'uninstall dry-run' : 'uninstall complete' };
    }

    if (cmd.command === 'migrate' && !cmd.apply) {
      const migrationPlan = planV2Migration(TARGET);
      if (!jsonOut) console.log(formatMigrationPlan(migrationPlan));
      return { ok: true, message: 'migrate preview — pass --apply to write' };
    }

    // Rebaseline stale manifest hashes only after confirm (never during dry-run/checks).
    if (cmd.command === 'update' && hooks.needsRebaseline && !cmd.dryRun) {
      const assessment = assessUpdateConflicts(TARGET);
      if (assessment.needsRebaseline && assessment.manifest) {
        console.warn('create-midas: manifest hash drift — re-baselining before refresh');
        writeOwnershipManifest(TARGET, assessment.manifest.midas_version || '0.0.0');
        const again = assessUpdateConflicts(TARGET);
        if (again.vendorConflicts.length || again.mirrorConflicts.length) {
          const paths = [...again.vendorConflicts, ...again.mirrorConflicts];
          throw new Error(
            `vendor/mirror conflicts remain after rebaseline: ${paths.join(', ')}`,
          );
        }
      }
    }

    written = [];
    skipped = [];
    gitignoreResult = null;
    stateMode = null;
    rendered = false;
    verifyResult = null;
    updatedTo = null;

    let migrationPlan = null;
    let migrationOuterRollback = null;
    const rollbackSession = beginRollbackSession(TARGET, installRollbackPaths());
    const session = makeSession({
      get migrationPlan() { return migrationPlan; },
      setMigrationPlan(p) { migrationPlan = p; },
    });

    try {
      const plan = hooks.plan;
      bindExecutableOps(plan, session, {
        update,
        migrate,
        autonomy: installAutonomy,
      });
      ensurePhaseCoverage(plan, session);

      // Migrate outer snapshot wraps layout moves before install-refresh writes.
      if (cmd.command === 'migrate' && cmd.apply) {
        migrationOuterRollback = beginRollbackSession(TARGET, installRollbackPaths());
      }

      const { applied } = await runPlanOps(plan, session);
      if (applied < 1 && cmd.command !== 'uninstall') {
        throw new Error('no executable plan ops ran — bindExecutableOps failed to attach apply handlers');
      }

      if (migrate && migrationPlan) {
        const installedVersion = (readMaybe(join(TARGET, session.paths.version)) || '0.0.0').trim();
        writeMigrationReceipt(TARGET, migrationPlan, installedVersion);
      }
      if (!jsonOut) await report(session.selectedTools, session.paths);

      if (migrationOuterRollback) {
        discardRollbackSession(migrationOuterRollback);
        migrationOuterRollback = null;
      }

      return {
        ok: !(verifyResult && !verifyResult.ok),
        verify: verifyResult ? { ok: !!verifyResult.ok } : null,
        written: [...written],
        skipped: [...skipped],
        message: updatedTo ? `updated → v${updatedTo}` : 'install complete',
      };
    } catch (err) {
      rollbackInstall(rollbackSession);
      if (migrationOuterRollback) {
        rollbackInstall(migrationOuterRollback);
        migrationOuterRollback = null;
      }
      if (!jsonOut) {
        console.error(`create-midas: install failed; restored previous files — ${err.message || err}`);
      }
      return {
        ok: false,
        error: err,
        message: `create-midas: install failed; restored previous files — ${err.message || err}`,
      };
    } finally {
      if (rollbackSession) discardRollbackSession(rollbackSession);
    }
  }

  /** Session object exposing phase apply methods for runPlanOps. */
  function makeSession(extra = {}) {
    const session = {
      paths: null,
      selectedTools: null,
      activeTools: null,
      ...extra,

      async applyMigration() {
        const plan = planV2Migration(TARGET);
        if (!jsonOut) console.log(formatMigrationPlan(plan));
        if (plan.from_layout === 'harness') return;
        if (extra.setMigrationPlan) extra.setMigrationPlan(plan);
        else session.migrationPlan = plan;
        applyV2Migration(TARGET, plan);
        const canonicalNames = existsSync(join(TEMPLATE, '.harness', 'engine', 'rules'))
          ? readdirSync(join(TEMPLATE, '.harness', 'engine', 'rules')).filter((name) => name.endsWith('.md'))
          : [];
        extractLegacyRuleOverrides(TARGET, plan, canonicalNames);
      },

      async applyPhaseCopy() {
        mkdirSync(TARGET, { recursive: true });
        resetFreshVendorTrees();
        copyTree(TEMPLATE, TARGET);
        maybeFail('after-copy-tree');
        if (installAutonomy && !update && !migrate) {
          // autonomy op may also run; for update/migrate autonomy is after or via install-refresh
        }
        if (update) {
          pruneStaleVendorTree('.harness/engine', '.harness/engine');
          pruneStaleVendorTree('.harness/scripts', '.harness/scripts');
          if (installAutonomy) pruneStaleAutonomyVendor();
        }
        maybeFail('after-layout');
      },

      async applyAutonomy() {
        installAutonomyCapability();
        ensureAutonomyStatePointers();
        if (update) pruneStaleAutonomyVendor();
      },

      async applyWriteState() {
        session.paths = await loadPaths(TARGET);
        if ((update || migrate) && hasToolsFlag()) {
          session.selectedTools = await resolveSelectedTools();
        } else if (update || migrate) {
          session.selectedTools = null;
        } else {
          session.selectedTools = await resolveSelectedTools();
        }
        stateMode = writeState(session.selectedTools, session.paths, installRoutingProfile);
        maybeFail('after-state');
        if (migrate) ensureMigratedStateShape(session.paths);
        if ((update || migrate) && session.selectedTools) {
          rewriteStateTools(session.paths, session.selectedTools);
        } else if (migrate && !(readToolsFromState(session.paths)?.length)) {
          rewriteStateTools(session.paths, DEFAULT_TOOLS);
        }
        session.activeTools = session.selectedTools || readToolsFromState(session.paths) || DEFAULT_TOOLS;
        await syncSkillMirrors(session.activeTools, session.paths, { merge: !update });
      },

      async applyRenderAdapters() {
        const paths = session.paths || await loadPaths(TARGET);
        session.paths = paths;
        const activeTools = session.activeTools || session.selectedTools || readToolsFromState(paths) || DEFAULT_TOOLS;
        session.activeTools = activeTools;
        try {
          const mod = await importTrustedScript('render-adapters.mjs');
          if (typeof mod.renderAdapters === 'function') {
            mod.renderAdapters(TARGET);
            rendered = true;
          }
          if (typeof mod.writeEngineRegistries === 'function') {
            const reg = mod.writeEngineRegistries(TARGET, paths.engine);
            written.push(reg.gates, reg.checks);
          }
        } catch (err) {
          throw new Error(`adapter render failed: ${err.message || err}`);
        }
        pruneOrphanAdapters(activeTools);
        pruneLegacyRootArtifacts(activeTools);
        fillAgents(session.selectedTools, paths);
        {
          const mcpSyncPath = trustedScriptPath('mcp-cursor-sync.mjs');
          if (existsSync(mcpSyncPath)) {
            const { fixMcpFileForWindows, syncCursorMcp } = await importTrustedScript('mcp-cursor-sync.mjs');
            const rootMcp = join(TARGET, '.mcp.json');
            if (existsSync(rootMcp) && written.includes('.mcp.json')) {
              if (fixMcpFileForWindows(rootMcp)) written.push('.mcp.json');
            }
            const priorManifest = readOwnershipManifest(TARGET);
            const priorCursorMcp = priorManifest?.files?.find((file) => file.path === '.cursor/mcp.json');
            const ownedCursorMcp = priorCursorMcp &&
              existsSync(join(TARGET, '.cursor', 'mcp.json')) &&
              sha256File(join(TARGET, '.cursor', 'mcp.json')) === priorCursorMcp.sha256;
            const r = syncCursorMcp(TARGET, activeTools, {
              wrapRoot: written.includes('.mcp.json'),
              preserveExisting: !ownedCursorMcp,
            });
            if (r.conflict) {
              throw new Error(
                '.cursor/mcp.json differs from .mcp.json; reconcile the user-owned Cursor config before installing',
              );
            }
            if (r.synced && !written.includes('.cursor/mcp.json')) written.push('.cursor/mcp.json');
          }
        }
        gitignoreResult = await ensureGitignore(paths);
      },

      async applyOwnershipManifest() {
        const paths = session.paths || await loadPaths(TARGET);
        session.paths = paths;
        updatedTo = update || migrate ? bumpVersionStamp(paths) : null;
        const installedVersion = (readMaybe(join(TARGET, paths.version)) || '0.0.0').trim();
        writeOwnershipManifest(TARGET, installedVersion);
      },

      async applyVerifyDoctor() {
        const paths = session.paths || await loadPaths(TARGET);
        session.paths = paths;
        verifyResult = update || migrate || rendered ? verifyInstall(paths) : null;
      },

      async verifyDoctorOk() {
        if (verifyResult && !verifyResult.ok) {
          throw new Error(
            verifyResult.missing
              ? `strict doctor missing at ${session.paths.scripts}/doctor.mjs`
              : `strict doctor verification failed\n${verifyResult.out}`,
          );
        }
      },

      applyUninstall() {
        runUninstall();
      },
    };

    return session;
  }

  // After bind: fold missing phase ops for plan shapes that omit them.
  function ensurePhaseCoverage(plan, session) {
    const ids = new Set((plan.ops || []).map((o) => o.id));
    const patch = (id, wrap) => {
      const op = plan.ops.find((o) => o.id === id);
      if (!op?.apply) return;
      const prev = op.apply;
      op.apply = async (o, ctx) => {
        await prev(o, ctx);
        await wrap();
      };
    };
    if (installAutonomy && !ids.has('autonomy-capability') && !ids.has('install-refresh')) {
      patch('phase-copy', () => session.applyAutonomy());
    }
    if (!ids.has('write-state') && !ids.has('install-refresh')) {
      patch('phase-copy', () => session.applyWriteState());
    }
    if (!ids.has('ownership-manifest') && !ids.has('install-refresh')) {
      patch('render-adapters', () => session.applyOwnershipManifest());
    }
  }

// --- helpers -----------------------------------------------------------------------------------

/** Semver-ish compare including `-rc.N` pre-release tails. Returns <0 when a<b. */
function compareVersions(a, b) {
  return libCompareVersions(a, b);
}

function isVendorManagedPath(rel) {
  return rel.startsWith('.harness/engine/') || rel.startsWith('.harness/scripts/');
}

function resetFreshVendorTrees() {
  if (update || migrate) return;
  for (const rel of ['.harness/engine', '.harness/scripts']) {
    rmSync(join(TARGET, rel), { recursive: true, force: true });
  }
}

function copyTree(srcDir, dstDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    // Optional capability staging — never land in the project root.
    if (entry.name === '.optional') continue;
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(dst, { recursive: true });
      copyTree(src, dst);
    } else {
      const rel = relative(TARGET, dst).replace(/\\/g, '/');
      // .mcp.json is user-owned config (which MCP servers they wire — Context7, GitHub, …). Never
      // clobber an existing one, even on --update/--force, so the user's wiring survives an engine
      // refresh (same preserve-don't-overwrite policy as harness/state.yaml).
      const alwaysPreserve =
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
        ));
      const mustRefreshVendor = isVendorManagedPath(rel);
      if (existsSync(dst) && !mustRefreshVendor && (!force || alwaysPreserve)) {
        skipped.push(rel);
        continue;
      }
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      written.push(rel);
    }
  }
}

function installRollbackPaths() {
  if (update) {
    return [
      '.harness/engine',
      '.harness/scripts',
      '.harness/autonomy',
      '.harness/cache',
      '.harness/manifest.json',
      '.claude',
      '.agents',
      '.cursor',
      '.windsurf',
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      '.mcp.json',
      'gemini-extension.json',
      'docs/agents-and-models.md',
    ];
  }
  return ['.harness', '.claude', '.agents', '.cursor', '.windsurf', 'harness', 'scripts', '.midas', 'product', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.mcp.json', '.gitignore', 'gemini-extension.json', 'docs/agents-and-models.md'];
}

function beginRollbackSession(root, relPaths) {
  return libBeginRollbackSession(root, relPaths);
}

function rollbackInstall(session) {
  return libRollbackInstall(session);
}

function discardRollbackSession(session) {
  return libDiscardRollbackSession(session);
}

function maybeFail(step) {
  if (TEST_FAIL_STEP === step) {
    throw new Error(`MIDAS_TEST_FAIL_STEP=${step}`);
  }
}

function readMaybe(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

/** True if `dir` already holds a Midas install — classic or compact markers. */
function hasMidasInstall(dir) {
  return libHasMidasInstall(dir);
}

function detectInstallLayout(dir) {
  return libDetectInstallLayout(dir);
}

/** Resolve target paths with the installer-owned module, never executable target content. */
async function loadPaths(target) {
  const mod = await importTrustedScript('paths.mjs');
  return mod.resolvePaths(target);
}

/** Walk up from TARGET's parent to the filesystem root; return the first ancestor that holds a Midas
 *  install, or null. Used to refuse a nested/duplicate install. */
function findAncestorMidasRoot(startDir) {
  return libFindAncestorMidasRoot(startDir);
}

// Fill the template AGENTS.md placeholders so the installed file is about THIS project, not Midas.
// Only touches our freshly-written template AGENTS.md (it still contains `{{...}}`); a pre-existing
// user AGENTS.md has no placeholders and is left untouched.
function fillAgents(tools, paths) {
  const f = join(TARGET, 'AGENTS.md');
  const list = (tools || readToolsFromState(paths) || DEFAULT_TOOLS).join(', ');
  const source = readMaybe(join(TEMPLATE, 'AGENTS.md'));
  if (source == null) return;
  const filled = source
    .replace(/\{\{PROJECT_NAME\}\}/g, NAME)
    .replace(/\{\{STACK\}\}/g, 'undecided — set in Phase 4 (`/choose-architecture`)')
    .replace(/\{\{TOOLS\}\}/g, list);
  const existing = readMaybe(f);
  if (existing == null || existing.includes('{{')) {
    writeFileSync(f, filled, 'utf8');
    return;
  }
  const begin = '<!-- midas:begin AGENTS -->';
  const end = '<!-- midas:end AGENTS -->';
  const bi = existing.indexOf(begin);
  const ei = existing.indexOf(end);
  const fbi = filled.indexOf(begin);
  const fei = filled.indexOf(end);
  if (fbi === -1 || fei === -1) return;
  const managed = filled.slice(fbi, fei + end.length);
  if (bi !== -1 && ei > bi) {
    writeFileSync(f, existing.slice(0, bi) + managed + existing.slice(ei + end.length), 'utf8');
  } else {
    writeFileSync(f, `${existing.replace(/\s*$/, '')}\n\n${managed}\n`, 'utf8');
  }
}

function sameBytes(a, b) {
  return existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
}

function removeGeneratedMirror(templateRel) {
  const source = join(TEMPLATE, templateRel);
  const target = join(TARGET, templateRel);
  if (!existsSync(source) || !existsSync(target)) return;
  const visit = (src, dst) => {
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      const a = join(src, entry.name);
      const b = join(dst, entry.name);
      if (!existsSync(b)) continue;
      if (entry.isDirectory()) {
        visit(a, b);
        try { if (readdirSync(b).length === 0) rmdirSync(b); } catch { /* user content remains */ }
      } else if (sameBytes(a, b)) {
        rmSync(b);
      }
    }
  };
  visit(source, target);
  try { if (readdirSync(target).length === 0) rmdirSync(target); } catch { /* user content remains */ }
}

/** Keep only host discovery mirrors required by state.tools without deleting user-owned neighbors. */
function hasToolsFlag() {
  return parsedCmd.toolsFlag;
}

function rewriteStateTools(paths, tools) {
  const f = join(TARGET, paths.state);
  const cur = readMaybe(f);
  if (cur == null) return;
  const toolList = tools.join(', ');
  let next = cur;
  if (/^tools:\s*\[/m.test(next)) {
    next = next.replace(/^tools:\s*\[[^\]]*\]/m, `tools: [${toolList}]`);
  } else {
    next = `${next.replace(/\s*$/, '')}\n\ntools: [${toolList}]\n`;
  }
  if (next !== cur) writeFileSync(f, next, 'utf8');
}

/** After v1→v2 migrate, fill doctor-required keys that classic state may omit. */
function ensureMigratedStateShape(paths) {
  const f = join(TARGET, paths.state);
  const cur = readMaybe(f);
  if (cur == null) return;
  const routing = resolveRoutingModels(installRoutingProfile);
  const patches = [];
  if (!/^stage:\s*\S+/m.test(cur)) patches.push('stage: idea_intake');
  if (!/^stage_status:\s*\S+/m.test(cur)) patches.push('stage_status: not_started');
  if (!/^cost_profile:\s*\S+/m.test(cur)) patches.push('cost_profile: balanced');
  if (!/^routing_profile:\s*\S+/m.test(cur)) patches.push(`routing_profile: ${installRoutingProfile}`);
  if (!/^routing:/m.test(cur)) {
    patches.push(
      'routing:',
      `  orchestrate: ${routing.orchestrate}`,
      `  build:       ${routing.build}`,
      `  scout:       ${routing.scout}`,
    );
  }
  if (!patches.length) return;
  const next = `${cur.replace(/\s*$/, '')}\n\n${patches.join('\n')}\n`;
  writeFileSync(f, next, 'utf8');
}

function resolveSkillMirrorPlanLocal(tools) {
  const portablePeers = ['windsurf', 'gemini', 'codex', 'copilot'];
  const list = tools || [];
  const hasPortablePeer = list.some((t) => portablePeers.includes(t));
  return {
    claude: list.includes('claude-code'),
    agents: hasPortablePeer,
    cursorSkills: list.includes('cursor') && !hasPortablePeer,
  };
}

async function syncSkillMirrors(tools, paths, { merge = true } = {}) {
  const plan = resolveSkillMirrorPlanLocal(tools);
  if (!plan.claude) {
    removeGeneratedMirror('.claude/skills');
    removeGeneratedMirror('.claude/agents');
    try {
      const claudeDir = join(TARGET, '.claude');
      if (existsSync(claudeDir) && readdirSync(claudeDir).length === 0) rmdirSync(claudeDir);
    } catch { /* user content remains */ }
  }

  let renderTree = null;
  let pruneObsolete = null;
  try {
    const mod = await importTrustedScript('portable-skills.mjs');
    renderTree = mod.renderPortableSkillsTree;
    pruneObsolete = mod.pruneObsoleteMidasSkillMirrors;
  } catch { /* fall through to template prune only */ }

  const engineSkillsRel = join(paths.engine, 'skills').replace(/\\/g, '/');

  if (plan.agents && typeof renderTree === 'function') {
    if (typeof pruneObsolete === 'function') {
      for (const rel of pruneObsolete(TARGET, {
        sourceDir: engineSkillsRel,
        targetDir: '.agents/skills',
        bundledMirrorRoot: TEMPLATE,
      })) {
        written.push(`removed:${rel}`);
      }
    }
    renderTree(TARGET, { sourceDir: engineSkillsRel, targetDir: '.agents/skills', merge });
  } else if (!plan.agents) {
    removeGeneratedMirror('.agents/skills');
    try {
      const agentsDir = join(TARGET, '.agents');
      if (existsSync(agentsDir) && readdirSync(agentsDir).length === 0) rmdirSync(agentsDir);
    } catch { /* user content remains */ }
  }

  if (plan.cursorSkills && typeof renderTree === 'function') {
    if (typeof pruneObsolete === 'function') {
      for (const rel of pruneObsolete(TARGET, {
        sourceDir: engineSkillsRel,
        targetDir: '.cursor/skills',
        bundledMirrorRoot: TEMPLATE,
      })) {
        written.push(`removed:${rel}`);
      }
    }
    renderTree(TARGET, { sourceDir: engineSkillsRel, targetDir: '.cursor/skills', merge });
  } else if (!plan.cursorSkills) {
    removeGeneratedMirror('.cursor/skills');
  }
}

/** Remove vendor files dropped from the bundled engine since the last install. */
function pruneStaleVendorTree(installedRel, templateRel) {
  const installed = join(TARGET, installedRel);
  const template = join(TEMPLATE, templateRel);
  if (!existsSync(installed) || !existsSync(template)) return;
  for (const entry of readdirSync(installed, { withFileTypes: true })) {
    const childInstalled = join(installed, entry.name);
    const childTemplate = join(template, entry.name);
    const rel = join(installedRel, entry.name).replace(/\\/g, '/');
    if (!existsSync(childTemplate)) {
      rmSync(childInstalled, { recursive: true, force: true });
      written.push(`removed:${rel}`);
      continue;
    }
    if (entry.isDirectory()) pruneStaleVendorTree(rel, join(templateRel, entry.name).replace(/\\/g, '/'));
  }
}

/**
 * Install optional autonomy capability from template/.optional/autonomy → .harness/autonomy.
 * Preserves user policy, authz, control, and ledger files on refresh.
 */
function installAutonomyCapability() {
  const src = join(TEMPLATE, '.optional', 'autonomy');
  if (!existsSync(src)) {
    throw new Error(
      'create-midas: --autonomy requested but bundled capability is missing (.optional/autonomy). ' +
        'Rebuild the package (`npm run build`) or pin a release that includes ADR-009.',
    );
  }
  const dst = join(TARGET, '.harness', 'autonomy');
  mkdirSync(dst, { recursive: true });
  copyAutonomyTree(src, dst, '.harness/autonomy');
  const policyDst = join(dst, 'policy.yaml');
  if (!existsSync(policyDst)) {
    copyFileSync(join(src, 'policy.default.yaml'), policyDst);
    written.push('.harness/autonomy/policy.yaml');
  }
}

/** Append disabled autonomy pointers to an existing state.yaml when --autonomy is first enabled. */
function ensureAutonomyStatePointers() {
  const stateFile = join(TARGET, '.harness', 'state.yaml');
  if (!existsSync(stateFile)) return;
  const cur = readMaybe(stateFile);
  if (cur == null || /^autonomy:\s*$/m.test(cur)) return;
  const block = [
    '',
    '# Optional autonomy pointers (ADR-009) — disabled until policy enabled',
    'autonomy:',
    '  enabled: false',
    '  mode: disabled',
    '  status: idle',
    '  policy_digest: ""',
    '  active_agent_id: null',
    '  active_run_id: null',
    '  active_sha: null',
    '  journal_path: .harness/runs/autonomy/journal.jsonl',
    '  next_attempt_at: null',
    '',
  ].join('\n');
  writeFileSync(stateFile, cur.endsWith('\n') ? `${cur}${block}` : `${cur}\n${block}`);
  written.push('.harness/state.yaml (autonomy pointers)');
}

function copyAutonomyTree(srcDir, dstDir, relBase) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    const rel = `${relBase}/${entry.name}`.replace(/\\/g, '/');
    if (AUTONOMY_USER_NAMES.has(entry.name) && existsSync(dst)) {
      skipped.push(rel);
      continue;
    }
    if (entry.isDirectory()) {
      mkdirSync(dst, { recursive: true });
      copyAutonomyTree(src, dst, rel);
    } else {
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      written.push(rel);
    }
  }
}

function pruneStaleAutonomyVendor() {
  const installed = join(TARGET, '.harness', 'autonomy');
  const template = join(TEMPLATE, '.optional', 'autonomy');
  if (!existsSync(installed) || !existsSync(template)) return;
  for (const entry of readdirSync(installed, { withFileTypes: true })) {
    if (AUTONOMY_USER_NAMES.has(entry.name)) continue;
    const childInstalled = join(installed, entry.name);
    const childTemplate = join(template, entry.name);
    const rel = `.harness/autonomy/${entry.name}`;
    if (!existsSync(childTemplate)) {
      rmSync(childInstalled, { recursive: true, force: true });
      written.push(`removed:${rel}`);
    } else if (entry.isDirectory()) {
      pruneStaleAutonomyVendorDir(rel, join('.optional', 'autonomy', entry.name).replace(/\\/g, '/'));
    }
  }
}

function pruneStaleAutonomyVendorDir(installedRel, templateRel) {
  const installed = join(TARGET, installedRel);
  const template = join(TEMPLATE, templateRel);
  if (!existsSync(installed) || !existsSync(template)) return;
  for (const entry of readdirSync(installed, { withFileTypes: true })) {
    if (AUTONOMY_USER_NAMES.has(entry.name)) continue;
    const childInstalled = join(installed, entry.name);
    const childTemplate = join(template, entry.name);
    const rel = `${installedRel}/${entry.name}`.replace(/\\/g, '/');
    if (!existsSync(childTemplate)) {
      rmSync(childInstalled, { recursive: true, force: true });
      written.push(`removed:${rel}`);
      continue;
    }
    if (entry.isDirectory()) pruneStaleAutonomyVendorDir(rel, `${templateRel}/${entry.name}`);
  }
}

/** Drop legacy root artifacts superseded by harness-layout or pruned tools. */
function pruneLegacyRootArtifacts(tools) {
  if (!update) return;
  const engineAgentsDoc = join(TARGET, '.harness', 'engine', 'docs', 'agents-and-models.md');
  if (existsSync(engineAgentsDoc) && existsSync(join(TARGET, 'docs', 'agents-and-models.md'))) {
    rmFile('docs/agents-and-models.md');
    written.push('removed:docs/agents-and-models.md');
  }
  if (!tools.includes('gemini') && existsSync(join(TARGET, 'gemini-extension.json'))) {
    rmFile('gemini-extension.json');
    written.push('removed:gemini-extension.json');
  }
}

/** Remove Midas-generated adapters for tools not in the active set (after render-adapters). */
function pruneOrphanAdapters(tools) {
  const list = tools || [];
  if (!list.includes('windsurf')) removeGeneratedFile('.windsurf/rules/00-midas.md');
  if (!list.includes('gemini')) removeGeneratedFile('GEMINI.md');
  if (!list.includes('cursor')) removeGeneratedFile('.cursor/rules/00-midas.mdc');
  if (!list.includes('claude-code')) removeGeneratedFile('.claude/CLAUDE.md');
}

function removeGeneratedFile(rel) {
  const target = join(TARGET, rel);
  if (!existsSync(target)) return;
  const source = join(TEMPLATE, rel);
  if (existsSync(source)) {
    if (sameBytes(source, target)) {
      try { rmSync(target); } catch { /* keep */ }
    }
  } else {
    // Adapter-only renders (not shipped in template): drop when clearly Midas-managed.
    try {
      const text = readFileSync(target, 'utf8');
      if (/midas:begin|Generated by Midas/i.test(text)) rmSync(target);
    } catch { /* keep */ }
  }
  try {
    let dir = dirname(target);
    while (dir && dir !== TARGET) {
      const base = dir.slice(TARGET.length + 1).replace(/\\/g, '/');
      if (!['.windsurf', '.windsurf/rules', '.claude'].includes(base)) break;
      if (readdirSync(dir).length === 0) {
        rmdirSync(dir);
        dir = dirname(dir);
      } else break;
    }
  } catch { /* user content remains */ }
}

/** @deprecated name kept for grep/tests — use syncSkillMirrors */
function pruneHostMirrors(tools) {
  // syncSkillMirrors is async; this sync stub remains only if something still calls it.
  const plan = resolveSkillMirrorPlanLocal(tools);
  if (!plan.claude) {
    removeGeneratedMirror('.claude/skills');
    removeGeneratedMirror('.claude/agents');
  }
  if (!plan.agents) removeGeneratedMirror('.agents/skills');
  if (!plan.cursorSkills) removeGeneratedMirror('.cursor/skills');
}

/** Read `tools:` from existing state.yaml, or null. */
function readToolsFromState(paths) {
  const stateFile = join(TARGET, paths.state);
  const raw = readMaybe(stateFile);
  if (!raw) return null;
  const m = raw.match(/^tools:\s*\[([^\]]*)\]/m);
  if (!m) return null;
  const tools = m[1].split(',').map((t) => t.trim()).filter(Boolean);
  return tools.length ? tools : null;
}

async function resolveSelectedTools() {
  if (parsedCmd.tools) return parseToolsList(parsedCmd.tools.join(','));

  if (process.stdin.isTTY) return promptToolsInteractive();
  return [...DEFAULT_TOOLS];
}

async function promptToolsInteractive() {
  const rl = createInterface({ input, output });
  try {
    let mod = null;
    try {
      mod = await importTrustedScript('tool-profiles.mjs');
      mod.printCompatibilityMatrix([...DEFAULT_TOOLS]);
    } catch {
      console.log('\n  Which AI tools will you use with this project?');
      for (let i = 0; i < KNOWN_TOOLS.length; i++) console.log(`    ${i + 1}. ${KNOWN_TOOLS[i]}`);
      console.log('    a. all adapter tools (default)');
    }

    const answer = await askQuestion(
      rl,
      '\n  Numbers/names (comma-separated), preset (c|s|a), or Enter for cursor: ',
    );
    const trimmed = answer.trim();
    if (mod?.parseToolsPreset) {
      const preset = mod.parseToolsPreset(trimmed);
      if (preset) return preset;
    }
    if (!trimmed) return [...DEFAULT_TOOLS];
    if (/^a(ll)?$/i.test(trimmed)) return [...ALL_ADAPTER_TOOLS];

    const selected = [];
    for (const part of trimmed.split(',').map((s) => s.trim()).filter(Boolean)) {
      const num = Number.parseInt(part, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= KNOWN_TOOLS.length) {
        selected.push(KNOWN_TOOLS[num - 1]);
      } else if (KNOWN_TOOLS.includes(part)) {
        selected.push(part);
      } else {
        throw new Error(`create-midas: unknown selection "${part}". Known: ${KNOWN_TOOLS.join(', ')}`);
      }
    }
    const result = selected.length ? selected : [...DEFAULT_TOOLS];
    if (mod) mod.printCompatibilityMatrix(result);
    return result;
  } finally {
    rl.close();
  }
}

function askQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}


// Merge Midas .gitignore block (secrets, deps, volatile paths). Idempotent; upgrades missing patterns on --update.
// Runs after engine copy so the installed snippet (including new patterns) is the source of truth.
async function ensureGitignore(paths) {
  const { ensureMidasGitignore } = await importTrustedScript('gitignore-merge.mjs');
  const result = ensureMidasGitignore(TARGET);
  if (result.wrote && !written.includes('.gitignore')) written.push('.gitignore');
  return result;
}

/** Run midas-doctor on the target project; auto --fix once on adapter drift, then re-check. */
function runDoctor(target, paths, fix = false) {
  const doctorScript = join(target, paths.scripts, 'doctor.mjs');
  if (!existsSync(doctorScript)) return { ok: false, missing: true, out: '' };
  const args = fix ? [doctorScript, '--fix'] : [doctorScript, '--strict'];
  const r = spawnSync(process.execPath, args, { cwd: target, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, missing: false, out };
}

function verifyInstall(paths) {
  let result = runDoctor(TARGET, paths);
  if (!result.ok && !result.missing) {
    const autoFixable =
      /OUT OF SYNC|MISSING|DRIFT/.test(result.out) ||
      /STRICT:.*\b(routing|version)\b/.test(result.out);
    if (autoFixable) {
      runDoctor(TARGET, paths, true);
      result = runDoctor(TARGET, paths);
    }
  }
  return result;
}

// Coarse greenfield/brownfield guess for the default state.yaml — a provisional placeholder that
// `/midas-init` re-classifies into the E0–E3 maturity spectrum (it can read README/docs; this can't).
// Greenfield unless the target already has source/manifests or a kept AGENTS.md/CLAUDE.md.
function detectMode() {
  const manifests = ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'composer.json', 'Gemfile', 'requirements.txt'];
  const hasManifest = manifests.some((m) => existsSync(join(TARGET, m)));
  const hasSrc = ['src', 'lib', 'app'].some((d) => existsSync(join(TARGET, d)));
  const keptAgentFiles = skipped.some((f) => /^(AGENTS\.md|CLAUDE\.md)$/.test(f));
  return hasManifest || hasSrc || keptAgentFiles ? 'brownfield' : 'greenfield';
}

// Write a default .harness/state.yaml (never clobber an existing one). Returns the mode, or null.
function writeState(tools, paths, routingProfile = installRoutingProfile) {
  const stateFile = join(TARGET, paths.state);
  if (existsSync(stateFile)) return null;
  const version = (readMaybe(join(TARGET, paths.version)) || '0.0.0').trim();
  const mode = detectMode();
  const today = new Date().toISOString().slice(0, 10);
  const stage = mode === 'brownfield' ? 'tech_architecture' : 'idea_intake';
  const toolList = (tools || DEFAULT_TOOLS).join(', ');
  const routingProfileName = normalizeRoutingProfile(routingProfile) || DEFAULT_ROUTING_PROFILE;
  const routing = resolveRoutingModels(routingProfileName);
  const executionMode = routingProfileName === 'local-hybrid' ? 'hybrid' : 'cloud';
  const layoutLines = [
    'layout: harness',
    'paths:',
    '  root: .harness',
    '  engine: .harness/engine',
    '  scripts: .harness/scripts',
    '  state: .harness/state.yaml',
    '  product: .harness/product',
    '  rules: .harness/rules',
    '  runs: .harness/runs',
    '  cache: .harness/cache',
    '',
  ];
  const yaml = [
    `midas_version: ${version}`,
    ...layoutLines,
    `name: ${NAME}`,
    `mode: ${mode}`,
    'language: en',
    `created: ${today}`,
    `updated: ${today}`,
    'setup_complete: false        # /midas-init sets this true; until then it is the next step',
    '',
    `stage: ${stage}`,
    'stage_status: not_started',
    `entry_stage: ${stage}`,
    '',
    'cost_profile: balanced',
    `routing_profile: ${routingProfileName}`,
    'routing:',
    `  orchestrate: ${routing.orchestrate}`,
    `  build:       ${routing.build}`,
    `  scout:       ${routing.scout}`,
    '',
    `execution_mode: ${executionMode}`,
    ...(routingProfileName === 'local-hybrid'
      ? [
          '',
          'local_model:',
          '  id: local_model.id',
          '  runtime: ollama',
          '  vram_gb: 24',
        ]
      : []),
    '',
    `tools: [${toolList}]`,
    'mcp:   []',
    '',
    'phases: {}',
    'sprints: []',
    '',
    ...(installAutonomy
      ? [
          '# Optional autonomy pointers (ADR-009) — disabled until policy enabled',
          'autonomy:',
          '  enabled: false',
          '  mode: disabled',
          '  status: idle',
          '  policy_digest: ""',
          '  active_agent_id: null',
          '  active_run_id: null',
          '  active_sha: null',
          '  journal_path: .harness/runs/autonomy/journal.jsonl',
          '  next_attempt_at: null',
          '',
        ]
      : []),
  ].join('\n');
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, yaml, 'utf8');
  return mode;
}

// On --update, the engine files were overwritten (force=true) but the project's .harness/state.yaml is
// preserved; bump its midas_version stamp to the new engine version so /midas-status and /midas-doctor
// read it as current (a plain --force would leave it stale and doctor would warn).
function bumpVersionStamp(paths) {
  const f = join(TARGET, paths.state);
  const cur = readMaybe(f);
  if (cur == null) return null;
  const version = (readMaybe(join(TARGET, paths.version)) || '').trim();
  if (!version) return null;
  const today = new Date().toISOString().slice(0, 10);
  let next = cur.replace(/^midas_version:\s*[^\s#]+/m, `midas_version: ${version}`);
  if (/^updated:/m.test(next)) {
    next = next.replace(/^updated:\s*[^\s#]+/m, `updated: ${today}`);
  }
  if (next !== cur) writeFileSync(f, next, 'utf8');
  return version;
}

function reportGitignoreLine() {
  if (!gitignoreResult) {
    console.log('     .gitignore: skipped (gitignore-merge.mjs not on disk yet).');
    return;
  }
  if (gitignoreResult.wrote && gitignoreResult.upgraded) {
    console.log('     .gitignore upgraded — new Midas patterns merged from engine snippet.');
  } else if (gitignoreResult.wrote) {
    console.log('     .gitignore written — Midas block (secrets, deps, volatile paths).');
  } else {
    console.log('     .gitignore: Midas block already up to date.');
  }
}

async function report(tools, paths) {
  const doctorHint = `node ${paths.scripts}/doctor.mjs`;
  if (update || migrate) {
    console.log(`\n  ✨ Midas ${migrate ? 'migrated' : 'updated'} in ${TARGET}${updatedTo ? ` → v${updatedTo}` : ''}`);
    console.log(`     ${written.length} managed file(s) refreshed; ${paths.product}/, ${paths.rules}/, ${paths.runs}/, ${paths.state}, and .mcp.json are preserved.`);
    if (rendered) console.log(`     adapters re-rendered (per tools: in ${paths.state}).`);
    reportGitignoreLine();
    if (verifyResult?.ok) {
      console.log('     verify: ok — adapters in sync (midas-doctor passed).');
      console.log('     Update complete — no need to run /midas-update. Next: /midas-status in your editor.');
      console.log('     Reload Cursor if new slash commands do not appear.');
    } else if (verifyResult && !verifyResult.missing) {
      console.log('     verify: FAILED — adapters still out of sync after auto-fix.');
      console.log(`     Run \`${doctorHint} --fix\` in the project and check the output above.`);
    }
    console.log(`\n  If gitignore:midas-block warns later: \`${doctorHint} --fix\` re-applies the snippet.`);
    console.log('  Project rules live in `.harness/rules/`; vendor engine files are protected by manifest hashes.\n');
    return;
  }
  const activeTools = tools || DEFAULT_TOOLS;
  console.log(`\n  ✨ Midas installed into ${TARGET}`);
  console.log(
    `     ${written.length} files written` +
      (skipped.length ? `, ${skipped.length} skipped (already present — use --force to overwrite)` : ''),
  );
  if (rendered) {
    const adapterTools = activeTools.filter((t) => ['claude-code', 'cursor', 'windsurf', 'gemini'].includes(t));
    if (adapterTools.length) {
      console.log(`     adapters generated for: ${adapterTools.join(' · ')}`);
    } else {
      console.log('     no tool-specific adapters (Codex/Copilot use AGENTS.md)');
    }
  }
  if (stateMode) console.log(`     ${paths.state} created (mode: ${stateMode}, layout: ${paths.layout}, routing: ${installRoutingProfile}, tools: ${activeTools.join(', ')})`);
  if (installAutonomy || existsSync(join(TARGET, '.harness', 'autonomy', 'bin', 'midas-autopilot.mjs'))) {
    console.log('     autonomy: .harness/autonomy installed — run: node .harness/autonomy/bin/midas-autopilot.mjs setup');
  }
  reportGitignoreLine();
  if (verifyResult?.ok) console.log('     verify: ok — adapters in sync (midas-doctor passed).');

  const mod = await importTrustedScript('tool-profiles.mjs');
  mod.printToolOnboarding(activeTools, TARGET);

  const cd = targetArg === '.' ? '' : `cd ${targetArg} && `;
  console.log('\n  Universal next steps:');
  console.log(`     1. ${cd}run  /midas-init   — one-time setup (places you at the right phase)`);
  console.log('     2. then  /midas-status  — current phase + single next command');
  console.log('\n  Docs: https://github.com/okuzpe/midas-harness#supported-tools\n');
}

// --- uninstall (caveman pattern: `--uninstall` on the same installer; surgical, keeps your work) --

/** List every file shipped in the bundled template, as TARGET-relative POSIX paths. */
function listTemplateFiles(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listTemplateFiles(p, base, out);
    else out.push(relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}

function rmFile(rel) {
  if (dryRun) return;
  try { rmSync(join(TARGET, rel)); } catch { /* already gone */ }
}

// Strip the managed Midas block (and a standalone `@AGENTS.md` import / `# Project memory` heading)
// from a CLAUDE.md that may also carry the user's own notes. Returns the trimmed remainder.
function stripClaudeBlock(text) {
  const B = '<!-- midas:begin';
  const E = '<!-- midas:end -->';
  let out = text;
  const bi = out.indexOf(B);
  const ei = out.indexOf(E);
  if (bi !== -1 && ei !== -1 && ei > bi) out = out.slice(0, bi) + out.slice(ei + E.length);
  return out
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '@AGENTS.md' && l.trim() !== '# Project memory')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Recursively remove empty directories under a single engine root (bottom-up). Confined to the
// engine roots so a user's own empty directory elsewhere is never touched.
function pruneEmptyTree(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) pruneEmptyTree(join(dir, e.name));
  }
  try { if (readdirSync(dir).length === 0) rmdirSync(dir); } catch { /* ignore */ }
}

function templateToInstalledRel(rel, layout) {
  if (layout !== 'compact' && layout !== 'hub') return rel;
  if (rel.startsWith('harness/')) return rel.replace(/^harness\//, '.midas/engine/');
  if (rel.startsWith('scripts/')) return rel.replace(/^scripts\//, '.midas/scripts/');
  if (rel === 'docs/agents-and-models.md') return '.midas/docs/agents-and-models.md';
  return rel;
}

function runUninstall() {
  const removed = [], keptModified = [], keptUser = [], purged = [];
  const ADAPTERS = ['CLAUDE.md', '.cursor/rules/00-midas.mdc', '.windsurf/rules/00-midas.md', 'GEMINI.md'];
  const layout = detectInstallLayout(TARGET);
  if (layout === 'harness') {
    runCanonicalUninstall({ removed, keptModified, keptUser, purged });
    reportUninstall({ removed, keptModified, keptUser, purged, layout });
    return;
  }

  for (const rel of listTemplateFiles(TEMPLATE)) {
    if (rel === 'AGENTS.md') continue;
    const installedRel = templateToInstalledRel(rel, layout);
    const abs = join(TARGET, installedRel);
    if (!existsSync(abs)) continue;
    if (readFileSync(join(TEMPLATE, rel)).equals(readFileSync(abs))) {
      rmFile(installedRel);
      removed.push(installedRel);
    } else keptModified.push(installedRel);
  }

  if (existsSync(join(TARGET, 'AGENTS.md'))) {
    if (readFileSync(join(TARGET, 'AGENTS.md'), 'utf8').includes('generated** from the Midas harness')) {
      rmFile('AGENTS.md'); removed.push('AGENTS.md');
    } else keptUser.push('AGENTS.md (not Midas-generated — left untouched)');
  }

  for (const rel of ADAPTERS) {
    const abs = join(TARGET, rel);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    if (!text.includes('midas:begin')) { keptUser.push(`${rel} (no Midas marker — left untouched)`); continue; }
    if (rel === 'CLAUDE.md') {
      const rest = stripClaudeBlock(text);
      if (rest === '') { rmFile(rel); removed.push(rel); }
      else { if (!dryRun) writeFileSync(abs, rest + '\n', 'utf8'); keptModified.push('CLAUDE.md (removed Midas block; kept your notes)'); }
    } else { rmFile(rel); removed.push(rel); }
  }

  const hashPaths = layout === 'classic'
    ? ['.harness/adapters.hash']
    : ['.midas/cache/adapters.hash'];
  for (const hp of hashPaths) {
    if (existsSync(join(TARGET, hp))) { rmFile(hp); removed.push(hp); }
  }

  const workPaths = layout === 'hub'
    ? ['.midas']
    : layout === 'compact'
      ? ['product', '.midas', '.midas/state.yaml']
      : ['product', '.harness', 'harness/state.yaml'];
  for (const rel of workPaths) {
    if (!existsSync(join(TARGET, rel))) continue;
    if (purge) { if (!dryRun) rmSync(join(TARGET, rel), { recursive: true, force: true }); purged.push(rel); }
    else keptUser.push(`${rel} (your work — kept; re-run with --purge to remove)`);
  }

  pruneEmptyDirs(layout);
  reportUninstall({ removed, keptModified, keptUser, purged, layout });
}

function stripManagedBlock(text, begin, end) {
  const bi = text.indexOf(begin);
  const ei = text.indexOf(end);
  if (bi === -1 || ei < bi) return text;
  return `${text.slice(0, bi)}${text.slice(ei + end.length)}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function runCanonicalUninstall({ removed, keptModified, keptUser, purged }) {
  const manifest = readOwnershipManifest(TARGET);
  if (!manifest) {
    keptModified.push('.harness/manifest.json (missing or invalid — refusing ownership guesses)');
    return;
  }
  const regionManagedPaths = new Set([
    'AGENTS.md',
    '.claude/CLAUDE.md',
    'GEMINI.md',
    '.cursor/rules/00-midas.mdc',
    '.windsurf/rules/00-midas.md',
  ]);
  for (const file of manifest.files) {
    // These files may contain user-authored text outside Midas markers. They are reconciled below
    // by removing only the managed region, never by trusting a whole-file hash.
    if (regionManagedPaths.has(file.path)) continue;
    const abs = join(TARGET, file.path);
    if (!existsSync(abs)) continue;
    if (file.role === 'user') {
      keptUser.push(`${file.path} (user-owned)`);
      continue;
    }
    if (sha256File(abs) === file.sha256) {
      rmFile(file.path);
      removed.push(file.path);
    } else {
      keptModified.push(`${file.path} (modified — left untouched)`);
    }
  }

  for (const [rel, begin, end] of [
    ['AGENTS.md', '<!-- midas:begin AGENTS -->', '<!-- midas:end AGENTS -->'],
    ['.claude/CLAUDE.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['GEMINI.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.cursor/rules/00-midas.mdc', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.windsurf/rules/00-midas.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
  ]) {
    const abs = join(TARGET, rel);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, 'utf8');
    const clean = stripManagedBlock(raw, begin, end);
    if (clean === raw.trim()) continue;
    if (!dryRun) {
      if (clean) writeFileSync(abs, `${clean}\n`, 'utf8');
      else rmSync(abs, { force: true });
    }
    removed.push(`${rel} (Midas managed block)`);
  }

  const userPaths = [
    '.harness/product',
    '.harness/rules',
    '.harness/runs',
    '.harness/migrations/receipts',
    '.harness/migrations/backups',
    '.harness/state.yaml',
  ];
  for (const rel of userPaths) {
    if (!existsSync(join(TARGET, rel))) continue;
    if (purge) {
      if (!dryRun) rmSync(join(TARGET, rel), { recursive: true, force: true });
      purged.push(rel);
    } else {
      keptUser.push(`${rel} (your work — kept)`);
    }
  }
  if (!dryRun) rmSync(join(TARGET, '.harness', 'cache'), { recursive: true, force: true });
  if (!dryRun) rmSync(join(TARGET, '.harness', 'manifest.json'), { force: true });
  pruneEmptyDirs('harness');
}

function pruneEmptyDirs(layout) {
  if (dryRun) return;
  const roots = ['.claude', '.agents', '.cursor', '.windsurf', '.harness', 'harness', 'docs', 'scripts', '.midas'];
  for (const root of roots) pruneEmptyTree(join(TARGET, root));
}

function reportUninstall({ removed, keptModified, keptUser, purged, layout }) {
  const runsLabel = layout === 'harness' ? '.harness/runs/' : layout === 'classic' ? '.harness/' : '.midas/';
  console.log(`\n  🧹 Midas uninstall from ${TARGET}${dryRun ? '   (dry run — nothing deleted)' : ''}`);
  console.log(`     ${removed.length} engine file(s) ${dryRun ? 'would be removed' : 'removed'}` +
    (purged.length ? `, ${purged.length} work path(s) ${dryRun ? 'would be purged' : 'purged'}` : ''));
  if (keptModified.length) {
    console.log('\n  Kept — you modified these (remove by hand if you want them gone):');
    for (const f of keptModified) console.log(`     · ${f}`);
  }
  if (keptUser.length) {
    console.log('\n  Kept — your work / not Midas:');
    for (const f of keptUser) console.log(`     · ${f}`);
  }
  if (purged.length) {
    console.log('\n  Purged — your work, by --purge:');
    for (const f of purged) console.log(`     · ${f}`);
  }
  console.log(dryRun
    ? '\n  Re-run without --dry-run to apply.\n'
    : `\n  Done — Midas removed.${purge ? '' : ` Your .harness/product/, .harness/rules/, ${runsLabel} and state.yaml were kept (use --purge to remove those too).`}\n`);
}


  return executeInstallerCommand;
}
