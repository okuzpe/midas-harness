#!/usr/bin/env node
// create-midas — install the Midas product-development harness into a project.
//
//   npm create midas              # into the current directory
//   npm create midas my-app       # into ./my-app
//   pnpm create midas · yarn create midas · npx create-midas · bunx create-midas
//
// Non-destructive: copies the bundled harness (skills, agents, rules, AGENTS.md, MCP config) into the
// target, skipping any file that already exists (use --force to overwrite), then generates the tool
// adapters. Dependency-free (Node 16.7+). The whole thing only adds files; it never deletes yours.

import { readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
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

if (!existsSync(TEMPLATE)) {
  console.error('create-midas: bundled template is missing — please reinstall the package.');
  process.exit(1);
}

const written = [];
const skipped = [];

mkdirSync(TARGET, { recursive: true });
copyTree(TEMPLATE, TARGET);

// Generate the tool adapters (CLAUDE.md, .cursor/rules, .windsurf/rules) in the target so the project
// is immediately usable. Non-fatal if it can't run — /midas-doctor regenerates them later.
let rendered = false;
try {
  const renderPath = pathToFileURL(join(TARGET, 'scripts', 'render-adapters.mjs')).href;
  const mod = await import(renderPath);
  if (typeof mod.renderAdapters === 'function') {
    mod.renderAdapters(TARGET);
    rendered = true;
  }
} catch {
  /* adapters will be generated on the first /midas-doctor */
}

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

function report() {
  console.log(`\n  ✨ Midas installed into ${TARGET}`);
  console.log(
    `     ${written.length} files written` +
      (skipped.length ? `, ${skipped.length} skipped (already present — use --force to overwrite)` : ''),
  );
  if (rendered) console.log('     tool adapters generated: CLAUDE.md, .cursor/rules, .windsurf/rules');
  if (skipped.some((f) => /^(AGENTS\.md|CLAUDE\.md|\.mcp\.json)$/.test(f))) {
    console.log('     note: kept your existing AGENTS.md / CLAUDE.md / .mcp.json — run /midas-init to merge.');
  }
  const cd = targetArg === '.' ? '' : `cd ${targetArg} && `;
  console.log('\n  Next steps:');
  console.log(`     1. ${cd}open the project in Claude Code (or Cursor)`);
  console.log('     2. run  /midas-init    to configure the harness');
  console.log('     3. run  /midas-status  to see the next action');
  console.log('\n  Docs: https://github.com/okuzpe/midas-harness\n');
}

function printHelp() {
  console.log(`create-midas — install the Midas harness into a project

Usage:
  npm create midas              install into the current directory
  npm create midas my-app       install into ./my-app
  npx create-midas [dir]        same (works with pnpm / yarn / bun too)

Options:
  --force      overwrite files that already exist
  -h, --help   show this help

After install: open the project in Claude Code and run /midas-init.
Docs: https://github.com/okuzpe/midas-harness`);
}
