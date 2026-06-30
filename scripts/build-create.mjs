#!/usr/bin/env node
// build-create.mjs — assemble create-midas/template/ from source (dependency-free, Node 16.7+).
//
// `create-midas` bundles a copy of the harness so `npx github:...` works offline and version-pinned.
// That copy is GENERATED here from the canonical source — do not hand-edit create-midas/template/.
// Edit the source under `.claude/`, `harness/`, etc. and re-run:  node scripts/build-create.mjs
//
// CI rebuilds this and fails on any diff, so the published initializer can never drift from source.

import { cpSync, rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TEMPLATE = join(ROOT, 'create-midas', 'template');

// What a fresh project needs to run the harness (NOT examples/, plugins/, .github/, tests, or the
// repo's own dev scripts). NOTE: AGENTS.md is intentionally NOT copied from the repo root — that file
// describes the Midas ENGINE. The installed project gets a PROJECT-oriented AGENTS.md rendered from
// harness/templates/AGENTS.md.tmpl below (the installer fills {{PROJECT_NAME}}/{{STACK}}/{{TOOLS}}).
const DIRS = ['.claude', 'harness'];
// Engine-repo-only paths under harness/ — never ship these in the distributable template.
// Fresh projects get harness/state.yaml from create-midas/index.mjs writeState(), not from the bundle.
const HARNESS_EXCLUDE = ['state.yaml'];
const FILES = [
  '.mcp.json',
  'docs/agents-and-models.md',
  'scripts/render-adapters.mjs', // needed by /midas-doctor in the installed project
  'scripts/mcp-drift.mjs',
  'scripts/doctor.mjs',
];

if (existsSync(TEMPLATE)) rmSync(TEMPLATE, { recursive: true, force: true });
mkdirSync(TEMPLATE, { recursive: true });

for (const d of DIRS) cpSync(join(ROOT, d), join(TEMPLATE, d), { recursive: true });
for (const rel of HARNESS_EXCLUDE) {
  const excluded = join(TEMPLATE, 'harness', rel);
  if (existsSync(excluded)) rmSync(excluded, { force: true });
}
for (const f of FILES) {
  const dst = join(TEMPLATE, f);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(join(ROOT, f), dst);
}

// Render the PROJECT AGENTS.md from the template (strip the leading {{! author note }} block; keep the
// {{PROJECT_NAME}}/{{STACK}}/{{TOOLS}} placeholders for the installer to fill).
const tmpl = readFileSync(join(ROOT, 'harness', 'templates', 'AGENTS.md.tmpl'), 'utf8');
// Strip the leading {{! ... }} author note. It contains {{PROJECT_NAME}} etc., so match up to the
// closing }} that sits right before the real heading rather than the first }} (which is nested).
const projectAgents = tmpl.replace(/^[\s\S]*?\}\}\s*(?=# AGENTS\.md)/, '');
writeFileSync(join(TEMPLATE, 'AGENTS.md'), projectAgents, 'utf8');

console.log('create-midas: template assembled at create-midas/template/ from source (project AGENTS.md rendered)');
