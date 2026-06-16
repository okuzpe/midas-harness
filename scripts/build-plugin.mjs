#!/usr/bin/env node
// build-plugin.mjs — render the Claude Code plugin tree from source (dependency-free, Node ESM).
//
// Midas authors its skills/agents once under `.claude/` (the portable source of truth). A Claude Code
// *plugin*, however, auto-discovers `skills/` and `agents/` at the PLUGIN ROOT. So this script renders
// a self-contained plugin under `plugins/midas/` by copying the source components, and writes the
// repo-root `.claude-plugin/marketplace.json` that lists it.
//
// The whole `plugins/midas/` tree is GENERATED — do not hand-edit it; edit `.claude/` and re-run:
//   node scripts/build-plugin.mjs
// Then a user installs Midas with:
//   /plugin marketplace add OWNER/midas-harness   →   /plugin install midas@midas
//
// No npm dependencies: only node:fs and node:path. Runs on Windows. Requires Node 16.7+ (cpSync).

import { cpSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = resolve(SCRIPT_DIR, '..');

// --- metadata (edit these before publishing) ---------------------------------------------------
const OWNER = 'OWNER'; // GitHub owner/org — replace before publishing the marketplace
const AUTHOR = { name: 'Midas' };
const DESCRIPTION =
  'Portable product-development harness: drive a product from idea to shipped code through 9 audited ' +
  'phases, with cost-tiered agents, a Context7-first rule, and a whole-project adversarial debate (/midas-tribunal).';

const PLUGIN_DIR = join(ROOT, 'plugins', 'midas');
const MARKETPLACE_DIR = join(ROOT, '.claude-plugin');

// --- helpers -----------------------------------------------------------------------------------
function writeJson(absFile, obj) {
  mkdirSync(dirname(absFile), { recursive: true });
  writeFileSync(absFile, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// --- 1. render plugins/midas/ from .claude/ + .mcp.json ----------------------------------------
// Start clean so deletions in source propagate (no stale skills left behind).
if (existsSync(PLUGIN_DIR)) rmSync(PLUGIN_DIR, { recursive: true, force: true });
mkdirSync(PLUGIN_DIR, { recursive: true });

cpSync(join(ROOT, '.claude', 'skills'), join(PLUGIN_DIR, 'skills'), { recursive: true });
cpSync(join(ROOT, '.claude', 'agents'), join(PLUGIN_DIR, 'agents'), { recursive: true });
if (existsSync(join(ROOT, '.mcp.json'))) {
  cpSync(join(ROOT, '.mcp.json'), join(PLUGIN_DIR, '.mcp.json'));
}

writeJson(join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'), {
  name: 'midas',
  description: DESCRIPTION,
  author: AUTHOR,
});

writeFileSync(
  join(PLUGIN_DIR, 'README.md'),
  [
    '# midas (generated plugin)',
    '',
    '> **GENERATED — do not hand-edit.** This tree is rendered from `.claude/skills`, `.claude/agents`,',
    '> and `.mcp.json` by `scripts/build-plugin.mjs`. Edit the source and re-run the script.',
    '',
    'Install: `/plugin marketplace add ' + OWNER + '/midas-harness` then `/plugin install midas@midas`.',
    '',
    'Note: installing the plugin delivers the skills, agents, and MCP config — but Claude Code plugins',
    'do NOT auto-install project rules or `CLAUDE.md`. Run `/midas-init` once after install to write',
    '`AGENTS.md`, the `CLAUDE.md` shim, and the tool adapters into your project.',
    '',
  ].join('\n'),
  'utf8',
);

// --- 2. write the repo-root marketplace.json ---------------------------------------------------
writeJson(join(MARKETPLACE_DIR, 'marketplace.json'), {
  $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
  name: 'midas',
  description: 'Marketplace for the Midas product-development harness.',
  owner: AUTHOR,
  plugins: [
    {
      name: 'midas',
      description: DESCRIPTION,
      author: AUTHOR,
      source: './plugins/midas',
      category: 'development',
      homepage: `https://github.com/${OWNER}/midas-harness`,
    },
  ],
});

console.log('midas build-plugin: rendered plugins/midas/ + .claude-plugin/marketplace.json');
console.log('  reminder: replace OWNER and author metadata before publishing.');
