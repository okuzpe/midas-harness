#!/usr/bin/env node
// create-midas — install the Midas product-development harness into a project.
//
//   npx github:okuzpe/midas-harness          # into the current directory
//   npx github:okuzpe/midas-harness my-app   # into ./my-app
//   (also: npm/pnpm/yarn/bun create midas, if published to npm)
//
// Non-destructive: copies the bundled harness into the target (skipping files that already exist —
// use --force to overwrite), generates the tool adapters, fills a PROJECT-oriented AGENTS.md, and
// writes a default .harness/state.yaml so the project is immediately usable. The one-time guided setup
// is `/midas-init` (run it in your editor). Dependency-free (Node 22+).

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, cpSync, rmSync, rmdirSync, mkdtempSync, statSync } from 'node:fs';
import { dirname, basename, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ROUTING_PROFILE, isKnownRoutingProfile, normalizeRoutingProfile, resolveRoutingModels } from './template/.harness/scripts/model-profiles.mjs';
import {
  applyV2Migration,
  detectLegacyLayout,
  extractLegacyRuleOverrides,
  formatMigrationPlan,
  planV2Migration,
  writeMigrationReceipt,
} from './migrate-v2.mjs';
import {
  findVendorConflicts,
  findGeneratedMirrorConflicts,
  readOwnershipManifest,
  sha256File,
  writeOwnershipManifest,
} from './template/.harness/scripts/ownership-manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, 'template');

/** Tools the installer accepts on `--tools`. codex/copilot have no generated adapter (AGENTS.md only). */
export const KNOWN_TOOLS = ['claude-code', 'cursor', 'windsurf', 'gemini', 'codex', 'copilot'];
const DEFAULT_TOOLS = ['claude-code', 'cursor', 'windsurf', 'gemini'];

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  printHelp();
  process.exit(0);
}
const update = args.includes('--update'); // refresh an existing install: overwrite engine + bump the version stamp
const migrate = args.includes('--migrate');
const applyMigration = args.includes('--apply');
const force = args.includes('--force') || update || migrate;
const uninstall = args.includes('--uninstall');
const diagnose = args.includes('--diagnose');
const dryRun = args.includes('--dry-run');
const purge = args.includes('--purge');
if (applyMigration && !migrate) {
  console.error('create-midas: --apply is valid only together with --migrate.');
  process.exit(1);
}
if ([update, migrate, uninstall].filter(Boolean).length > 1) {
  console.error('create-midas: choose exactly one of --update, --migrate, or --uninstall.');
  process.exit(1);
}
const routingArg = args.find((a) => a.startsWith('--routing='));
const installRoutingProfile = normalizeRoutingProfile(routingArg ? routingArg.slice('--routing='.length) : null) || DEFAULT_ROUTING_PROFILE;
if (routingArg && !isKnownRoutingProfile(installRoutingProfile)) {
  console.error('create-midas: --routing must be claude, openai-mini, or local-hybrid');
  process.exit(1);
}
const layoutArg = args.find((a) => a.startsWith('--layout='));
const installLayoutFlag = layoutArg ? layoutArg.slice('--layout='.length) : null;
if (installLayoutFlag && installLayoutFlag !== 'harness') {
  console.error('create-midas: v2 writes only --layout=harness.');
  console.error('  Existing classic/compact/hub installs must use --migrate first.');
  process.exit(1);
}
const targetArg = args.find((a) => !a.startsWith('-')) || '.';
const TARGET = resolve(process.cwd(), targetArg);
const NAME = basename(TARGET).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
const TEST_FAIL_STEP = process.env.MIDAS_TEST_FAIL_STEP || '';

if (diagnose) {
  const { runDiagnoseCli } = await import('./install-diagnose.mjs');
  let bundledVersion = '2.0.0-rc.1';
  try {
    bundledVersion = readFileSync(join(TEMPLATE, '.harness', 'engine', 'VERSION'), 'utf8').trim();
  } catch {
    /* template VERSION optional during dev */
  }
  const installCmd = `npx github:okuzpe/midas-harness#v${bundledVersion} --tools=cursor`;
  process.exit(runDiagnoseCli(TARGET, { installCmd }));
}

if (!existsSync(TEMPLATE)) {
  console.error('create-midas: bundled template is missing — please reinstall the package.');
  process.exit(1);
}

