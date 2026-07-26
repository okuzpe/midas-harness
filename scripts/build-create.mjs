#!/usr/bin/env node
// build-create.mjs — assemble the canonical v2 `.harness/` installer template.
//
// `create-midas` bundles a copy of the harness so `npx github:...` works offline and version-pinned.
// That copy is GENERATED here from the canonical source — do not hand-edit create-midas/template/.
// Edit the source under `harness/` and re-run: node scripts/build-create.mjs
//
// CI rebuilds this and fails on any diff, so the published initializer can never drift from source.

import { cpSync, rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPortableSkillsTree } from './portable-skills.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TEMPLATE = join(ROOT, 'create-midas', 'template');

// What a fresh project needs to run the harness (NOT examples/, plugins/, .github/, tests, or the
// repo's own dev scripts). NOTE: AGENTS.md is intentionally NOT copied from the repo root — that file
// describes the Midas ENGINE. The installed project gets a PROJECT-oriented AGENTS.md rendered from
// harness/templates/AGENTS.md.tmpl below (the installer fills {{PROJECT_NAME}}/{{STACK}}/{{TOOLS}}).
// Engine-repo-only paths under harness/ — never ship these in the distributable template.
// Fresh projects get .harness/state.yaml from create-midas/index.mjs.
const HARNESS_EXCLUDE = ['state.yaml'];
const FILES = [
  'scripts/render-adapters.mjs', // needed by /midas-doctor in the installed project
  'scripts/yaml-lite.mjs',
  'scripts/mcp-drift.mjs',
  'scripts/doctor.mjs',
  'scripts/status-page.mjs',
  'scripts/mcp-cursor-sync.mjs',
  'scripts/tool-profiles.mjs',
  'scripts/model-profiles.mjs',
  'scripts/portable-skills.mjs',
  'scripts/gitignore-merge.mjs',
  'scripts/paths.mjs',
  'scripts/migrate-layout.mjs',
  'scripts/stage-command-table.mjs',
  'scripts/design-system.mjs',
  'scripts/bundle.mjs',
  'scripts/ownership-manifest.mjs',
];

if (existsSync(TEMPLATE)) rmSync(TEMPLATE, { recursive: true, force: true });
mkdirSync(TEMPLATE, { recursive: true });

const engineTarget = join(TEMPLATE, '.harness', 'engine');
const scriptsTarget = join(TEMPLATE, '.harness', 'scripts');
mkdirSync(engineTarget, { recursive: true });
cpSync(join(ROOT, 'harness'), engineTarget, { recursive: true });
for (const rel of HARNESS_EXCLUDE) {
  const excluded = join(engineTarget, rel);
  if (existsSync(excluded)) rmSync(excluded, { force: true });
}
for (const f of FILES) {
  const dst = join(scriptsTarget, f.replace(/^scripts\//, ''));
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(join(ROOT, f), dst);
}
cpSync(
  join(ROOT, 'create-midas', 'install-diagnose.mjs'),
  join(scriptsTarget, 'install-diagnose.mjs'),
);
mkdirSync(join(engineTarget, 'docs'), { recursive: true });
cpSync(join(ROOT, 'docs', 'agents-and-models.md'), join(engineTarget, 'docs', 'agents-and-models.md'));
cpSync(join(ROOT, '.mcp.json'), join(TEMPLATE, '.mcp.json'));

// Host discovery mirrors. These are generated from the canonical engine sources and pruned by
// `--tools` during installation.
cpSync(join(ROOT, 'harness', 'skills'), join(TEMPLATE, '.claude', 'skills'), { recursive: true });
cpSync(join(ROOT, 'harness', 'agents'), join(TEMPLATE, '.claude', 'agents'), { recursive: true });
renderPortableSkillsTree(TEMPLATE, {
  sourceDir: '.harness/engine/skills',
  targetDir: '.agents/skills',
});

// Render the PROJECT AGENTS.md from the template (strip the leading {{! author note }} block; keep the
// {{PROJECT_NAME}}/{{STACK}}/{{TOOLS}} placeholders for the installer to fill).
const tmpl = readFileSync(join(ROOT, 'harness', 'templates', 'AGENTS.md.tmpl'), 'utf8');
// Strip the leading {{! ... }} author note. It contains {{PROJECT_NAME}} etc., so match up to the
// closing }} that sits right before the real heading rather than the first }} (which is nested).
const projectAgents = tmpl.replace(/^[\s\S]*?\}\}\s*(?=# AGENTS\.md)/, '');
writeFileSync(join(TEMPLATE, 'AGENTS.md'), projectAgents, 'utf8');

console.log('create-midas: template assembled at create-midas/template/ from source (project AGENTS.md rendered)');
