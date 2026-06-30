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

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, rmdirSync } from 'node:fs';
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
const GITIGNORE_BEGIN = '# midas:begin GITIGNORE — installed by create-midas; extend with your own patterns below';
const GITIGNORE_END = '# midas:end';

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
  console.error('  (no harness/VERSION or harness/state.yaml here). Run --update from the project root,');
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

mkdirSync(TARGET, { recursive: true });
copyTree(TEMPLATE, TARGET);

// Fresh installs honour --tools (or an interactive prompt). --update keeps the existing state.yaml tools.
const selectedTools = update ? null : await resolveSelectedTools();

const stateMode = writeState(selectedTools);

// Generate tool adapters after state.yaml exists so render-adapters can read tools:.
let rendered = false;
try {
  const mod = await import(pathToFileURL(join(TARGET, 'scripts', 'render-adapters.mjs')).href);
  if (typeof mod.renderAdapters === 'function') {
    mod.renderAdapters(TARGET);
    rendered = true;
  }
} catch {
  /* adapters will be generated on the first /midas-doctor */
}

fillAgents(selectedTools);
fixMcpForWindows();
ensureGitignore();

const verifyResult = rendered ? verifyInstall() : null;

const updatedTo = update ? bumpVersionStamp() : null;
report(selectedTools);

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

/** True if `dir` already holds a Midas install — the engine stamp or a project's state file. */
function hasMidasInstall(dir) {
  return existsSync(join(dir, 'harness', 'VERSION')) || existsSync(join(dir, 'harness', 'state.yaml'));
}

/** Walk up from TARGET's parent to the filesystem root; return the first ancestor that holds a Midas
 *  install (harness/VERSION), or null. Used to refuse a nested/duplicate install. */
