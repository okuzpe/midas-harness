#!/usr/bin/env node
// create-midas — install the Midas product-development harness into a project.
//
//   npx github:okuzpe/midas-harness          # into the current directory
//   npx github:okuzpe/midas-harness my-app   # into ./my-app
//   (also: npm/pnpm/yarn/bun create midas, if published to npm)
//
// Non-destructive: copies the bundled harness into the target (skipping files that already exist —
// use --force to overwrite), generates the tool adapters, fills a PROJECT-oriented AGENTS.md, and
// writes a default harness/state.yaml so the project is immediately usable. The one-time guided setup
// is `/midas-init` (run it in your editor). Dependency-free (Node 16.7+). It only adds files.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, rmdirSync, renameSync } from 'node:fs';
import { dirname, basename, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';

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
const force = args.includes('--force') || update;
const uninstall = args.includes('--uninstall');
const dryRun = args.includes('--dry-run');
const purge = args.includes('--purge');
const layoutArg = args.find((a) => a.startsWith('--layout='));
const installLayoutFlag = layoutArg ? layoutArg.slice('--layout='.length) : null;
if (installLayoutFlag && !['classic', 'compact', 'hub'].includes(installLayoutFlag)) {
  console.error('create-midas: --layout must be classic, compact, or hub');
  process.exit(1);
}
const targetArg = args.find((a) => !a.startsWith('-')) || '.';
const TARGET = resolve(process.cwd(), targetArg);
const NAME = basename(TARGET).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'project';

if (!existsSync(TEMPLATE)) {
  console.error('create-midas: bundled template is missing — please reinstall the package.');
  process.exit(1);
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
  console.error('  (no harness/ or .midas/ engine stamp here). Run --update from the project root,');
  console.error('  or drop --update to install fresh. Nothing was written.');
  process.exit(1);
}
// Guard 2 — a fresh install inside a directory that is ALREADY under a Midas project creates a
// duplicate, nested harness. Refuse unless the user truly means it (--force; or use /midas-monorepo).
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

const installLayout = resolveInstallLayout();

mkdirSync(TARGET, { recursive: true });
copyTree(TEMPLATE, TARGET);

if (installLayout === 'hub') {
  applyHubLayout();
} else if (installLayout === 'compact') {
  applyCompactLayout();
}

const paths = await loadPaths(TARGET);

// Fresh installs honour --tools (or an interactive prompt). --update keeps the existing state.yaml tools.
const selectedTools = update ? null : await resolveSelectedTools();

const stateMode = writeState(selectedTools, paths);

// Generate tool adapters after state.yaml exists so render-adapters can read tools:.
let rendered = false;
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
ensureGeminiExtension(selectedTools || readToolsFromState(paths) || DEFAULT_TOOLS, paths);
{
  const mcpSyncPath = join(TARGET, paths.scripts, 'mcp-cursor-sync.mjs');
  if (existsSync(mcpSyncPath)) {
    const { fixMcpFileForWindows, syncCursorMcp } = await import(pathToFileURL(mcpSyncPath).href);
    const rootMcp = join(TARGET, '.mcp.json');
    if (existsSync(rootMcp) && (written.includes('.mcp.json') || update)) {
      if (fixMcpFileForWindows(rootMcp)) written.push('.mcp.json');
    }
    const toolList = selectedTools || readToolsFromState(paths) || DEFAULT_TOOLS;
    const r = syncCursorMcp(TARGET, toolList, { wrapRoot: written.includes('.mcp.json') || update });
    if (r.synced && !written.includes('.cursor/mcp.json')) written.push('.cursor/mcp.json');
  }
}
await ensureGitignore(paths);

const verifyResult = rendered ? verifyInstall(paths) : null;

const updatedTo = update ? bumpVersionStamp(paths) : null;
await report(selectedTools, paths);

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
      if (existsSync(dst) && (!force || rel === '.mcp.json')) {
        skipped.push(rel);
        continue;
      }
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      written.push(rel);
    }
  }
}

