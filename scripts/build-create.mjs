#!/usr/bin/env node
// build-create.mjs — assemble the canonical v2 `.harness/` installer template.
//
// `create-midas` bundles a copy of the harness so `npx github:...` works offline and version-pinned.
// That copy is GENERATED here from the canonical source — do not hand-edit cli/template/.
// Edit the source under `harness/` and re-run: node scripts/build-create.mjs
//
// CI rebuilds this and fails on any diff, so the published initializer can never drift from source.

import { cpSync, rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPortableSkillsTree } from './portable-skills.mjs';
import { HARNESS_ENGINE_ONLY_RELS, stripEngineOnlySkills } from './engine-only.mjs';
import { shippedScriptRepoPaths } from './ship-manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TEMPLATE = join(ROOT, 'cli', 'template');

// What a fresh project needs to run the harness (NOT docs/research/, harness/plugins/, .github/, tests, or the
// repo's own dev scripts). NOTE: AGENTS.md is intentionally NOT copied from the repo root — that file
// describes the Midas ENGINE. The installed project gets a PROJECT-oriented AGENTS.md rendered from
// harness/templates/AGENTS.md.tmpl below (the installer fills {{PROJECT_NAME}}/{{STACK}}/{{TOOLS}}).
// Engine-repo-only paths under harness/ — never ship these in the distributable template.
// Fresh projects get .harness/state.yaml from cli/index.mjs.
// autonomy/ is an optional capability — shipped under template/.optional/autonomy and
// installed to .harness/autonomy only when create-midas receives --autonomy (ADR-009).
// Engine-only skills (e.g. midas-precommit) stay in harness/skills for contributors but are stripped.
const HARNESS_EXCLUDE = [...HARNESS_ENGINE_ONLY_RELS];
const FILES = shippedScriptRepoPaths();

if (existsSync(TEMPLATE)) rmSync(TEMPLATE, { recursive: true, force: true });
mkdirSync(TEMPLATE, { recursive: true });

const engineTarget = join(TEMPLATE, '.harness', 'engine');
const scriptsTarget = join(TEMPLATE, '.harness', 'scripts');
mkdirSync(engineTarget, { recursive: true });
cpSync(join(ROOT, 'harness'), engineTarget, { recursive: true });
for (const rel of HARNESS_EXCLUDE) {
  const excluded = join(engineTarget, rel);
  if (existsSync(excluded)) rmSync(excluded, { recursive: true, force: true });
}

// Optional autonomy capability (not part of the default engine tree).
const optionalAutonomy = join(TEMPLATE, '.optional', 'autonomy');
mkdirSync(dirname(optionalAutonomy), { recursive: true });
cpSync(join(ROOT, 'harness', 'autonomy'), optionalAutonomy, { recursive: true });
for (const f of FILES) {
  const dst = join(scriptsTarget, f.replace(/^scripts\//, ''));
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(join(ROOT, f), dst);
}
cpSync(
  join(ROOT, 'cli', 'install-diagnose.mjs'),
  join(scriptsTarget, 'install-diagnose.mjs'),
);
cpSync(
  join(ROOT, 'cli', 'lib', 'core', 'context.mjs'),
  join(scriptsTarget, 'install-context.mjs'),
);
mkdirSync(join(engineTarget, 'docs'), { recursive: true });
cpSync(join(ROOT, 'docs', 'agents-and-models.md'), join(engineTarget, 'docs', 'agents-and-models.md'));
cpSync(join(ROOT, 'docs', 'skill-quality-gate.md'), join(engineTarget, 'docs', 'skill-quality-gate.md'));
cpSync(join(ROOT, 'docs', 'skill-flows.md'), join(engineTarget, 'docs', 'skill-flows.md'));
cpSync(join(ROOT, 'docs', 'skills.md'), join(engineTarget, 'docs', 'skills.md'));
cpSync(join(ROOT, '.mcp.json'), join(TEMPLATE, '.mcp.json'));

// Host discovery mirrors. These are generated from the canonical engine sources and pruned by
// `--tools` during installation (ADR-008: cursor-only keeps `.cursor/skills`; portable peers keep
// `.agents/skills`).
cpSync(join(ROOT, 'harness', 'skills'), join(TEMPLATE, '.claude', 'skills'), { recursive: true });
cpSync(join(ROOT, 'harness', 'agents'), join(TEMPLATE, '.claude', 'agents'), { recursive: true });
stripEngineOnlySkills(join(TEMPLATE, '.claude', 'skills'), { existsSync, rmSync }, { join });
renderPortableSkillsTree(TEMPLATE, {
  sourceDir: '.harness/engine/skills',
  targetDir: '.agents/skills',
});
renderPortableSkillsTree(TEMPLATE, {
  sourceDir: '.harness/engine/skills',
  targetDir: '.cursor/skills',
});
stripEngineOnlySkills(join(TEMPLATE, '.agents', 'skills'), { existsSync, rmSync }, { join });
stripEngineOnlySkills(join(TEMPLATE, '.cursor', 'skills'), { existsSync, rmSync }, { join });

// Render the PROJECT AGENTS.md from the template (strip the leading {{! author note }} block; keep the
// {{PROJECT_NAME}}/{{STACK}}/{{TOOLS}} placeholders for the installer to fill).
const tmpl = readFileSync(join(ROOT, 'harness', 'templates', 'AGENTS.md.tmpl'), 'utf8');
// Strip the leading {{! ... }} author note. It contains {{PROJECT_NAME}} etc., so match up to the
// closing }} that sits right before the real heading rather than the first }} (which is nested).
const projectAgents = tmpl.replace(/^[\s\S]*?\}\}\s*(?=# AGENTS\.md)/, '');
writeFileSync(join(TEMPLATE, 'AGENTS.md'), projectAgents, 'utf8');

console.log('cli: template assembled at cli/template/ from source (project AGENTS.md rendered)');
