#!/usr/bin/env node
// build-create.mjs — assemble create-midas/template/ from source (dependency-free, Node 16.7+).
//
// `create-midas` bundles a copy of the harness so `npm create midas` works offline and version-pinned.
// That copy is GENERATED here from the canonical source — do not hand-edit create-midas/template/.
// Edit the source under `.claude/`, `harness/`, etc. and re-run:  node scripts/build-create.mjs
//
// CI rebuilds this and fails on any diff, so the published initializer can never drift from source.

import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TEMPLATE = join(ROOT, 'create-midas', 'template');

// What a fresh project needs to run the harness (NOT examples/, plugins/, .github/, tests, or the
// repo's own dev scripts).
const DIRS = ['.claude', 'harness'];
const FILES = [
  'AGENTS.md',
  '.mcp.json',
  'docs/agents-and-models.md',
  'scripts/render-adapters.mjs', // needed by /midas-doctor in the installed project
  'scripts/doctor.mjs',
];

if (existsSync(TEMPLATE)) rmSync(TEMPLATE, { recursive: true, force: true });
mkdirSync(TEMPLATE, { recursive: true });

for (const d of DIRS) cpSync(join(ROOT, d), join(TEMPLATE, d), { recursive: true });
for (const f of FILES) {
  const dst = join(TEMPLATE, f);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(join(ROOT, f), dst);
}

console.log('create-midas: template assembled at create-midas/template/ from source');