function findAncestorMidasRoot(startDir) {
  let dir = dirname(startDir);
  for (;;) {
    if (existsSync(join(dir, 'harness', 'VERSION'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null; // reached the filesystem root
    dir = parent;
  }
}

// Fill the template AGENTS.md placeholders so the installed file is about THIS project, not Midas.
// Only touches our freshly-written template AGENTS.md (it still contains `{{...}}`); a pre-existing
// user AGENTS.md has no placeholders and is left untouched.
function fillAgents(tools) {
  const f = join(TARGET, 'AGENTS.md');
  const t = readMaybe(f);
  if (t == null || !t.includes('{{')) return;
  const list = (tools || readToolsFromState() || DEFAULT_TOOLS).join(', ');
  const filled = t
    .replace(/\{\{PROJECT_NAME\}\}/g, NAME)
    .replace(/\{\{STACK\}\}/g, 'undecided — set in Phase 4 (`/choose-architecture`)')
    .replace(/\{\{TOOLS\}\}/g, list);
  writeFileSync(f, filled, 'utf8');
}

/** Read `tools:` from an existing harness/state.yaml, or null. */
function readToolsFromState() {
  const stateFile = join(TARGET, 'harness', 'state.yaml');
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
    console.log('\n  Which AI tools will you use with this project?');
    for (let i = 0; i < KNOWN_TOOLS.length; i++) console.log(`    ${i + 1}. ${KNOWN_TOOLS[i]}`);
    console.log('    a. all adapter tools (default)');
    const answer = await rl.question('\n  Numbers or names (comma-separated), or Enter for all: ');
    const trimmed = answer.trim();
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
    return selected.length ? selected : [...DEFAULT_TOOLS];
  } finally {
    rl.close();
  }
}

// On Windows, `npx` is a `.cmd` shim that Node cannot spawn directly, so an MCP server launched with
// `command: "npx"` fails to connect ("MCP error -32000: Connection closed"). Wrap every npx-launched
// server in `cmd /c`. Only touches a .mcp.json that Midas just wrote (a pre-existing user file is
// left untouched). No-op on macOS/Linux, where bare npx works.
function fixMcpForWindows() {
  if (process.platform !== 'win32') return;
  if (!written.includes('.mcp.json')) return;
  const f = join(TARGET, '.mcp.json');
  let json;
  try { json = JSON.parse(readMaybe(f) || ''); } catch { return; }
  let changed = false;
  for (const server of Object.values(json.mcpServers || {})) {
    if (server && server.command === 'npx') {
      server.args = ['/c', 'npx', ...(server.args || [])];
      server.command = 'cmd';
      changed = true;
    }
  }
  if (changed) writeFileSync(f, JSON.stringify(json, null, 2) + '\n', 'utf8');
}

// Merge Midas gitignore rules without clobbering an existing file. Idempotent — skips when markers
// are already present. Volatile Midas paths + secret patterns (see harness/state.schema.md).
function ensureGitignore() {
  const snippetPath = join(TARGET, 'harness', 'templates', 'gitignore-midas.snippet');
  const snippet = readMaybe(snippetPath);
  if (!snippet) return;

  const gitignorePath = join(TARGET, '.gitignore');
  const existing = readMaybe(gitignorePath) || '';
  if (existing.includes(GITIGNORE_BEGIN)) return;

  const block = `${GITIGNORE_BEGIN}\n${snippet.trim()}\n${GITIGNORE_END}\n`;
  const next = existing.trim() === '' ? `${block}` : `${existing.replace(/\s*$/, '')}\n\n${block}`;
  writeFileSync(gitignorePath, next, 'utf8');
  written.push('.gitignore');
}

/** Run midas-doctor on the target project; auto --fix once on adapter drift, then re-check. */
function runDoctor(target, fix = false) {
  const doctorScript = join(target, 'scripts', 'doctor.mjs');
  if (!existsSync(doctorScript)) return { ok: false, missing: true, out: '' };
  const args = fix ? [doctorScript, '--fix'] : [doctorScript];
  const r = spawnSync(process.execPath, args, { cwd: target, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, missing: false, out };
}

function verifyInstall() {
  let result = runDoctor(TARGET);
  if (!result.ok && !result.missing && /OUT OF SYNC|MISSING|DRIFT/.test(result.out)) {
    runDoctor(TARGET, true);
    result = runDoctor(TARGET);
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
function writeState(tools) {
  const stateFile = join(TARGET, 'harness', 'state.yaml');
  if (existsSync(stateFile)) return null;
  const version = (readMaybe(join(TARGET, 'harness', 'VERSION')) || '0.0.0').trim();
  const mode = detectMode();
  const today = new Date().toISOString().slice(0, 10); // one-time install stamp (not a render script)
  const stage = mode === 'brownfield' ? 'tech_architecture' : 'idea_intake';
  const toolList = (tools || DEFAULT_TOOLS).join(', ');
  const yaml = [
    `midas_version: ${version}`,
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
function bumpVersionStamp() {
  const f = join(TARGET, 'harness', 'state.yaml');
  const cur = readMaybe(f);
  if (cur == null) return null; // no prior install; the fresh-install path already wrote the right version
  const version = (readMaybe(join(TARGET, 'harness', 'VERSION')) || '').trim();
  if (!version) return null;
  const next = cur.replace(/^midas_version:\s*[^\s#]+/m, `midas_version: ${version}`);
  if (next !== cur) writeFileSync(f, next, 'utf8');
  return version;
}

function report(tools) {
  if (update) {
    console.log(`\n  ✨ Midas updated in ${TARGET}${updatedTo ? ` → v${updatedTo}` : ''}`);
    console.log(`     ${written.length} engine file(s) refreshed; your product/, .harness/, harness/state.yaml, and .mcp.json are preserved.`);
    if (rendered) console.log('     adapters re-rendered (per tools: in harness/state.yaml).');
    if (written.includes('.gitignore')) console.log('     .gitignore updated with Midas secret + volatile paths.');
    if (verifyResult?.ok) {
      console.log('     verify: ok — adapters in sync (midas-doctor passed).');
    } else if (verifyResult && !verifyResult.missing) {
      console.log('     verify: FAILED — adapters still out of sync after auto-fix.');
      console.log('     Run `node scripts/doctor.mjs --fix` in the project and check the output above.');
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
  if (stateMode) console.log(`     harness/state.yaml created (mode: ${stateMode}, tools: ${activeTools.join(', ')})`);
  if (written.includes('.gitignore')) console.log('     .gitignore updated with Midas secret + volatile paths (harness files stay committed)');
  if (verifyResult?.ok) console.log('     verify: ok — adapters in sync (midas-doctor passed).');

  const cd = targetArg === '.' ? '' : `cd ${targetArg} && `;
  const editors = [];
  if (activeTools.includes('claude-code')) editors.push('Claude Code');
  if (activeTools.includes('cursor')) editors.push('Cursor');
  if (activeTools.includes('windsurf')) editors.push('Windsurf');
  if (activeTools.includes('gemini')) editors.push('Gemini CLI');
  if (activeTools.some((t) => t === 'codex' || t === 'copilot')) editors.push('your editor (Codex/Copilot via AGENTS.md)');

  console.log('\n  Next steps:');
  let step = 1;
  if (editors.length) {
    console.log(`     ${step++}. ${cd}open the project in ${editors.join(' or ')}`);
  }
  console.log(`     ${step++}. run  /midas-init   — one-time setup: scans what you have and places you at the right phase. You won't need it again.`);
  console.log(`     ${step++}. then  /midas-status  drives the rest.`);
  console.log('\n  Docs: https://github.com/okuzpe/midas-harness\n');
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

function pruneEmptyDirs() {
  if (dryRun) return;
  for (const root of ['.claude', '.cursor', '.windsurf', '.harness', 'harness', 'docs', 'scripts']) {
    pruneEmptyTree(join(TARGET, root));
  }
}

function runUninstall() {
  const removed = [], keptModified = [], keptUser = [], purged = [];
  const ADAPTERS = ['CLAUDE.md', '.cursor/rules/00-midas.mdc', '.windsurf/rules/00-midas.md', 'GEMINI.md'];

  // 1. Engine files shipped in the template: remove only the PRISTINE ones (byte-identical to what
  //    was installed). Anything you edited (e.g. a Phase-8-amended rule) is kept. AGENTS.md below.
  for (const rel of listTemplateFiles(TEMPLATE)) {
    if (rel === 'AGENTS.md') continue;
    const abs = join(TARGET, rel);
    if (!existsSync(abs)) continue;
    if (readFileSync(join(TEMPLATE, rel)).equals(readFileSync(abs))) { rmFile(rel); removed.push(rel); }
    else keptModified.push(rel);
  }

  // 2. AGENTS.md: remove only if it carries the Midas signature — a pre-existing user file won't.
  if (existsSync(join(TARGET, 'AGENTS.md'))) {
    if (readFileSync(join(TARGET, 'AGENTS.md'), 'utf8').includes('generated** from the Midas harness')) {
      rmFile('AGENTS.md'); removed.push('AGENTS.md');
    } else keptUser.push('AGENTS.md (not Midas-generated — left untouched)');
  }

  // 3. Generated adapters, identified by the midas managed-marker. Cursor/Windsurf/Gemini are 100%
  //    generated -> remove the whole file. CLAUDE.md may hold your notes -> strip just the block.
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

  // 4. Engine artifact under .harness/ (the rest of .harness/ is your audit trail — see step 5).
  if (existsSync(join(TARGET, '.harness', 'adapters.hash'))) { rmFile('.harness/adapters.hash'); removed.push('.harness/adapters.hash'); }

  // 5. YOUR WORK — kept by default, removed only with --purge.
  for (const rel of ['product', '.harness', 'harness/state.yaml']) {
    if (!existsSync(join(TARGET, rel))) continue;
    if (purge) { if (!dryRun) rmSync(join(TARGET, rel), { recursive: true, force: true }); purged.push(rel); }
    else keptUser.push(`${rel} (your work — kept; re-run with --purge to remove)`);
  }

  pruneEmptyDirs();
  reportUninstall({ removed, keptModified, keptUser, purged });
}

function reportUninstall({ removed, keptModified, keptUser, purged }) {
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
    : `\n  Done — Midas removed.${purge ? '' : ' Your product/, .harness/ and state.yaml were kept (use --purge to remove those too).'}\n`);
}

function printHelp() {
  console.log(`create-midas — install (or uninstall) the Midas harness in a project

Install:
  npx github:okuzpe/midas-harness          into the current directory (from GitHub)
  npx github:okuzpe/midas-harness my-app   into ./my-app
  npx github:okuzpe/midas-harness#v0.5.21   pin a release for a reproducible install

Update an existing install (overwrites the engine, KEEPS your work, bumps the version stamp):
  npx github:okuzpe/midas-harness --update             refresh to the latest (main)
  npx github:okuzpe/midas-harness#v0.5.21 --update      refresh to a pinned release

Uninstall (surgical — removes only Midas's files, keeps your work):
  npx github:okuzpe/midas-harness --uninstall             remove the engine, keep product/ + .harness/ + state.yaml
  npx github:okuzpe/midas-harness --uninstall --dry-run   preview what would be removed
  npx github:okuzpe/midas-harness --uninstall --purge     also remove your product/, .harness/ and state.yaml

Options:
  --tools      (install) comma-separated AI tools (e.g. cursor or claude-code,cursor).
               Interactive prompt when stdin is a TTY; defaults to all adapter tools otherwise.
               Ignored with --update (existing harness/state.yaml tools: is preserved).
  --force      (install) overwrite files that already exist
  --update     refresh an existing install (overwrite engine + bump version stamp + run midas-doctor verify; keeps your work)
  --uninstall  remove Midas instead of installing it
  --dry-run    (uninstall) print the plan without deleting anything
  --purge      (uninstall) also delete your product artifacts and audit trail
  -h, --help   show this help

After install, open the project in your chosen tool and run /midas-init (one-time setup), then /midas-status.
Cursor quickstart: npx github:okuzpe/midas-harness --tools=cursor
Docs: https://github.com/okuzpe/midas-harness`);
}
