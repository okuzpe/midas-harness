#!/usr/bin/env node
// precommit-eval.mjs — mechanical floor for /midas-precommit (engine repo only).
//
//   node scripts/precommit-eval.mjs           human report + exit 0/1 on hard fails
//   node scripts/precommit-eval.mjs --json    machine-readable envelope
//   node scripts/precommit-eval.mjs --help
//
// Does NOT compute the full 1–100 dimension scores (those are agent-judged per
// docs/precommit-gate.md). It fails closed on: wrong cwd, doctor drift, skill-quality
// hard fails, and missing align prerequisites. Skill quality uses --staged --strict-warns only
// is overall >= 80 (see skill).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ENGINE_ONLY_SKILLS, isEngineRepo } from './engine-only.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PASS_THRESHOLD = 80;
const HELP = `precommit-eval — mechanical floor for /midas-precommit (engine only)

Usage:
  node scripts/precommit-eval.mjs         report + exit 1 on hard fails
  node scripts/precommit-eval.mjs --json  JSON envelope
  node scripts/precommit-eval.mjs --help

Agent must still score dimensions per docs/precommit-gate.md and require overall >= ${PASS_THRESHOLD}.
`;

const WANT_JSON = process.argv.includes('--json');
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

const fsApi = { existsSync, readFileSync };
const pathApi = { join };

/** @type {{ id: string, ok: boolean, detail: string }[]} */
const checks = [];
const hardFails = [];

function add(id, ok, detail) {
  checks.push({ id, ok, detail });
  if (!ok) hardFails.push(`${id}: ${detail}`);
}

if (!isEngineRepo(ROOT, fsApi, pathApi)) {
  const envelope = {
    engine: false,
    pass_threshold: PASS_THRESHOLD,
    hard_fails: ['not-engine: run only in midas-harness (package.json name=midas-harness + scripts/test.mjs)'],
    checks: [],
    dimensions: [],
    note: 'ABORT — product installs must not run /midas-precommit',
  };
  if (WANT_JSON) console.log(JSON.stringify(envelope, null, 2));
  else {
    console.error('precommit-eval: not the midas-harness engine repo — abort.');
    console.error('  This gate is engine-only. Product projects use /midas-align + /midas-doctor.');
  }
  process.exit(2);
}

add('engine-repo', true, 'midas-harness');

for (const name of ENGINE_ONLY_SKILLS) {
  const skillPath = join(ROOT, 'harness', 'skills', name, 'SKILL.md');
  add(`engine-only-skill:${name}`, existsSync(skillPath), skillPath);
}

const doctor = spawnSync(process.execPath, [join(ROOT, 'scripts', 'doctor.mjs')], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
add(
  'doctor',
  doctor.status === 0,
  doctor.status === 0 ? 'adapters + health exit 0' : summarizeSpawn(doctor),
);

const skillQ = spawnSync(process.execPath, [
  join(ROOT, 'scripts', 'skill-quality-check.mjs'),
  '--staged',
  '--strict-warns',
], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
add(
  'skill-quality-staged',
  skillQ.status === 0,
  skillQ.status === 0 ? 'staged canonical artifacts ok (or n/a)' : summarizeSpawn(skillQ),
);

const dirty = spawnSync('git', ['status', '--porcelain'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (dirty.status === 0) {
  const lines = (dirty.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  add('git-status', true, lines.length ? `${lines.length} dirty paths` : 'clean');
} else {
  add('git-status', false, summarizeSpawn(dirty));
}

// Template must not ship engine-only skills (if template exists).
const tplSkill = join(ROOT, 'cli', 'template', '.harness', 'engine', 'skills', 'midas-precommit');
const pluginSkill = join(ROOT, 'harness', 'plugins', 'midas', 'skills', 'midas-precommit');
if (existsSync(join(ROOT, 'cli', 'template'))) {
  add('template-excludes-precommit', !existsSync(tplSkill), 'cli/template must omit midas-precommit');
}
if (existsSync(join(ROOT, 'harness', 'plugins', 'midas', 'skills'))) {
  add('plugin-excludes-precommit', !existsSync(pluginSkill), 'harness/plugins/midas must omit midas-precommit');
}

const skillCount = readdirSync(join(ROOT, 'harness', 'skills'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .length;
add('skills-present', skillCount > 0, `${skillCount} skill dirs`);

const envelope = {
  engine: true,
  pass_threshold: PASS_THRESHOLD,
  hard_fails: hardFails,
  mechanical_ok: hardFails.length === 0,
  checks,
  dimensions: [
    'architecture',
    'security',
    'agentic_design',
    'testing',
    'reliability',
    'documentation',
    'simplicity',
    'developer_experience',
    'code_quality',
    'maintainability',
    'change_propagation',
    'methodology_fitness',
  ],
  note:
    hardFails.length === 0
      ? `Mechanical floor green. Agent must score all dimensions; overall >= ${PASS_THRESHOLD} required to commit.`
      : 'Mechanical floor FAILED — do not commit until hard_fails are fixed.',
};

if (WANT_JSON) {
  console.log(JSON.stringify(envelope, null, 2));
} else {
  console.log('precommit-eval — midas-harness engine floor');
  console.log(`  pass_threshold: ${PASS_THRESHOLD}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.id} — ${c.detail}`);
  }
  console.log(envelope.note);
  if (hardFails.length) {
    console.log('\nHard fails:');
    for (const f of hardFails) console.log(`  - ${f}`);
  }
}

process.exit(hardFails.length ? 1 : 0);

function summarizeSpawn(result) {
  const err = (result.stderr || result.stdout || '').trim().split(/\r?\n/).slice(0, 4).join(' | ');
  return `exit ${result.status}${err ? `: ${err}` : ''}`;
}
