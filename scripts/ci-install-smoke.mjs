#!/usr/bin/env node
// Cross-platform clean-install smoke used by the OS × host CI matrix.
// Primary user shape is --tools=cursor (ADR-008 thin root). Other hosts remain matrix coverage.

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const host = process.argv[2];
const known = new Set(['claude-code', 'cursor', 'windsurf', 'gemini', 'codex', 'copilot']);
if (!known.has(host)) {
  console.error(`usage: node scripts/ci-install-smoke.mjs <${[...known].join('|')}>`);
  process.exit(2);
}

const root = resolve(import.meta.dirname, '..');
const parent = mkdtempSync(join(tmpdir(), 'midas-v2-ci-'));
const target = join(parent, `project with spaces ${host}`);
const run = (args) => spawnSync(process.execPath, args, {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, CI: 'true' },
});

try {
  const install = run(['create-midas/index.mjs', `--tools=${host}`, target]);
  if (install.status !== 0) throw new Error(`install failed\n${install.stdout}\n${install.stderr}`);
  for (const rel of [
    '.harness/engine/VERSION',
    '.harness/scripts/doctor.mjs',
    '.harness/state.yaml',
    '.harness/manifest.json',
    'AGENTS.md',
  ]) {
    if (!existsSync(join(target, rel))) throw new Error(`missing ${rel}`);
  }
  for (const rel of ['harness', '.midas', 'scripts', 'product']) {
    if (existsSync(join(target, rel))) throw new Error(`canonical install leaked root path ${rel}`);
  }

  const expectedByHost = {
    'claude-code': ['.claude/CLAUDE.md', '.claude/skills', '.claude/agents'],
    cursor: ['.cursor/rules/00-midas.mdc', '.cursor/skills'],
    windsurf: ['.windsurf/rules/00-midas.md', '.agents/skills'],
    gemini: ['GEMINI.md', '.agents/skills'],
    codex: ['.agents/skills'],
    copilot: ['.agents/skills'],
  };
  for (const rel of expectedByHost[host]) {
    if (!existsSync(join(target, rel))) throw new Error(`host ${host} missing ${rel}`);
  }
  if (host !== 'claude-code' && existsSync(join(target, '.claude'))) {
    throw new Error(`host ${host} received an unnecessary .claude mirror`);
  }
  if (host === 'cursor' && existsSync(join(target, '.agents'))) {
    throw new Error('cursor-only install must not keep .agents/skills (ADR-008)');
  }

  const doctor = run([join(target, '.harness', 'scripts', 'doctor.mjs'), '--strict']);
  if (doctor.status !== 0) throw new Error(`doctor failed\n${doctor.stdout}\n${doctor.stderr}`);

  const update = run(['create-midas/index.mjs', '--update', target]);
  if (update.status !== 0) throw new Error(`update failed\n${update.stdout}\n${update.stderr}`);
  console.log(`clean install/update/doctor ok: ${host}`);
} finally {
  rmSync(parent, { recursive: true, force: true });
}
