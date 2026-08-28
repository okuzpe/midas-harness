// execute.mjs — install/update/migrate/uninstall execute leg + helpers (moved from index).
// Phase ops carry apply/verify; runPlanOps walks them. File-level copy-* ops stay informational.

import { readdirSync, readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';
import {
  applyHarnessMigration,
  extractLegacyRuleOverrides,
  formatMigrationPlan,
  planHarnessMigration,
  writeMigrationReceipt,
} from '../../migrate-harness.mjs';
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
import { runPlanOps } from '../core/runner.mjs';
import { bindExecutableOps } from '../steps/bind-applies.mjs';
import { mergeTraceHooks } from '../steps/trace-hooks.mjs';
import { mergeSafetyHooks } from '../steps/safety-hooks.mjs';
import { mergeCarryoverHooks } from '../steps/carryover-hooks.mjs';
import { mergeContextCostHooks } from '../steps/context-cost-hooks.mjs';
import {
  copyTree as copyTreeMod,
  resetFreshVendorTrees,
  planVendorReconcile as planVendorReconcileMod,
  preserveVendorConflicts as preserveVendorConflictsMod,
  applyVendorRemovals as applyVendorRemovalsMod,
} from './copy-tree.mjs';
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
  // Defaults from argv; overwritten at the start of each execute(cmd) from the *resolved* command
  // (so --update promoted to migrate uses migrate rollback paths + migrate bind flags).
  let update = parsedCmd.command === 'update';
  let migrate = parsedCmd.command === 'migrate';
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
  /** @type {string | null} tmp backup retained by applyHarnessMigration until verify ok */
  let retainedMigrateBackup = null;
  /** @type {{ dir: string|null, paths: string[] } | null} local vendor edits saved before overwrite */
  let vendorConflictBackup = null;
  /** @type {string[]} vendor paths removed by reconcile this run */
  let vendorRemovals = [];
  /** @type {string[]} vendor-root files in neither manifest — reported, not deleted */
  let vendorUntracked = [];
  /** @type {{ channel: string|null, commit: string|null, ref: string|null }} release provenance to record */
  let channelMeta = { channel: null, commit: null, ref: null };
  /** @type {string[]} state migration ids applied this run */
  let migrationsApplied = [];

  function syncEffectiveFlags(cmd) {
    update = cmd.command === 'update';
    migrate = cmd.command === 'migrate';
  }

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
      // Only an explicit `--channel` changes what the project tracks; an update without the flag
      // must leave a project that opted into `edge` on `edge`.
      channel: parsedCmd.channel || null,
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
    syncEffectiveFlags(cmd);

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
      const migrationPlan = planHarnessMigration(TARGET);
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
      const pathOpts = {
        migrate: active.command === 'migrate',
        update: active.command === 'update',
      };
      const durable = sessionFromJournal(TARGET, active.run_id, installRollbackPaths(pathOpts));
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

    written = [];
    skipped = [];
    gitignoreResult = null;
    stateMode = null;
    rendered = false;
    verifyResult = null;
    updatedTo = null;
    retainedMigrateBackup = null;
    vendorConflictBackup = null;
    vendorRemovals = [];
    vendorUntracked = [];
    migrationsApplied = [];
    // The tree hash is always recomputed from disk; commit/ref are provenance claims, so record
    // them only when the bundle actually matches what the channel published.
    channelMeta = {
      channel: hooks.channelStatus?.channel ?? parsedCmd.channel ?? 'stable',
      commit: hooks.channelStatus?.integrity?.ok ? hooks.channelStatus.fetched.manifest.commit : null,
      ref: hooks.channelStatus?.integrity?.ok ? hooks.channelStatus.fetched.manifest.ref : null,
    };

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

      const ok = !(verifyResult && !verifyResult.ok);
      if (ok) {
        if (migrationOuterRollback) {
          discardRollbackSession(migrationOuterRollback);
          migrationOuterRollback = null;
        }
        clearRetainedMigrateBackup();
      }
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
          appendJournal(TARGET, runId, {
            op: 'needs_repair',
            detail: verifyResult?.missing
              ? 'doctor script missing'
              : 'verify failed (doctor --strict)',
          });
        }
      }

      if (!ok && !jsonOut) {
        const detail = verifyResult?.out?.trim() || 'doctor verification failed';
        console.error(
          'create-midas: apply finished but verify needs repair — tree left in place.\n' +
            `  Fix the doctor findings below, then: npx … --update --resume --yes\n` +
            `  Or undo this run: npx … --update --rollback --yes\n` +
            detail,
        );
      }

      return {
        ok,
        exitCode: ok ? 0 : 6,
        outcome: ok ? 'COMPLETED' : 'NEEDS_REPAIR',
        verify: verifyResult ? { ok: !!verifyResult.ok } : null,
        written: [...written],
        skipped: [...skipped],
        message: ok
          ? (updatedTo ? `updated → v${updatedTo}` : 'install complete')
          : 'create-midas: NEEDS_REPAIR — verify failed after apply; use --resume or --rollback',
      };
    } catch (err) {
      const outerRunId = migrationOuterRollback?.durable?.runId || null;
      rollbackInstall(rollbackSession);
      if (migrationOuterRollback) {
        rollbackInstall(migrationOuterRollback);
        migrationOuterRollback = null;
      }
      clearRetainedMigrateBackup();
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
      const msg = `create-midas: apply failed; restored from installer backups — ${err.message || err}`;
      if (!jsonOut) {
        console.error(msg);
      }
      return {
        ok: false,
        exitCode: 5,
        outcome: 'ROLLED_BACK',
        error: err,
        message: msg,
      };
    } finally {
      if (rollbackSession) {
        const stillActive = runId && readActiveRun(TARGET);
        // Keep durable backups when NEEDS_REPAIR (active.json still present) for --rollback.
        if (!(stillActive && rollbackSession.durable)) {
          discardRollbackSession(rollbackSession);
        }
      }
      if (migrationOuterRollback) {
        const stillActive = runId && readActiveRun(TARGET);
        if (!(stillActive && migrationOuterRollback.durable)) {
          discardRollbackSession(migrationOuterRollback);
          migrationOuterRollback = null;
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
        const plan = planHarnessMigration(TARGET);
        if (!jsonOut) console.log(formatMigrationPlan(plan));
        if (plan.from_layout === 'harness') return;
        if (extra.setMigrationPlan) extra.setMigrationPlan(plan);
        else session.migrationPlan = plan;
        const result = applyHarnessMigration(TARGET, plan, { retainBackup: true });
        if (result?.retainedBackup) retainedMigrateBackup = result.retainedBackup;
        const canonicalNames = existsSync(join(TEMPLATE, '.harness', 'engine', 'rules'))
          ? readdirSync(join(TEMPLATE, '.harness', 'engine', 'rules')).filter((name) => name.endsWith('.md'))
          : [];
        extractLegacyRuleOverrides(TARGET, plan, canonicalNames);
      },

      async applyPhaseCopy() {
        mkdirSync(TARGET, { recursive: true });
        if (update && !migrate) await runUpdatePreflight();
        resetFreshVendorTreesLocal();
        // Reconcile is planned before the copy (it needs the pre-copy disk state) and its removals
        // are applied after, so the bundle copy cannot resurrect a file the bundle dropped.
        const reconcilePlan = update ? planVendorReconcile() : null;
        if (reconcilePlan) {
          const preserved = preserveVendorConflicts(reconcilePlan);
          if (preserved.dir) {
            vendorConflictBackup = preserved;
            console.warn(
              `create-midas: ${preserved.paths.length} locally-modified vendor file(s) saved to ${preserved.dir}`,
            );
          }
        }
        copyTree(TEMPLATE, TARGET);
        maybeFail('after-copy-tree');
        if (reconcilePlan) {
          vendorRemovals = applyVendorRemovals(reconcilePlan);
          vendorUntracked = (reconcilePlan.untracked || []).map((entry) => entry.path);
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
        await runStateMigrations(session.paths);
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
        // Always align preserved state.yaml with the engine we just laid down (re-install without --update).
        updatedTo = bumpVersionStamp(paths);
        const installedVersion = (readMaybe(join(TARGET, paths.version)) || '0.0.0').trim();
        writeOwnershipManifest(TARGET, installedVersion, channelMeta);
      },

      async applyVerifyDoctor() {
        const paths = session.paths || await loadPaths(TARGET);
        session.paths = paths;
        verifyResult = update || migrate || rendered ? verifyInstall(paths) : null;
      },

      async verifyDoctorOk() {
        // Do not throw — NEEDS_REPAIR path after runPlanOps must run (docs/installer-outcomes.md).
        // Missing doctor script is still a hard apply failure.
        if (verifyResult?.missing) {
          throw new Error(`strict doctor missing at ${session.paths.scripts}/doctor.mjs`);
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

function installRollbackPaths(opts = {}) {
  // Durable backups live under `.harness/cache/installer/` — never snapshot that
  // parent (`.harness` or `.harness/cache`) or Node cpSync rejects self-subdir copies.
  const asMigrate = opts.migrate ?? migrate;
  const asUpdate = opts.update ?? update;
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
  // Pure --update on harness layout: vendor/adapters only.
  // Migrate (including --update promote) and fresh install: full layout restore set.
  if (asUpdate && !asMigrate) {
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

function clearRetainedMigrateBackup() {
  if (!retainedMigrateBackup) return;
  try {
    rmSync(retainedMigrateBackup, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup of tmp migrate backup.
  }
  retainedMigrateBackup = null;
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

/**
 * Apply state migrations shipped with the engine we just laid down.
 *
 * A fresh install has no legacy shape to migrate, so it records every shipped id as a baseline —
 * otherwise the first update would replay years of historical migrations against a modern tree.
 */
async function runStateMigrations(paths) {
  let mod;
  try {
    mod = await importTrustedScript('lib/migrate-state.mjs');
  } catch {
    return;
  }
  const opts = { engineDir: paths.engine, statePath: paths.state };
  if (update || migrate) {
    const result = await mod.applyStateMigrations(TARGET, opts);
    migrationsApplied = result.applied;
    if (result.applied.length) {
      written.push(...result.applied.map((id) => `migration:${id}`));
    }
    return;
  }
  const statePath = join(TARGET, paths.state);
  if (!existsSync(statePath)) return;
  const shipped = await mod.loadMigrations(join(TARGET, paths.engine));
  if (!shipped.length) return;
  const yaml = readFileSync(statePath, 'utf8');
  const known = mod.parseAppliedMigrations(yaml);
  const ids = [...new Set([...known, ...shipped.map((m) => m.id)])].sort();
  if (ids.length !== known.length) {
    writeFileSync(statePath, mod.writeAppliedMigrations(yaml, ids), 'utf8');
  }
}

function planVendorReconcile() {
  return planVendorReconcileMod(copyCtx());
}

function preserveVendorConflicts(plan) {
  return preserveVendorConflictsMod(copyCtx(), plan);
}

function applyVendorRemovals(plan) {
  return applyVendorRemovalsMod(copyCtx(), plan);
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
function runDoctor(target, paths, fix = false, profile = 'install-verify') {
  const doctorScript = join(target, paths.scripts, 'doctor.mjs');
  if (!existsSync(doctorScript)) return { ok: false, missing: true, out: '' };
  const args = fix
    ? [doctorScript, '--fix']
    : [doctorScript, '--strict', `--profile=${profile}`];
  const r = spawnSync(process.execPath, args, { cwd: target, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, missing: false, out };
}

/**
 * Pre-apply gate for update. Runs the **bundled** doctor (not the installed one — an older install
 * would not know this profile and would apply full strictness, blocking the very update meant to
 * fix it) with the narrow `update-preflight` set: only states that make the update itself unsafe
 * stop it, never the drift the update is about to repair.
 */
async function runUpdatePreflight() {
  const paths = await loadPaths(TARGET);
  let doctorScript;
  try {
    doctorScript = trustedScriptPath('doctor.mjs');
  } catch {
    return;
  }
  const r = spawnSync(
    process.execPath,
    [doctorScript, '--strict', '--profile=update-preflight', TARGET],
    { cwd: TARGET, encoding: 'utf8' },
  );
  if (r.status === 0) return;
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const reason = ((out.match(/^STRICT.*$/m) || [])[0] || 'update preflight failed').trim();
  // The STRICT line names the checks; their own doctor lines carry the fix. Quote those, so the
  // user is told what to do here instead of being sent to run another command to find out.
  const failing = (reason.split(/failed:\s*/).pop() || '')
    .split(/,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
  const details = failing
    .map((name) => (out.match(new RegExp(`^.*\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b.*$`, 'm')) || [])[0])
    .filter((line) => line && !line.startsWith('STRICT'))
    .map((line) => `  ${line.trim()}`);
  throw new Error(
    [
      reason,
      ...details,
      `  fix the above, then run the update again (details: \`node ${paths.scripts}/doctor.mjs\`)`,
    ].join('\n'),
  );
}

function verifyInstall(paths) {
  // Test hook: force NEEDS_REPAIR without mutating doctor (SinFalta-shape regression).
  if (process.env.MIDAS_TEST_VERIFY_FAIL === '1') {
    return { ok: false, missing: false, out: 'MIDAS_TEST_VERIFY_FAIL=1' };
  }
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
    if (vendorRemovals.length) {
      console.log(`     ${vendorRemovals.length} file(s) dropped from the engine were removed.`);
    }
    if (vendorUntracked.length) {
      console.log(`     ${vendorUntracked.length} untracked file(s) inside vendor roots were left in place.`);
    }
    if (vendorConflictBackup?.dir) {
      console.log(`     ${vendorConflictBackup.paths.length} vendor file(s) you had edited were saved to ${vendorConflictBackup.dir}`);
      console.log('     Vendor files are engine-owned; move project changes to your rules overlay.');
    }
    if (migrationsApplied.length) {
      console.log(`     state migrations applied: ${migrationsApplied.join(', ')}`);
    }
    if (rendered) console.log(`     adapters re-rendered (per tools: in ${paths.state}).`);
    reportGitignoreLine();
    if (verifyResult?.ok) {
      console.log('     verify: ok — adapters in sync (midas-doctor passed).');
      console.log('     Update complete — no need to run /midas-init for refresh. Next: /midas-status in your editor.');
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
