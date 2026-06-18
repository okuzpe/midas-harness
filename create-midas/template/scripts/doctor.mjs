#!/usr/bin/env node
// doctor.mjs — Midas adapter drift checker + install health check (dependency-free, Node ESM).
//
//   node scripts/doctor.mjs          → check generated adapters (exit 1 on drift) + report health warnings
//   node scripts/doctor.mjs --fix    → re-render the adapters from source, then exit 0
//   node scripts/doctor.mjs <dir>    → check THAT project (its adapters, state.yaml, gate records), not the engine
//   node scripts/doctor.mjs --strict → ALSO exit 1 when a frozen gate record is inconsistent with state.yaml
//
// Adapter drift is AUTHORITATIVE (it fails CI). The other health checks are advisory warnings that never
// change the exit code (skip gracefully when a file isn't applicable) — EXCEPT under --strict, where a
// `gate:*` inconsistency also exits 1. Shares its render logic with render-adapters.mjs (no duplication).

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAdapters, renderAdapters } from './render-adapters.mjs';

const FIX = process.argv.includes('--fix');
const STRICT = process.argv.includes('--strict');
// Optional positional project root: check THAT project instead of the engine repo. Lets `--strict` run
// against a real install (or examples/taskpilot) so the gate-records check is provably exercised.
const rootArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
const ROOT = rootArg ? resolve(process.cwd(), rootArg) : resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Read a repo-relative file or null if missing. */
function read(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Parse the sprints block of state.yaml into a Map(id → status) without a YAML dependency. */
function parseSprints(yaml) {
  const out = new Map();
  let inSprints = false, id = null;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^[A-Za-z_][\w-]*:/.test(line)) { inSprints = /^sprints:/.test(line); id = null; continue; }
    if (!inSprints) continue;
    const idM = line.match(/^\s*-\s*id:\s*"?([\w.-]+)"?/);
    if (idM) { id = idM[1]; out.set(id, ''); continue; }
    const stM = line.match(/^\s*status:\s*"?(\w+)"?/);
    if (stM && id !== null) out.set(id, stM[1]);
  }
  return out;
}

/** Pull `key=<int>` out of a frozen tally line (default 0). */
function tallyNum(line, key) {
  const m = line.match(new RegExp(key + '=(\\d+)'));
  return m ? Number(m[1]) : 0;
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
  // Windows: an MCP server launched with bare `npx` cannot be spawned (npx is a .cmd) and fails with
  // "Connection closed". It must be wrapped in `cmd /c`. Fresh installs are fixed by the installer.
  if (process.platform === 'win32') {
    try {
      const j = JSON.parse(mcp);
      const bare = Object.entries(j.mcpServers || {}).filter(([, s]) => s && s.command === 'npx').map(([k]) => k);
      check('mcp:win-npx', bare.length ? 'warn' : 'ok',
        bare.length ? `${bare.join(', ')}: bare npx won't spawn on Windows — wrap in \`cmd /c\` (re-run the installer with --force)` : '');
    } catch { /* invalid JSON is surfaced elsewhere */ }
  }
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

// frozen gate records vs state: the first check OUTSIDE the model that validates a verdict.
// A producing model can write "PASS" into an audit/verify record and advance the sprint; this
// catches the mismatch — a record whose tally shows unresolved CRITs while state marks the sprint
// done. Per-sprint records only (audit/verify); the tribunal is advisory by design and not gated.
const harnessDir = join(ROOT, '.harness');
if (!stateRaw) {
  check('gate:records', 'skip', 'no state.yaml');
} else if (!existsSync(harnessDir)) {
  check('gate:records', 'skip', 'no .harness records yet');
} else {
  const sprintStatus = parseSprints(stateRaw);
  const shipped = /^stage:\s*shipped\b/m.test(stateRaw);
  const isClosed = (nn) => shipped || sprintStatus.get(nn) === 'done';
  let scanned = 0, flagged = 0;

  const audits = join(harnessDir, 'audits');
  if (existsSync(audits)) for (const f of readdirSync(audits)) {
    const nn = (f.match(/^audit-([\w.-]+)\.md$/) || [])[1];
    if (!nn) continue;
    const line = (read(join('.harness', 'audits', f)) || '').match(/MIDAS_AUDIT_RESULT:[^\n\r]*/);
    if (!line) continue;
    scanned++;
    const unresolved = tallyNum(line[0], 'unresolved');
    const blocked = /verdict=blocked/.test(line[0]);
    const passClaimed = /verdict=pass/.test(line[0]);
    if (passClaimed && unresolved > 0) {
      // self-inconsistent: the record grades itself pass while carrying unresolved fails
      flagged++;
      check(`gate:audit-${nn}`, 'warn', `record claims verdict=pass but unresolved=${unresolved} — self-inconsistent`);
    } else if (isClosed(nn) && (unresolved > 0 || blocked)) {
      flagged++;
      check(`gate:audit-${nn}`, 'warn', `record has unresolved=${unresolved}${blocked ? ' verdict=blocked' : ''} but sprint ${nn} is closed in state.yaml`);
    }
  }

  const verifs = join(harnessDir, 'verifications');
  if (existsSync(verifs)) for (const f of readdirSync(verifs)) {
    const nn = (f.match(/^verify-([\w.-]+)\.md$/) || [])[1];
    if (!nn) continue;
    const line = (read(join('.harness', 'verifications', f)) || '').match(/MIDAS_VERIFY_RESULT:[^\n\r]*/);
    if (!line) continue;
    scanned++;
    const criticals = tallyNum(line[0], 'criticals');
    if (isClosed(nn) && criticals > 0) {
      flagged++;
      check(`gate:verify-${nn}`, 'warn', `verify criticals=${criticals} but sprint ${nn} is closed in state.yaml`);
    }
  }

  if (scanned === 0) check('gate:records', 'skip', 'no parseable MIDAS_*_RESULT tally lines');
  else if (flagged === 0) check('gate:records', 'ok', `${scanned} record(s) consistent with state`);
}

console.log('\nmidas doctor — health');
for (const h of health) console.log(`  ${h.status.padEnd(4)} ${h.name}${h.note ? ' — ' + h.note : ''}`);

if (drift) {
  console.log('\nAdapters OUT OF SYNC. Run `node scripts/doctor.mjs --fix` (or `/midas-doctor`).');
  process.exit(1);
}
const gateWarn = health.some((h) => h.name.startsWith('gate:') && h.status === 'warn');
if (STRICT && gateWarn) {
  console.log('\nSTRICT: a frozen gate record is inconsistent with state.yaml (see the gate:* warnings above).');
  process.exit(1);
}
console.log('\nAdapters in sync.' + (health.some((h) => h.status === 'warn') ? ' (review health warnings above)' : ''));
process.exit(0);
