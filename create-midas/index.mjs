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

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, 'template');

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

const written = [];
const skipped = [];

mkdirSync(TARGET, { recursive: true });
copyTree(TEMPLATE, TARGET);
fillAgents(); // turn the template AGENTS.md into a project-named one
fixMcpForWindows(); // wrap npx-launched MCP servers in `cmd /c` on Windows so they actually connect

// Generate the tool adapters so the project is immediately usable. Non-fatal if it can't run.
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

const stateMode = writeState();
const updatedTo = update ? bumpVersionStamp() : null;
report();

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
      if (existsSync(dst) && !force) {
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

// Fill the template AGENTS.md placeholders so the installed file is about THIS project, not Midas.
// Only touches our freshly-written template AGENTS.md (it still contains `{{...}}`); a pre-existing
// user AGENTS.md has no placeholders and is left untouched.
function fillAgents() {
  const f = join(TARGET, 'AGENTS.md');
  const t = readMaybe(f);
  if (t == null || !t.includes('{{')) return;
  const filled = t
    .replace(/\{\{PROJECT_NAME\}\}/g, NAME)
    .replace(/\{\{STACK\}\}/g, 'undecided — set in Phase 4 (`/choose-architecture`)')
    .replace(/\{\{TOOLS\}\}/g, 'claude-code, cursor, windsurf, gemini');
  writeFileSync(f, filled, 'utf8');
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
function writeState() {
  const stateFile = join(TARGET, 'harness', 'state.yaml');
  if (existsSync(stateFile)) return null;
  const version = (readMaybe(join(TARGET, 'harness', 'VERSION')) || '0.0.0').trim();
  const mode = detectMode();
  const today = new Date().toISOString().slice(0, 10); // one-time install stamp (not a render script)
  const stage = mode === 'brownfield' ? 'tech_architecture' : 'idea_intake';
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
    'tools: [claude-code, cursor, windsurf, gemini]',
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

function report() {
  if (update) {
    console.log(`\n  ✨ Midas updated in ${TARGET}${updatedTo ? ` → v${updatedTo}` : ''}`);
    console.log(`     ${written.length} engine file(s) refreshed; your product/, .harness/, and harness/state.yaml are preserved.`);
    if (rendered) console.log('     adapters re-rendered.');
    console.log('\n  Heads-up: --update overwrites engine files. If you consciously amended a rule, review');
    console.log('  `git diff` and re-apply your `## Amendment` if it was clobbered. Then run  /midas-doctor.\n');
    return;
  }
  console.log(`\n  ✨ Midas installed into ${TARGET}`);
  console.log(
    `     ${written.length} files written` +
      (skipped.length ? `, ${skipped.length} skipped (already present — use --force to overwrite)` : ''),
  );
  if (rendered) {
    console.log('     adapters generated — Claude Code · Cursor · Windsurf · Gemini (Codex/Copilot via AGENTS.md)');
  }
  if (stateMode) console.log(`     harness/state.yaml created (mode: ${stateMode})`);

  const cd = targetArg === '.' ? '' : `cd ${targetArg} && `;
  console.log('\n  Next steps:');
  console.log(`     1. ${cd}open the project in Claude Code`);
  console.log('     2. run  /midas-init   — one-time setup: scans what you have and places you at the right phase. You won\'t need it again.');
  console.log('     3. then  /midas-status  drives the rest.');
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
  npx github:okuzpe/midas-harness#v0.5.16   pin a release for a reproducible install

Update an existing install (overwrites the engine, KEEPS your work, bumps the version stamp):
  npx github:okuzpe/midas-harness --update             refresh to the latest (main)
  npx github:okuzpe/midas-harness#v0.5.16 --update      refresh to a pinned release

Uninstall (surgical — removes only Midas's files, keeps your work):
  npx github:okuzpe/midas-harness --uninstall             remove the engine, keep product/ + .harness/ + state.yaml
  npx github:okuzpe/midas-harness --uninstall --dry-run   preview what would be removed
  npx github:okuzpe/midas-harness --uninstall --purge     also remove your product/, .harness/ and state.yaml

Options:
  --force      (install) overwrite files that already exist
  --update     refresh an existing install (overwrite engine + bump version stamp; keeps your work)
  --uninstall  remove Midas instead of installing it
  --dry-run    (uninstall) print the plan without deleting anything
  --purge      (uninstall) also delete your product artifacts and audit trail
  -h, --help   show this help

After install, open the project in Claude Code and run /midas-init (one-time setup), then /midas-status.
Docs: https://github.com/okuzpe/midas-harness`);
}