let migrationPlan = null;
let migrationOuterRollback = null;
if (migrate) {
  try {
    migrationPlan = planV2Migration(TARGET);
    console.log(formatMigrationPlan(migrationPlan));
    if (!applyMigration || migrationPlan.from_layout === 'harness') process.exit(0);
    migrationOuterRollback = beginRollbackSession(TARGET, installRollbackPaths());
    applyV2Migration(TARGET, migrationPlan);
    const canonicalNames = existsSync(join(TEMPLATE, '.harness', 'engine', 'rules'))
      ? readdirSync(join(TEMPLATE, '.harness', 'engine', 'rules')).filter((name) => name.endsWith('.md'))
      : [];
    extractLegacyRuleOverrides(TARGET, migrationPlan, canonicalNames);
    // Continue through the normal canonical install path. Migration itself is the explicit approval
    // to refresh the old engine to the v2 package currently executing.
  } catch (err) {
    if (migrationOuterRollback) {
      rollbackInstall(migrationOuterRollback);
      migrationOuterRollback = null;
    }
    console.error(`create-midas: migration failed — ${err.message || err}`);
    process.exit(1);
  }
}

// Uninstall path (caveman pattern: the same one command + `--uninstall`). Surgical and idempotent —
// it removes only Midas-authored files and leaves your work untouched. Defined below.
if (uninstall) {
  runUninstall();
  process.exit(0);
}

// --- pre-flight guards: refuse the two install footguns (added v0.5.17) ------------------------
// Guard 1 — --update only makes sense where an install already exists. Run in a fresh/wrong dir
// (e.g. a subfolder by mistake), the old behaviour silently scaffolded a brand-new nested install.
if (update && !hasMidasInstall(TARGET)) {
  console.error(`create-midas: --update found no existing Midas install in ${TARGET}`);
  console.error('  (no canonical .harness/ or legacy engine stamp here). Run --update from the project root,');
  console.error('  or drop --update to install fresh. Nothing was written.');
  console.error('  Tip: npx github:okuzpe/midas-harness --diagnose   (shows the exact next command)');
  process.exit(1);
}
if (update && detectLegacyLayout(TARGET) && detectLegacyLayout(TARGET) !== 'harness') {
  console.error('create-midas: this is a Midas 1.x layout; --update never relocates files.');
  console.error('  Preview: npx github:okuzpe/midas-harness#v2.0.0-rc.1 --migrate');
  console.error('  Apply:   npx github:okuzpe/midas-harness#v2.0.0-rc.1 --migrate --apply');
  process.exit(1);
}

if (update) {
  const manifest = readOwnershipManifest(TARGET);
  if (!manifest) {
    console.error('create-midas: canonical install has no valid .harness/manifest.json.');
    console.error('  Run --migrate for a v1 layout, or repair the manifest before updating.');
    process.exit(1);
  }
  const conflicts = findVendorConflicts(TARGET, manifest);
  if (conflicts.length) {
    console.error('create-midas: vendor files were modified; update aborted before writing:');
    for (const path of conflicts) console.error(`  - ${path}`);
    console.error('  Move project rules to .harness/rules and restore the vendor files first.');
    process.exit(1);
  }
  const mirrorConflicts = findGeneratedMirrorConflicts(TARGET, manifest);
  if (mirrorConflicts.length) {
    console.error('create-midas: generated Midas mirrors were modified; update aborted before writing:');
    for (const path of mirrorConflicts) console.error(`  - ${path}`);
    console.error('  Move custom skills to a separate name/path, then restore or regenerate the Midas mirror.');
    process.exit(1);
  }
}
// Guard 2 — a fresh install inside a directory that is ALREADY under a Midas project creates a
// duplicate, nested harness. Refuse unless the user truly means it (--force; or use /midas-init --monorepo).
if (!update && !force) {
  const ancestor = findAncestorMidasRoot(TARGET);
  if (ancestor) {
    console.error(`create-midas: ${TARGET} is already inside a Midas project (root: ${ancestor}).`);
    console.error('  Installing here would create a nested, duplicate harness. Run from the project root to');
    console.error('  update it, or pass --force if a nested install is truly intended. Nothing was written.');
    process.exit(1);
  }
}

const written = [];
const skipped = [];
const rollbackSession = beginRollbackSession(TARGET, installRollbackPaths());