function readMaybe(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

/** True if `dir` already holds a Midas install — classic or compact markers. */
function hasMidasInstall(dir) {
  return (
    existsSync(join(dir, 'harness', 'VERSION')) ||
    existsSync(join(dir, 'harness', 'state.yaml')) ||
    existsSync(join(dir, '.midas', 'engine', 'VERSION')) ||
    existsSync(join(dir, '.midas', 'state.yaml'))
  );
}

function detectInstallLayout(dir) {
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
  return installLayoutFlag || 'hub';
}

function resolveInstallLayout() {
  if (update) return detectInstallLayout(TARGET);
  return installLayoutFlag || 'hub';
}

/** Dynamic import of paths.mjs from the installed project. */
async function loadPaths(target) {
  const classic = join(target, 'scripts', 'paths.mjs');
  const compact = join(target, '.midas', 'scripts', 'paths.mjs');
  const modPath = existsSync(compact) ? compact : classic;
  if (!existsSync(modPath)) {
    return {
      layout: 'classic',
      engine: 'harness',
      scripts: 'scripts',
      state: 'harness/state.yaml',
      version: 'harness/VERSION',
      runs: '.harness',
      projectRoot: target,
    };
  }
  const mod = await import(pathToFileURL(modPath).href);
  return mod.resolvePaths(target);
}

/** Relocate classic template tree to .midas/ after copyTree. */
function applyCompactLayout() {
  const moves = [
    { from: 'harness', to: '.midas/engine', type: 'dir' },
    { from: 'scripts', to: '.midas/scripts', type: 'dir' },
    { from: 'docs/agents-and-models.md', to: '.midas/docs/agents-and-models.md', type: 'file' },
  ];
  for (const m of moves) {
    const src = join(TARGET, m.from);
    const dst = join(TARGET, m.to);
    if (!existsSync(src)) continue;
    if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
    mkdirSync(dirname(dst), { recursive: true });
    renameSync(src, dst);
  }
  const classicState = join(TARGET, 'harness', 'state.yaml');
  const engineState = join(TARGET, '.midas', 'engine', 'state.yaml');
  const compactState = join(TARGET, '.midas', 'state.yaml');
  if (existsSync(classicState) && !existsSync(compactState)) {
    mkdirSync(dirname(compactState), { recursive: true });
    renameSync(classicState, compactState);
  } else if (existsSync(engineState) && !existsSync(compactState)) {
    mkdirSync(dirname(compactState), { recursive: true });
    renameSync(engineState, compactState);
  }
}

/** Hub = compact engine + product under .midas/product/. */
function applyHubLayout() {
  applyCompactLayout();
  const productSrc = join(TARGET, 'product');
  const productDst = join(TARGET, '.midas', 'product');
  mkdirSync(join(TARGET, '.midas'), { recursive: true });
  if (existsSync(productSrc)) {
    if (existsSync(productDst)) rmSync(productDst, { recursive: true, force: true });
    renameSync(productSrc, productDst);
  } else if (!existsSync(productDst)) {
    mkdirSync(productDst, { recursive: true });
  }
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
  const t = readMaybe(f);
  if (t == null || !t.includes('{{')) return;
  const list = (tools || readToolsFromState(paths) || DEFAULT_TOOLS).join(', ');
  const filled = t
    .replace(/\{\{PROJECT_NAME\}\}/g, NAME)
    .replace(/\{\{STACK\}\}/g, 'undecided — set in Phase 4 (`/choose-architecture`)')
    .replace(/\{\{TOOLS\}\}/g, list);
  writeFileSync(f, filled, 'utf8');
}

/** Write gemini-extension.json when Gemini CLI is in tools (version from engine VERSION). */
function ensureGeminiExtension(tools, paths) {
  if (!tools.includes('gemini')) return;
  const version = (readMaybe(join(TARGET, paths.version)) || '0.0.0').trim();
  const rel = 'gemini-extension.json';
  const ext = {
    name: 'midas',
    description:
      'Midas product-development harness — drives a product from idea to shipped code through 9 audited phases. Reads project law from GEMINI.md / AGENTS.md.',
    version,
    contextFileName: 'GEMINI.md',
  };
  writeFileSync(join(TARGET, rel), `${JSON.stringify(ext, null, 2)}\n`, 'utf8');
  if (!written.includes(rel)) written.push(rel);
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

    const answer = await rl.question(
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
  const args = fix ? [doctorScript, '--fix'] : [doctorScript];
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

// Write a default harness/state.yaml (never clobber an existing one). Returns the mode, or null.
function writeState(tools, paths) {
  const stateFile = join(TARGET, paths.state);
  if (existsSync(stateFile)) return null;
  const version = (readMaybe(join(TARGET, paths.version)) || '0.0.0').trim();
  const mode = detectMode();
  const today = new Date().toISOString().slice(0, 10);
  const stage = mode === 'brownfield' ? 'tech_architecture' : 'idea_intake';
  const toolList = (tools || DEFAULT_TOOLS).join(', ');
  const layoutLines =
    paths.layout === 'hub'
      ? [
          'layout: hub',
          'paths:',
          '  engine: .midas/engine',
          '  scripts: .midas/scripts',
          '  state: .midas/state.yaml',
          '  runs: .midas',
          '  product: .midas/product',
          '',
        ]
      : paths.layout === 'compact'
        ? [
            'layout: compact',
            'paths:',
            '  engine: .midas/engine',
            '  scripts: .midas/scripts',
            '  state: .midas/state.yaml',
            '  runs: .midas',
            '',
          ]
        : [];
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
    'routing:',
    '  orchestrate: claude-opus-4-8',
    '  build:       claude-sonnet-4-6',
    '  scout:       claude-haiku-4-5',
    '',
    'execution_mode: cloud',
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

// On --update, the engine files were overwritten (force=true) but the project's harness/state.yaml is
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
  if (update) {
    console.log(`\n  ✨ Midas updated in ${TARGET}${updatedTo ? ` → v${updatedTo}` : ''}`);
    console.log(`     ${written.length} engine file(s) refreshed; your product/, ${paths.runs}/, ${paths.state}, and .mcp.json are preserved.`);
    if (rendered) console.log(`     adapters re-rendered (per tools: in ${paths.state}).`);
    if (written.includes('.gitignore')) console.log('     .gitignore updated (secrets, node_modules/deps, Midas volatile paths).');
    if (verifyResult?.ok) {
      console.log('     verify: ok — adapters in sync (midas-doctor passed).');
    } else if (verifyResult && !verifyResult.missing) {
      console.log('     verify: FAILED — adapters still out of sync after auto-fix.');
      console.log(`     Run \`${doctorHint} --fix\` in the project and check the output above.`);
    }
    console.log('\n  Heads-up: --update overwrites engine files. If you consciously amended a rule, review');
    console.log('  `git diff` and re-apply your `## Amendment` if it was clobbered.\n');
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
  if (stateMode) console.log(`     ${paths.state} created (mode: ${stateMode}, layout: ${paths.layout}, tools: ${activeTools.join(', ')})`);
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

function pruneEmptyDirs(layout) {
  if (dryRun) return;
  const roots = ['.claude', '.cursor', '.windsurf', '.harness', 'harness', 'docs', 'scripts', '.midas'];
  for (const root of roots) pruneEmptyTree(join(TARGET, root));
}

function reportUninstall({ removed, keptModified, keptUser, purged, layout }) {
  const runsLabel = layout === 'classic' ? '.harness/' : '.midas/';
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
    : `\n  Done — Midas removed.${purge ? '' : ` Your product/, ${runsLabel} and state.yaml were kept (use --purge to remove those too).`}\n`);
}

function printHelp() {
  console.log(`create-midas — install (or uninstall) the Midas harness in a project

Install:
  npx github:okuzpe/midas-harness          into the current directory (from GitHub)
  npx github:okuzpe/midas-harness my-app   into ./my-app
  npx github:okuzpe/midas-harness#v1.0.0   pin a release for a reproducible install
  npx github:okuzpe/midas-harness --layout=hub   explicit hub (default when flag omitted)
  npx github:okuzpe/midas-harness --layout=classic   legacy layout (harness/ at repo root)
  npx github:okuzpe/midas-harness --layout=compact   engine under .midas/, product at root (ADR-001)

Update an existing install (overwrites the engine, KEEPS your work, bumps the version stamp):
  npx github:okuzpe/midas-harness --update             refresh to the latest (main)
  npx github:okuzpe/midas-harness#v1.0.0 --update      refresh to a pinned release

Uninstall (surgical — removes only Midas's files, keeps your work):
  npx github:okuzpe/midas-harness --uninstall             remove the engine, keep product/ + runs + state.yaml
  npx github:okuzpe/midas-harness --uninstall --dry-run   preview what would be removed
  npx github:okuzpe/midas-harness --uninstall --purge     also remove your product/, runs/ and state.yaml

Options:
  --layout     (install) hub (default), classic, or compact — see ADR-006
  --tools      (install) comma-separated AI tools (e.g. cursor or cursor,gemini,codex).
               Presets at interactive prompt: c=cursor · s=cursor,gemini,codex · a=all adapters.
               Interactive prompt when stdin is a TTY; defaults to all adapter tools otherwise.
               Ignored with --update (existing state.yaml tools: is preserved).
  --force      (install) overwrite files that already exist
  --update     refresh an existing install (overwrite engine + bump version stamp + run midas-doctor verify; keeps your work)
  --uninstall  remove Midas instead of installing it
  --dry-run    (uninstall) print the plan without deleting anything
  --purge      (uninstall) also delete your product artifacts and audit trail
  -h, --help   show this help

After install, open the project in your chosen tool and run /midas-init (one-time setup), then /midas-status.
Cursor:           npx github:okuzpe/midas-harness --tools=cursor
Compact layout:   npx github:okuzpe/midas-harness --layout=compact --tools=cursor
Classic layout:   npx github:okuzpe/midas-harness --layout=classic --tools=cursor
Docs: https://github.com/okuzpe/midas-harness`);
}
