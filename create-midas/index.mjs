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

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, basename, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, 'template');

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  printHelp();
  process.exit(0);
}
const force = args.includes('--force');
const targetArg = args.find((a) => !a.startsWith('-')) || '.';
const TARGET = resolve(process.cwd(), targetArg);
const NAME = basename(TARGET).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'project';

if (!existsSync(TEMPLATE)) {
  console.error('create-midas: bundled template is missing — please reinstall the package.');
  process.exit(1);
}

const written = [];
const skipped = [];

mkdirSync(TARGET, { recursive: true });
copyTree(TEMPLATE, TARGET);
fillAgents(); // turn the template AGENTS.md into a project-named one

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

function report() {
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
  console.log('     2. run  /midas-init   — one-time guided setup' +
    (stateMode === 'brownfield' ? ' (it adopts your existing codebase)' : '') + '. You won\'t need it again.');
  console.log('     3. then  /midas-status  drives the rest.');
  console.log('\n  Docs: https://github.com/okuzpe/midas-harness\n');
}

function printHelp() {
  console.log(`create-midas — install the Midas harness into a project

Usage:
  npx github:okuzpe/midas-harness          install into the current directory (from GitHub)
  npx github:okuzpe/midas-harness my-app   install into ./my-app
  npx github:okuzpe/midas-harness#v0.3.2   pin a release for a reproducible, latest install

Options:
  --force      overwrite files that already exist
  -h, --help   show this help

After install, open the project in Claude Code and run /midas-init (one-time setup), then /midas-status.
Docs: https://github.com/okuzpe/midas-harness`);
}
