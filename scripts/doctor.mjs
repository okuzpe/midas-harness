#!/usr/bin/env node
// doctor.mjs — Midas adapter drift checker + install health check (dependency-free, Node ESM).
//
//   node scripts/doctor.mjs        → check generated adapters (exit 1 on drift) + report health warnings
//   node scripts/doctor.mjs --fix  → re-render the adapters from source, then exit 0
//
// Adapter drift is AUTHORITATIVE (it fails CI). The health checks are advisory warnings that never
// change the exit code and skip gracefully when a file isn't applicable (e.g. no state.yaml in the
// engine repo / before /midas-init). Shares its render logic with render-adapters.mjs (no duplication).

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAdapters, renderAdapters } from './render-adapters.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = process.argv.includes('--fix');

/** Read a repo-relative file or null if missing. */
function read(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

// --- --fix: rewrite adapters via the shared render path ----------------------------------------
if (FIX) {
  const { hash, results } = renderAdapters(ROOT);
  console.log('midas doctor --fix: re-rendered adapters from harness/conventions.md');
  for (const r of results) console.log(`  ${r.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${r.path}`);
  console.log(`  source hash: ${hash}`);
  process.exit(0);
}

// --- 1. adapter drift (authoritative; affects the exit code) -----------------------------------
let drift = false;
console.log('midas doctor — adapters');
for (const f of computeAdapters(ROOT).files) {
  const onDisk = read(f.path);
  if (onDisk === null) { drift = true; console.log(`  MISSING  ${f.path}`); }
  else if (onDisk !== f.content) { drift = true; console.log(`  DRIFT    ${f.path}`); }
  else console.log(`  ok       ${f.path}`);
}

// --- 2. health checks (advisory; warn/skip, never change the exit code) ------------------------
const health = [];
const check = (name, status, note) => health.push({ name, status, note: note || '' });

// version: harness/state.yaml midas_version vs the engine harness/VERSION
const VERSION = (read('harness/VERSION') || '').trim();
const stateRaw = read('harness/state.yaml');
if (!stateRaw) {
  check('version', 'skip', 'no harness/state.yaml (engine repo or pre-init)');
} else {
  const m = stateRaw.match(/^midas_version:\s*([0-9][^\s#]*)/m);
  const sv = m ? m[1] : null;
  if (!sv) check('version', 'warn', 'state.yaml has no midas_version');
  else if (VERSION && sv !== VERSION) check('version', 'warn', `state ${sv} != engine ${VERSION} — run /midas-update`);
  else check('version', 'ok', sv || '');
  for (const k of ['stage', 'cost_profile', 'routing']) {
    if (!new RegExp(`(^|\\n)${k}:`).test(stateRaw)) check(`state:${k}`, 'warn', 'missing required key');
  }
}

// critical files
for (const f of ['AGENTS.md', 'harness/conventions.md', 'harness/methodology.md']) {
  check(`file:${f}`, existsSync(join(ROOT, f)) ? 'ok' : 'warn', existsSync(join(ROOT, f)) ? '' : 'missing');
}

// .mcp.json must be secret-free (only ${ENV_VAR} placeholders)
const mcp = read('.mcp.json');
if (mcp === null) {
  check('mcp:secret-free', 'skip', 'no .mcp.json');
} else {
  let leak = false;
  const re = /(authorization|token|api[_-]?key|secret|password)"\s*:\s*"([^"]+)"/gi;
  let mm;
  while ((mm = re.exec(mcp))) if (!mm[2].includes('${')) leak = true;
  if (/\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,})\b/.test(mcp)) leak = true;
  check('mcp:secret-free', leak ? 'warn' : 'ok', leak ? 'a literal secret may be present — use ${ENV_VAR}' : '');
}

// skills carry valid frontmatter with a name
const skillsDir = join(ROOT, '.claude', 'skills');
if (!existsSync(skillsDir)) {
  check('skills:frontmatter', 'skip', 'no .claude/skills');
} else {
  let bad = 0, total = 0;
  for (const d of readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    total++;
    const s = read(join('.claude', 'skills', d.name, 'SKILL.md'));
    if (!s || !/^---\r?\n[\s\S]*?\bname:\s*\S/m.test(s)) bad++;
  }
  check('skills:frontmatter', bad ? 'warn' : 'ok', `${total - bad}/${total} valid`);
}

console.log('\nmidas doctor — health');
for (const h of health) console.log(`  ${h.status.padEnd(4)} ${h.name}${h.note ? ' — ' + h.note : ''}`);

if (drift) {
  console.log('\nAdapters OUT OF SYNC. Run `node scripts/doctor.mjs --fix` (or `/midas-doctor`).');
  process.exit(1);
}
console.log('\nAdapters in sync.' + (health.some((h) => h.status === 'warn') ? ' (review health warnings above)' : ''));
process.exit(0);