let paths;
let selectedTools;
let stateMode;
let rendered = false;
let verifyResult = null;
let updatedTo = null;
let installError = null;
try {
  mkdirSync(TARGET, { recursive: true });
  copyTree(TEMPLATE, TARGET);
  maybeFail('after-copy-tree');

  maybeFail('after-layout');

  paths = await loadPaths(TARGET);

  // Fresh installs honour --tools (or an interactive prompt). --update keeps the existing state.yaml tools.
  selectedTools = update || migrate ? null : await resolveSelectedTools();

  stateMode = writeState(selectedTools, paths, installRoutingProfile);
  maybeFail('after-state');
  pruneHostMirrors(selectedTools || readToolsFromState(paths) || DEFAULT_TOOLS);

  // Generate tool adapters after state.yaml exists so render-adapters can read tools:.
  try {
    const renderPath = join(TARGET, paths.scripts, 'render-adapters.mjs');
    const mod = await import(pathToFileURL(renderPath).href);
    if (typeof mod.renderAdapters === 'function') {
      mod.renderAdapters(TARGET);
      rendered = true;
    }
  } catch (err) {
    console.error('create-midas: adapter render failed:', err.message || err);
  }

  fillAgents(selectedTools, paths);
  {
    const mcpSyncPath = join(TARGET, paths.scripts, 'mcp-cursor-sync.mjs');
    if (existsSync(mcpSyncPath)) {
      const { fixMcpFileForWindows, syncCursorMcp } = await import(pathToFileURL(mcpSyncPath).href);
      const rootMcp = join(TARGET, '.mcp.json');
      if (existsSync(rootMcp) && written.includes('.mcp.json')) {
        if (fixMcpFileForWindows(rootMcp)) written.push('.mcp.json');
      }
      const toolList = selectedTools || readToolsFromState(paths) || DEFAULT_TOOLS;
      const priorManifest = readOwnershipManifest(TARGET);
      const priorCursorMcp = priorManifest?.files?.find((file) => file.path === '.cursor/mcp.json');
      const ownedCursorMcp = priorCursorMcp &&
        existsSync(join(TARGET, '.cursor', 'mcp.json')) &&
        sha256File(join(TARGET, '.cursor', 'mcp.json')) === priorCursorMcp.sha256;
      const r = syncCursorMcp(TARGET, toolList, {
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
  await ensureGitignore(paths);

  updatedTo = update || migrate ? bumpVersionStamp(paths) : null;
  const installedVersion = (readMaybe(join(TARGET, paths.version)) || '0.0.0').trim();
  writeOwnershipManifest(TARGET, installedVersion);
  verifyResult = rendered ? verifyInstall(paths) : null;
  if (verifyResult && !verifyResult.ok) {
    throw new Error(
      verifyResult.missing
        ? `strict doctor missing at ${paths.scripts}/doctor.mjs`
        : `strict doctor verification failed\n${verifyResult.out}`,
    );
  }
  if (migrate && migrationPlan) writeMigrationReceipt(TARGET, migrationPlan, installedVersion);
  await report(selectedTools, paths);
} catch (err) {
  installError = err;
  rollbackInstall(rollbackSession);
} finally {
  if (rollbackSession) discardRollbackSession(rollbackSession);
}

if (installError) {
  if (migrationOuterRollback) {
    rollbackInstall(migrationOuterRollback);
    migrationOuterRollback = null;
  }
  console.error(`create-midas: install failed; restored previous files — ${installError.message || installError}`);
  process.exit(1);
}

if (migrationOuterRollback) {
  discardRollbackSession(migrationOuterRollback);
  migrationOuterRollback = null;
}

if (verifyResult && !verifyResult.ok) process.exit(1);

// --- helpers -----------------------------------------------------------------------------------

function copyTree(srcDir, dstDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
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
        ((!update) && (
          rel.startsWith('.claude/skills/') ||
          rel.startsWith('.claude/agents/') ||
          rel.startsWith('.agents/skills/')
        ));
      if (existsSync(dst) && (!force || alwaysPreserve)) {
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
  return ['.harness', '.claude', '.agents', '.cursor', '.windsurf', 'harness', 'scripts', '.midas', 'product', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.mcp.json', '.gitignore', 'gemini-extension.json', 'docs/agents-and-models.md'];
}

function beginRollbackSession(root, relPaths) {
  const backupRoot = mkdtempSync(join(tmpdir(), 'midas-install-backup-'));
  const entries = [];
  for (const rel of relPaths) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const info = statSync(abs);
    const kind = info.isDirectory() ? 'dir' : 'file';
    const backupAbs = join(backupRoot, rel);
    mkdirSync(dirname(backupAbs), { recursive: true });
    cpSync(abs, backupAbs, { recursive: kind === 'dir', force: true, preserveTimestamps: true });
    entries.push({ rel, kind });
  }
  return { root, backupRoot, relPaths: [...relPaths], entries };
}

function rollbackInstall(session) {
  if (!session) return;
  const cleanupPaths = [...new Set(session.relPaths)].sort((a, b) => b.length - a.length);
  for (const rel of cleanupPaths) {
    rmSync(join(session.root, rel), { recursive: true, force: true });
  }
  for (const { rel, kind } of session.entries) {
    const backupAbs = join(session.backupRoot, rel);
    if (!existsSync(backupAbs)) continue;
    const dst = join(session.root, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(backupAbs, dst, { recursive: kind === 'dir', force: true, preserveTimestamps: true });
  }
  rmSync(session.backupRoot, { recursive: true, force: true });
}

function discardRollbackSession(session) {
  if (!session) return;
  rmSync(session.backupRoot, { recursive: true, force: true });
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
  return (
    existsSync(join(dir, '.harness', 'engine', 'VERSION')) ||
    existsSync(join(dir, '.harness', 'state.yaml')) ||
    existsSync(join(dir, 'harness', 'VERSION')) ||
    existsSync(join(dir, 'harness', 'state.yaml')) ||
    existsSync(join(dir, '.midas', 'engine', 'VERSION')) ||
    existsSync(join(dir, '.midas', 'state.yaml'))
  );
}

function detectInstallLayout(dir) {
  const harnessState = join(dir, '.harness', 'state.yaml');
  if (existsSync(harnessState) || existsSync(join(dir, '.harness', 'engine', 'VERSION'))) {
    return 'harness';
  }
  const midasState = join(dir, '.midas', 'state.yaml');
  if (existsSync(midasState)) {
    const raw = readMaybe(midasState);
    const m = raw?.match(/^layout:\s*(\S+)/m);
    if (m?.[1] === 'hub') return 'hub';
    if (existsSync(join(dir, '.midas', 'product'))) return 'hub';
    return 'compact';
  }
  if (existsSync(join(dir, '.midas', 'engine', 'VERSION'))) {
    return existsSync(join(dir, '.midas', 'product')) ? 'hub' : 'compact';
  }
  if (existsSync(join(dir, 'harness', 'state.yaml')) || existsSync(join(dir, 'harness', 'VERSION'))) {
    return 'classic';
  }
  return 'harness';
}

/** Dynamic import of paths.mjs from the installed project. */
async function loadPaths(target) {
  const classic = join(target, 'scripts', 'paths.mjs');
  const compact = join(target, '.midas', 'scripts', 'paths.mjs');
  const canonical = join(target, '.harness', 'scripts', 'paths.mjs');
  const modPath = existsSync(canonical) ? canonical : existsSync(compact) ? compact : classic;
  if (!existsSync(modPath)) {
    return {
      layout: 'harness',
      root: '.harness',
      engine: '.harness/engine',
      scripts: '.harness/scripts',
      state: '.harness/state.yaml',
      version: '.harness/engine/VERSION',
      product: '.harness/product',
      rules: '.harness/rules',
      runs: '.harness/runs',
      cache: '.harness/cache',
      manifest: '.harness/manifest.json',
      projectRoot: target,
    };
  }
  const mod = await import(pathToFileURL(modPath).href);
  return mod.resolvePaths(target);
}

/** Walk up from TARGET's parent to the filesystem root; return the first ancestor that holds a Midas
 *  install, or null. Used to refuse a nested/duplicate install. */
function findAncestorMidasRoot(startDir) {
  let dir = dirname(startDir);
  for (;;) {
    if (hasMidasInstall(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
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
function pruneHostMirrors(tools) {
  if (!tools.includes('claude-code')) {
    removeGeneratedMirror('.claude/skills');
    removeGeneratedMirror('.claude/agents');
    try {
      const claudeDir = join(TARGET, '.claude');
      if (existsSync(claudeDir) && readdirSync(claudeDir).length === 0) rmdirSync(claudeDir);
    } catch { /* user content remains */ }
  }
  const portableHosts = ['cursor', 'windsurf', 'gemini', 'codex', 'copilot'];
  if (!tools.some((tool) => portableHosts.includes(tool))) {
    removeGeneratedMirror('.agents/skills');
    try {
      const agentsDir = join(TARGET, '.agents');
      if (existsSync(agentsDir) && readdirSync(agentsDir).length === 0) rmdirSync(agentsDir);
    } catch { /* user content remains */ }
  }
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

function parseToolsList(value) {
  const tools = value.split(',').map((t) => t.trim()).filter(Boolean);
  for (const t of tools) {
    if (!KNOWN_TOOLS.includes(t)) {
      console.error(`create-midas: unknown tool "${t}". Known: ${KNOWN_TOOLS.join(', ')}`);
      process.exit(1);
    }
  }
  if (!tools.length) {
    console.error('create-midas: --tools requires at least one tool.');
    process.exit(1);
  }
  return tools;
}

async function resolveSelectedTools() {
  const eq = args.find((a) => a.startsWith('--tools='));
  if (eq) return parseToolsList(eq.slice('--tools='.length));

  const flagIdx = args.indexOf('--tools');
  if (flagIdx !== -1) {
    const next = args[flagIdx + 1];
    if (!next || next.startsWith('-')) {
      console.error('create-midas: --tools requires a value (e.g. --tools=cursor or --tools cursor)');
      process.exit(1);
    }
    return parseToolsList(next);
  }

  if (process.stdin.isTTY) return promptToolsInteractive();
  return [...DEFAULT_TOOLS];
}

async function promptToolsInteractive() {
  const rl = createInterface({ input, output });
  try {
    const profilesPath = join(TARGET, paths?.scripts || 'scripts', 'tool-profiles.mjs');
    let mod = null;
    if (existsSync(profilesPath)) {
      mod = await import(pathToFileURL(profilesPath).href);
      mod.printCompatibilityMatrix([...DEFAULT_TOOLS]);
    } else {
      console.log('\n  Which AI tools will you use with this project?');
      for (let i = 0; i < KNOWN_TOOLS.length; i++) console.log(`    ${i + 1}. ${KNOWN_TOOLS[i]}`);
      console.log('    a. all adapter tools (default)');
    }

    const answer = await askQuestion(
      rl,
      '\n  Numbers/names (comma-separated), preset (c|s|a), or Enter for all: ',
    );
    const trimmed = answer.trim();
    if (mod?.parseToolsPreset) {
      const preset = mod.parseToolsPreset(trimmed);
      if (preset) return preset;
    }
    if (!trimmed || /^a(ll)?$/i.test(trimmed)) return [...DEFAULT_TOOLS];

    const selected = [];
    for (const part of trimmed.split(',').map((s) => s.trim()).filter(Boolean)) {
      const num = Number.parseInt(part, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= KNOWN_TOOLS.length) {
        selected.push(KNOWN_TOOLS[num - 1]);
      } else if (KNOWN_TOOLS.includes(part)) {
        selected.push(part);
      } else {
        console.error(`create-midas: unknown selection "${part}". Known: ${KNOWN_TOOLS.join(', ')}`);
        process.exit(1);
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
async function ensureGitignore(paths) {
  const mergePath = join(TARGET, paths.scripts, 'gitignore-merge.mjs');
  if (!existsSync(mergePath)) return;
  const { ensureMidasGitignore } = await import(pathToFileURL(mergePath).href);
  const { wrote } = ensureMidasGitignore(TARGET);
  if (wrote && !written.includes('.gitignore')) written.push('.gitignore');
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
  if (!result.ok && !result.missing && /OUT OF SYNC|MISSING|DRIFT/.test(result.out)) {
    runDoctor(TARGET, paths, true);
    result = runDoctor(TARGET, paths);
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
    'mcp:   [context7, sequential-thinking]',
    '',
    'phases: {}',
    'sprints: []',
    '',
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

async function report(tools, paths) {
  const doctorHint = `node ${paths.scripts}/doctor.mjs`;
  if (update || migrate) {
    console.log(`\n  ✨ Midas ${migrate ? 'migrated' : 'updated'} in ${TARGET}${updatedTo ? ` → v${updatedTo}` : ''}`);
    console.log(`     ${written.length} managed file(s) refreshed; ${paths.product}/, ${paths.rules}/, ${paths.runs}/, ${paths.state}, and .mcp.json are preserved.`);
    if (rendered) console.log(`     adapters re-rendered (per tools: in ${paths.state}).`);
    if (written.includes('.gitignore')) console.log('     .gitignore updated (secrets, node_modules/deps, Midas volatile paths).');
    if (verifyResult?.ok) {
      console.log('     verify: ok — adapters in sync (midas-doctor passed).');
    } else if (verifyResult && !verifyResult.missing) {
      console.log('     verify: FAILED — adapters still out of sync after auto-fix.');
      console.log(`     Run \`${doctorHint} --fix\` in the project and check the output above.`);
    }
    console.log('\n  Project rules live in `.harness/rules/`; vendor engine files are protected by manifest hashes.\n');
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
  if (written.includes('.gitignore')) console.log('     .gitignore updated (secrets, node_modules/deps, Midas volatile paths).');
  if (verifyResult?.ok) console.log('     verify: ok — adapters in sync (midas-doctor passed).');

  const profilesPath = join(TARGET, paths.scripts, 'tool-profiles.mjs');
  if (existsSync(profilesPath)) {
    const mod = await import(pathToFileURL(profilesPath).href);
    mod.printToolOnboarding(activeTools, TARGET);
  }

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

function printHelp() {
  console.log(`create-midas — install (or uninstall) the Midas harness in a project

Install:
  npx github:okuzpe/midas-harness          into the current directory (from GitHub)
  npx github:okuzpe/midas-harness my-app   into ./my-app
  npx github:okuzpe/midas-harness#v2.0.0-rc.1 --tools=cursor
  npx github:okuzpe/midas-harness --layout=harness   explicit no-op; v2 has one layout

Migrate an existing v1 install (always explicit):
  npx github:okuzpe/midas-harness#v2.0.0-rc.1 --migrate          preview only; writes nothing
  npx github:okuzpe/midas-harness#v2.0.0-rc.1 --migrate --apply  migrate transactionally + verify

Update an existing install (overwrites the engine, KEEPS your work, bumps the version stamp):
  npx github:okuzpe/midas-harness --update             refresh to the latest (main)
  npx github:okuzpe/midas-harness#v2.0.0-rc.1 --update refresh to a pinned release

Uninstall (surgical — removes only Midas's files, keeps your work):
  npx github:okuzpe/midas-harness --uninstall             remove owned engine files; keep product, rules, runs, state
  npx github:okuzpe/midas-harness --uninstall --dry-run   preview what would be removed
  npx github:okuzpe/midas-harness --uninstall --purge     also remove your .harness product, rules, runs and state

Options:
  --layout     only harness is accepted; classic/compact/hub are read-only migration inputs
  --routing    (install) claude, openai-mini, or local-hybrid (legacy openai alias accepted)
  --tools      (install) comma-separated AI tools (e.g. cursor or cursor,gemini,codex).
               Presets at interactive prompt: c=cursor · s=cursor,gemini,codex · a=all adapters.
               Interactive prompt when stdin is a TTY; defaults to all adapter tools otherwise.
               Ignored with --update (existing state.yaml tools: is preserved).
  --force      (install) overwrite files that already exist
  --migrate    preview a v1 → v2 migration without writing
  --apply      apply the migration plan; valid with --migrate
  --update     refresh an existing v2 install; never relocates a v1 layout
  --uninstall  remove Midas instead of installing it
  --dry-run    (uninstall) print the plan without deleting anything
  --purge      (uninstall) also delete your product artifacts and audit trail
  --diagnose   read-only — print install state and the single next command (no writes)
  -h, --help   show this help

After install, open the project in your chosen tool and run /midas-init (one-time setup), then /midas-status.
Not sure? Run: npx github:okuzpe/midas-harness --diagnose
Cursor:           npx github:okuzpe/midas-harness --tools=cursor
Migration preview: npx github:okuzpe/midas-harness#v2.0.0-rc.1 --migrate
Docs: https://github.com/okuzpe/midas-harness`);
}
