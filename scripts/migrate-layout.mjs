#!/usr/bin/env node
// migrate-layout.mjs — classic → compact relocation (dry-run by default). Dependency-free.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { detectLayout, MIGRATION_MAP, compactPathsYaml } from './paths.mjs';

const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
const rootArg = args.find((a) => !a.startsWith('-'));
const ROOT = rootArg ? resolve(process.cwd(), rootArg) : process.cwd();

function movePath(from, to, type) {
  const src = join(ROOT, from);
  if (!existsSync(src)) return null;
  return { from, to, type, src, dst: join(ROOT, to) };
}

function printPlan(rows) {
  console.log('\n  migrate-layout — classic → compact' + (dryRun ? ' (dry run)' : ''));
  console.log('  ' + 'FROM'.padEnd(36) + ' → ' + 'TO');
  for (const r of rows) console.log(`  ${r.from.padEnd(36)} → ${r.to}`);
  if (!rows.length) console.log('  (nothing to move — already compact or empty install)');
}

function applyMove(r) {
  mkdirSync(dirname(r.dst), { recursive: true });
  if (r.type === 'dir') {
    renameSync(r.src, r.dst);
  } else {
    if (existsSync(r.dst)) rmSync(r.dst);
    renameSync(r.src, r.dst);
  }
}

function patchStateYaml() {
  const compactState = join(ROOT, '.midas', 'state.yaml');
  if (!existsSync(compactState)) return;
  let raw = readFileSync(compactState, 'utf8');
  if (!/^layout:/m.test(raw)) {
    raw = raw.replace(/^(midas_version:[^\n]*\n)/m, `$1layout: compact\n`);
  } else {
    raw = raw.replace(/^layout:\s*\S+/m, 'layout: compact');
  }
  const pathsBlock = compactPathsYaml();
  const pathsYaml = [
    'paths:',
    `  engine: ${pathsBlock.engine}`,
    `  scripts: ${pathsBlock.scripts}`,
    `  state: ${pathsBlock.state}`,
    `  runs: ${pathsBlock.runs}`,
  ].join('\n');
  if (!/^paths:/m.test(raw)) {
    raw = raw.replace(/^(layout:[^\n]*\n)/m, `$1${pathsYaml}\n`);
  }
  writeFileSync(compactState, raw, 'utf8');
}

async function main() {
  const layout = detectLayout(ROOT);
  if (layout === 'compact') {
    console.log('migrate-layout: already compact — nothing to do.');
    process.exit(0);
  }
  if (
    layout === null &&
    existsSync(join(ROOT, '.midas', 'state.yaml')) &&
    existsSync(join(ROOT, 'harness', 'state.yaml'))
  ) {
    console.error('migrate-layout: both classic and compact markers found — fix manually before migrating.');
    process.exit(1);
  }

  const rows = MIGRATION_MAP.map((m) => movePath(m.from, m.to, m.type)).filter(Boolean);
  printPlan(rows);

  if (dryRun) {
    console.log('\n  Re-run with --apply to execute. Then run doctor --fix.\n');
    process.exit(0);
  }

  const stateMove = rows.find((r) => r.from === 'harness/state.yaml');
  if (stateMove) applyMove(stateMove);

  for (const r of rows) {
    if (r.from === 'harness/state.yaml') continue;
    applyMove(r);
  }

  patchStateYaml();

  const renderPath = join(ROOT, '.midas', 'scripts', 'render-adapters.mjs');
  if (existsSync(renderPath)) {
    const mod = await import(pathToFileURL(renderPath).href);
    if (typeof mod.renderAdapters === 'function') mod.renderAdapters(ROOT);
  }

  console.log('\n  migrate-layout: done. Run `node .midas/scripts/doctor.mjs` to verify.\n');
}

main().catch((err) => {
  console.error('migrate-layout:', err.message || err);
  process.exit(1);
});
