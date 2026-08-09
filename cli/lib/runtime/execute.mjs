// execute.mjs — install/update/migrate/uninstall execute leg + helpers (moved from index).
// Phase ops carry apply/verify; runPlanOps walks them. File-level copy-* ops stay informational.

import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';
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
import {
  acquireInstallLock,
  releaseInstallLock,
} from '../core/install-lock.mjs';
import {
  appendJournal,
  clearActiveRun,
  newInstallRunId,
  readActiveRun,
  removeInstallRun,
  sessionFromJournal,
  writeActiveRun,
} from '../core/install-journal.mjs';
import { assessUpdateConflicts } from '../core/conflicts.mjs';
import { runPlanOps } from '../core/runner.mjs';
import { bindExecutableOps } from '../steps/bind-applies.mjs';
import { mergeTraceHooks } from '../steps/trace-hooks.mjs';
import { mergeSafetyHooks } from '../steps/safety-hooks.mjs';
import { mergeCarryoverHooks } from '../steps/carryover-hooks.mjs';
import { mergeContextCostHooks } from '../steps/context-cost-hooks.mjs';
import { copyTree as copyTreeMod, resetFreshVendorTrees, pruneStaleVendorTree as pruneStaleVendorTreeMod } from './copy-tree.mjs';
import {
  installAutonomyCapability as installAutonomyCapabilityMod,
  ensureAutonomyStatePointers as ensureAutonomyStatePointersMod,
  pruneStaleAutonomyVendor as pruneStaleAutonomyVendorMod,
} from './autonomy-install.mjs';
import { runUninstall as runUninstallMod, rmTargetFile } from './uninstall.mjs';
import {
  fillAgents as fillAgentsMod,
  rewriteStateTools as rewriteStateToolsMod,
  ensureMigratedStateShape as ensureMigratedStateShapeMod,
  writeState as writeStateMod,
  bumpVersionStamp as bumpVersionStampMod,
  readToolsFromState as readToolsFromStateMod,
  detectMode as detectModeMod,
} from './state-write.mjs';
import {
  syncSkillMirrors as syncSkillMirrorsMod,
  pruneOrphanAdapters as pruneOrphanAdaptersMod,
  pruneLegacyRootArtifacts as pruneLegacyRootArtifactsMod,
  pruneHostMirrors as pruneHostMirrorsMod,
} from './skill-mirrors.mjs';

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


  let written = [];
  let skipped = [];
  let gitignoreResult = null;
  let stateMode = null;
  let rendered = false;
  let verifyResult = null;
  let updatedTo = null;

  function copyCtx() {
    return { target: TARGET, template: TEMPLATE, update, migrate, force, written, skipped };
  }
  function autonomyCtx() {
    return { target: TARGET, template: TEMPLATE, written, skipped, readMaybe };
  }
  function uninstallCtx() {
    return { target: TARGET, template: TEMPLATE, dryRun, purge, detectInstallLayout };
  }
  function stateCtx() {
    return {
      target: TARGET,
      template: TEMPLATE,
      name: NAME,
      installAutonomy,
      skipped,
      readMaybe,
    };
  }
  function skillCtx() {
    return {
      target: TARGET,
      template: TEMPLATE,
      update,
      written,
      importTrustedScript,
      rmFile,
    };
  }

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

    if (cmd.command === 'migrate' && !cmd.apply && !cmd.rollback && !cmd.resume) {
      const migrationPlan = planV2Migration(TARGET);
      if (!jsonOut) console.log(formatMigrationPlan(migrationPlan));
      return { ok: true, message: 'migrate preview — pass --apply to write' };
    }

    // Intentional journal rollback (crash recovery) — no re-apply.
    if (cmd.rollback && !cmd.dryRun) {
      const active = readActiveRun(TARGET);
      if (!active) {
        return {
          ok: false,
          exitCode: 1,
          outcome: 'FAILED_FATAL',
          message: 'create-midas: --rollback found no active.json installer run',
        };
      }
      const durable = sessionFromJournal(TARGET, active.run_id, installRollbackPaths());
      if (!durable) {
        return {
          ok: false,
          exitCode: 1,
          outcome: 'FAILED_FATAL',
          message: `create-midas: --rollback found no journal for run ${active.run_id}`,
        };
      }
      libRollbackInstall(durable);
      clearActiveRun(TARGET);
      releaseInstallLock(TARGET, { force: true });
      appendJournal(TARGET, active.run_id, { op: 'rollback', detail: 'intentional --rollback' });
      if (!jsonOut) {
        console.warn(`create-midas: rolled back installer run ${active.run_id}`);
      }
      return {
        ok: true,
        exitCode: 0,
        outcome: 'COMPLETED',
        message: `create-midas: rolled back installer run ${active.run_id}`,
      };
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
    let runId = null;
    let lockHeld = false;

    if (!cmd.dryRun) {
      const lock = acquireInstallLock(TARGET);
      if (!lock.ok) {
        const holder = lock.holder;
        return {
          ok: false,
          exitCode: 2,
          outcome: 'LOCK_HELD',
          message:
            `create-midas: installer lock held by pid ${holder?.pid} on ${holder?.hostname}` +
            ' — wait or remove a stale lock after confirming the other process is dead',
        };
      }
      lockHeld = true;

      const prior = readActiveRun(TARGET);
      if (cmd.resume) {
        if (!prior) {
          releaseInstallLock(TARGET);
          lockHeld = false;
          return {
            ok: false,
            exitCode: 1,
            outcome: 'FAILED_FATAL',
            message: 'create-midas: --resume found no active.json installer run',
          };
        }
        runId = prior.run_id;
        writeActiveRun(TARGET, {
          ...prior,
          step: 'resume',
          pid: process.pid,
        });
        appendJournal(TARGET, runId, { op: 'resume', command: cmd.command });
      } else if (prior) {
        releaseInstallLock(TARGET);
        lockHeld = false;
        return {
          ok: false,
          exitCode: 3,
          outcome: 'INCOMPLETE',
          message:
            `create-midas: incomplete installer run ${prior.run_id} (step=${prior.step})` +
            ' — pass --resume or --rollback',
        };
      } else {
        runId = newInstallRunId();
        writeActiveRun(TARGET, {
          run_id: runId,
          started_at: new Date().toISOString(),
          command: cmd.command,
          step: 'apply',
        });
        appendJournal(TARGET, runId, { op: 'start', command: cmd.command });
      }
    }

    let rollbackSession;
    if (cmd.resume && runId) {
      const durable = sessionFromJournal(TARGET, runId, installRollbackPaths());
      if (!durable) {
        releaseInstallLock(TARGET);
        lockHeld = false;
        return {
          ok: false,
          exitCode: 1,
          outcome: 'FAILED_FATAL',
          message:
            `create-midas: --resume for run ${runId} found no journal backups` +
            ' — use --rollback if the partial apply left nothing to restore, or fix the journal',
        };
      }
      libRollbackInstall(durable);
      appendJournal(TARGET, runId, { op: 'restored', detail: 'pre-resume rollback from journal' });
      rollbackSession = beginRollbackSession(TARGET, installRollbackPaths(), { runId });
    } else {
      rollbackSession = beginRollbackSession(TARGET, installRollbackPaths(), runId ? { runId } : {});
    }
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
        migrationOuterRollback = beginRollbackSession(
          TARGET,
          installRollbackPaths(),
          runId ? { runId: `${runId}-migrate-outer` } : {},
        );
      }

      if (runId) {
        writeActiveRun(TARGET, {
          run_id: runId,
          started_at: readActiveRun(TARGET)?.started_at || new Date().toISOString(),
          command: cmd.command,
          step: 'apply',
        });
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

      const ok = !(verifyResult && !verifyResult.ok);
      if (runId) {
        if (ok) {
          appendJournal(TARGET, runId, { op: 'complete' });
          clearActiveRun(TARGET);
        } else {
          writeActiveRun(TARGET, {
            run_id: runId,
            started_at: readActiveRun(TARGET)?.started_at || new Date().toISOString(),
            command: cmd.command,
            step: 'verify',
          });
          appendJournal(TARGET, runId, { op: 'needs_repair', detail: 'verify failed' });
        }
      }

      return {
        ok,
        exitCode: ok ? 0 : 6,
        outcome: ok ? 'COMPLETED' : 'NEEDS_REPAIR',
        verify: verifyResult ? { ok: !!verifyResult.ok } : null,
        written: [...written],
        skipped: [...skipped],
        message: updatedTo ? `updated → v${updatedTo}` : 'install complete',
      };
    } catch (err) {
      const outerRunId = migrationOuterRollback?.durable?.runId || null;
      rollbackInstall(rollbackSession);
      if (migrationOuterRollback) {
        rollbackInstall(migrationOuterRollback);
        migrationOuterRollback = null;
      }
      if (runId) {
        // In-process restore succeeded; clear active so the next run is not blocked.
        // Crash mid-apply (no finally clear) leaves active.json for --resume/--rollback.
        appendJournal(TARGET, runId, {
          op: 'rolled_back',
          detail: String(err.message || err),
        });
        clearActiveRun(TARGET);
        if (lockHeld) {
          releaseInstallLock(TARGET);
          lockHeld = false;
        }
        removeInstallRun(TARGET, runId);
        if (outerRunId) removeInstallRun(TARGET, outerRunId);
      }
      if (!jsonOut) {
        console.error(`create-midas: install failed; restored previous files — ${err.message || err}`);
      }
      return {
        ok: false,
        exitCode: 5,
        outcome: 'ROLLED_BACK',
        error: err,
        message: `create-midas: install failed; restored previous files — ${err.message || err}`,
      };
    } finally {
      if (rollbackSession) {
        const stillActive = runId && readActiveRun(TARGET);
        if (!(stillActive && rollbackSession.durable)) {
          discardRollbackSession(rollbackSession);
        }
      }
      if (lockHeld) releaseInstallLock(TARGET);
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
        resetFreshVendorTreesLocal();
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
        pruneOrphanAdapters(activeTools, paths.layout);
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
        // User-owned merge (ADR-011/012): seed/upsert only — never count as vendor "managed" files.
        if (activeTools.includes('cursor')) {
          mergeTraceHooks(TARGET);
          mergeSafetyHooks(TARGET);
          mergeCarryoverHooks(TARGET);
          mergeContextCostHooks(TARGET);
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

function resetFreshVendorTreesLocal() {
  resetFreshVendorTrees(copyCtx());
}

function copyTree(srcDir, dstDir) {
  copyTreeMod(srcDir, dstDir, copyCtx());
}

function installRollbackPaths() {
  // Durable backups live under `.harness/cache/installer/` — never snapshot that
  // parent (`.harness` or `.harness/cache`) or Node cpSync rejects self-subdir copies.
  const vendorAndAdapters = [
    '.harness/engine',
    '.harness/scripts',
    '.harness/autonomy',
    '.harness/manifest.json',
    '.harness/state.yaml',
    '.harness/migrations',
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
  if (update) {
    return vendorAndAdapters;
  }
  return [
    ...vendorAndAdapters,
    '.harness/product',
    '.harness/rules',
    '.harness/runs',
    'harness',
    'scripts',
    '.midas',
    'product',
    '.gitignore',
  ];
}

function beginRollbackSession(root, relPaths, opts = {}) {
  return libBeginRollbackSession(root, relPaths, opts);
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

function fillAgents(tools, paths) {
  fillAgentsMod(stateCtx(), tools, paths);
}

/** Keep only host discovery mirrors required by state.tools without deleting user-owned neighbors. */
function hasToolsFlag() {
  return parsedCmd.toolsFlag;
}

function rewriteStateTools(paths, tools) {
  rewriteStateToolsMod(stateCtx(), paths, tools);
}

function ensureMigratedStateShape(paths) {
  ensureMigratedStateShapeMod(stateCtx(), paths, installRoutingProfile);
}

async function syncSkillMirrors(tools, paths, { merge = true } = {}) {
  await syncSkillMirrorsMod(skillCtx(), tools, paths, { merge });
}

function pruneStaleVendorTree(installedRel, templateRel) {
  pruneStaleVendorTreeMod(copyCtx(), installedRel, templateRel);
}

function installAutonomyCapability() {
  installAutonomyCapabilityMod(autonomyCtx());
}

function ensureAutonomyStatePointers() {
  ensureAutonomyStatePointersMod(autonomyCtx());
}

function pruneStaleAutonomyVendor() {
  pruneStaleAutonomyVendorMod(autonomyCtx());
}

function pruneLegacyRootArtifacts(tools) {
  pruneLegacyRootArtifactsMod(skillCtx(), tools);
}

function pruneOrphanAdapters(tools, layout = 'harness') {
  pruneOrphanAdaptersMod(skillCtx(), tools, layout);
}

/** @deprecated name kept for grep/tests — use syncSkillMirrors */
function pruneHostMirrors(tools) {
  pruneHostMirrorsMod(skillCtx(), tools);
}

function readToolsFromState(paths) {
  return readToolsFromStateMod(stateCtx(), paths);
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
  return detectModeMod(stateCtx());
}

// Write a default .harness/state.yaml (never clobber an existing one). Returns the mode, or null.
function writeState(tools, paths, routingProfile = installRoutingProfile) {
  return writeStateMod(stateCtx(), tools, paths, routingProfile);
}

// On --update, the engine files were overwritten (force=true) but the project's .harness/state.yaml is
// preserved; bump its midas_version stamp to the new engine version so /midas-status and /midas-doctor
// read it as current (a plain --force would leave it stale and doctor would warn).
function bumpVersionStamp(paths) {
  return bumpVersionStampMod(stateCtx(), paths);
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

// --- uninstall (delegated) --------------------------------------------------------------
function rmFile(rel) {
  rmTargetFile(uninstallCtx(), rel);
}

function runUninstall() {
  runUninstallMod(uninstallCtx());
}

  return executeInstallerCommand;
}
