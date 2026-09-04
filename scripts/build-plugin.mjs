#!/usr/bin/env node
// build-plugin.mjs — render the Claude Code plugin tree from source (dependency-free, Node ESM).
//
// Midas authors its skills/agents once under `harness/`. A Claude Code
// *plugin*, however, auto-discovers `skills/` and `agents/` at the PLUGIN ROOT. So this script renders
// a self-contained plugin under `harness/plugins/midas/` by copying the source components, and writes
// `harness/.claude-plugin/marketplace.json` that lists it (marketplace root = `harness/`, not repo root).
//
// The whole `harness/plugins/midas/` tree and `.claude/{skills,agents}` are GENERATED — do not hand-edit;
// edit `harness/{skills,agents}` and re-run:
//   node scripts/build-plugin.mjs
// Then a user installs Midas with:
//   /plugin marketplace add ./harness   →   /plugin install midas@midas
//
// No npm dependencies: only node:fs and node:path. Runs on Windows. Requires Node 22+.

import { cpSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripEngineOnlySkills, stripHostPickerExcludedSkills } from './engine-only.mjs';
import { renderPortableSkillsTree } from './portable-skills.mjs';
import {
  INTERNAL_SURFACE_ALLOWLIST,
  DEPRECATED_SURFACE_ALLOWLIST,
} from './skill-registry.mjs';
import { maybeHelp } from './lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');

// --- metadata (edit these before publishing) ---------------------------------------------------
export const OWNER = 'okuzpe'; // GitHub owner/org
export const AUTHOR = { name: 'Midas' };
export const DESCRIPTION =
  'Portable product-development harness: drive a product from idea to shipped code through 9 audited ' +
  'phases, with cost-tiered agents, a Context7-first rule, and a whole-project adversarial debate (/midas-tribunal).';

export const PLUGIN_REL_PARTS = Object.freeze(['harness', 'plugins', 'midas']);
export const PLUGIN_REL = 'harness/plugins/midas';
const PLUGIN_DIR = join(ROOT, ...PLUGIN_REL_PARTS);
const HARNESS_DIR = join(ROOT, 'harness');
const MARKETPLACE_DIR = join(HARNESS_DIR, '.claude-plugin');
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
const HOST_PICKER_EXCLUDED = [...INTERNAL_SURFACE_ALLOWLIST, ...DEPRECATED_SURFACE_ALLOWLIST];

// --- helpers -----------------------------------------------------------------------------------
function writeJson(absFile, obj) {
  mkdirSync(dirname(absFile), { recursive: true });
  writeFileSync(absFile, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

export function computePluginManifest() {
  return {
    name: 'midas',
    description: DESCRIPTION,
    author: AUTHOR,
  };
}

export function computePluginReadme() {
  return [
    '# midas (generated plugin)',
    '',
    '> **GENERATED — do not hand-edit.** This tree is rendered from `harness/skills`, `harness/agents`,',
    '> and `.mcp.json` by `scripts/build-plugin.mjs`. Edit the source and re-run the script.',
    '',
    'Install from a clone: `/plugin marketplace add ./harness` then `/plugin install midas@midas`.',
    '',
    'The marketplace catalog lives at `harness/.claude-plugin/marketplace.json` (not repo root),',
    'so `/plugin marketplace add ' + OWNER + '/midas-harness` without a local clone will not find it.',
    '',
    'Note: installing the plugin delivers the skills, agents, and MCP config — but Claude Code plugins',
    'do NOT auto-install project rules or `CLAUDE.md`. Run `/midas-init` once after install to write',
    '`AGENTS.md`, the `CLAUDE.md` shim, and the tool adapters into your project.',
    '',
  ].join('\n');
}

export function computeMarketplaceJson() {
  return {
    $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
    name: 'midas',
    description: 'Marketplace for the Midas product-development harness.',
    owner: AUTHOR,
    plugins: [
      {
        name: 'midas',
        description: DESCRIPTION,
        author: AUTHOR,
        // Marketplace root is `harness/` — path is relative to that directory, not repo root.
        source: './plugins/midas',
        category: 'development',
        homepage: `https://github.com/${OWNER}/midas-harness`,
      },
    ],
  };
}

export function renderPluginTree() {
  renderClaudeMirrors();
  // --- 1. render harness/plugins/midas/ from canonical harness sources + .mcp.json ------------
  // Start clean so deletions in source propagate (no stale skills left behind).
  if (existsSync(PLUGIN_DIR)) rmSync(PLUGIN_DIR, { recursive: true, force: true });
  mkdirSync(PLUGIN_DIR, { recursive: true });

  cpSync(join(ROOT, 'harness', 'skills'), join(PLUGIN_DIR, 'skills'), { recursive: true });
  cpSync(join(ROOT, 'harness', 'agents'), join(PLUGIN_DIR, 'agents'), { recursive: true });
  // Engine-only skills stay in harness/ for contributors; never ship via marketplace plugin.
  // ADR-013: omit internal/deprecated from host pickers — path-pass from engine skills only.
  stripEngineOnlySkills(join(PLUGIN_DIR, 'skills'), { existsSync, rmSync }, { join });
  stripHostPickerExcludedSkills(
    join(PLUGIN_DIR, 'skills'),
    { existsSync, rmSync },
    { join },
    HOST_PICKER_EXCLUDED,
  );
  if (existsSync(join(ROOT, '.mcp.json'))) {
    cpSync(join(ROOT, '.mcp.json'), join(PLUGIN_DIR, '.mcp.json'));
  }

  writeJson(join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'), computePluginManifest());
  writeFileSync(join(PLUGIN_DIR, 'README.md'), computePluginReadme(), 'utf8');

  // --- 2. write harness/.claude-plugin/marketplace.json --------------------------------------
  writeJson(join(MARKETPLACE_DIR, 'marketplace.json'), computeMarketplaceJson());
}

/** Materialize Claude's project discovery tree without treating it as authored source. */
export function renderClaudeMirrors() {
  for (const name of ['skills', 'agents']) {
    const source = join(ROOT, 'harness', name);
    const target = join(ROOT, '.claude', name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    cpSync(source, target, { recursive: true });
  }
  stripHostPickerExcludedSkills(
    join(ROOT, '.claude', 'skills'),
    { existsSync, rmSync },
    { join },
    HOST_PICKER_EXCLUDED,
  );
  // Keep engine portable mirrors in sync (primary surface only in host pickers; ADR-013).
  // Engine-only midas-precommit stays in harness/skills for contributors but is omitted from
  // portable trees via render + optional strip when shipping templates.
  renderPortableSkillsTree(ROOT, {
    sourceDir: 'harness/skills',
    targetDir: '.agents/skills',
  });
  renderPortableSkillsTree(ROOT, {
    sourceDir: 'harness/skills',
    targetDir: '.cursor/skills',
  });
}

if (IS_MAIN) {
  renderPluginTree();
  console.log('midas build-plugin: rendered harness/plugins/midas/ + harness/.claude-plugin/marketplace.json');
  console.log('  owner=okuzpe; adjust author metadata in this script before publishing if desired.');
}
