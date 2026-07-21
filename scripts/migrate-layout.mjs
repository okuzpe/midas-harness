#!/usr/bin/env node
// migrate-layout.mjs — classic/compact → compact/hub relocation (dry-run by default). Dependency-free.

import {
  existsSync,
  mkdirSync,
  cpSync,
  readFileSync,
  readdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import {
  detectLayout,
  MIGRATION_MAP,
  MIGRATION_MAP_HUB,
  HUB_PRODUCT_MOVE,
  compactPathsYaml,
  hubPathsYaml,
} from './paths.mjs';

const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
const targetArg = args.find((a) => a.startsWith('--target='));
const targetLayout = targetArg ? targetArg.slice('--target='.length) : 'compact';
const rootArg = args.find((a) => !a.startsWith('-'));
const ROOT = rootArg ? resolve(process.cwd(), rootArg) : process.cwd();
const TEST_FAIL_STEP = process.env.MIDAS_TEST_FAIL_STEP || '';

if (!['compact', 'hub'].includes(targetLayout)) {
  console.error('migrate-layout: --target must be compact or hub');
  process.exit(1);
}

function movePath(from, to, type) {
  const src = join(ROOT, from);
  if (!existsSync(src)) return null;
  return { from, to, type, src, dst: join(ROOT, to) };
}

function printPlan(rows, label) {
  console.log(`\n  migrate-layout — ${label}` + (dryRun ? ' (dry run)' : ''));
  console.log('  ' + 'FROM'.padEnd(36) + ' → ' + 'TO');
  for (const r of rows) console.log(`  ${r.from.padEnd(36)} → ${r.to}`);
  if (!rows.length) console.log('  (nothing to move — already at target layout or empty install)');
}

function applyMove(r) {
  mkdirSync(dirname(r.dst), { recursive: true });
  renameSync(r.src, r.dst);
}

function migrationRollbackPaths() {
  return ['.midas', 'harness', 'scripts', 'product', 'docs/agents-and-models.md'];
}

function beginRollbackSession(root, relPaths) {
  const backupRoot = mkdtempSync(join(tmpdir(), 'midas-migration-backup-'));
  const entries = [];
  for (const rel of relPaths) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const info = statSync(abs);
    const kind = info.isDirectory() ? 'dir' : 'file';
    const backupAbs = join(backupRoot, rel);
    mkdirSync(dirname(backupAbs), { recursive: true });
    cpSync(abs, backupAbs, { recursive: kind === 'dir', force: true, preserveTimestamps: true });
    entries.push({ rel, kind });
  }
  return { root, backupRoot, relPaths: [...relPaths], entries };
}

function rollbackMigration(session) {
  if (!session) return;
  const cleanupPaths = [...new Set(session.relPaths)].sort((a, b) => b.length - a.length);
  for (const rel of cleanupPaths) {
    rmSync(join(session.root, rel), { recursive: true, force: true });
  }
  for (const { rel, kind } of session.entries) {
    const backupAbs = join(session.backupRoot, rel);
    if (!existsSync(backupAbs)) continue;
    const dst = join(session.root, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(backupAbs, dst, { recursive: kind === 'dir', force: true, preserveTimestamps: true });
  }
  rmSync(session.backupRoot, { recursive: true, force: true });
}

function discardRollbackSession(session) {
  if (!session) return;
  rmSync(session.backupRoot, { recursive: true, force: true });
}

function maybeFail(step) {
  if (TEST_FAIL_STEP === step) {
    throw new Error(`MIDAS_TEST_FAIL_STEP=${step}`);
  }
}

function walkMarkdownFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMarkdownFiles(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Rewrite product/ prefixes in state.yaml (artifacts, enforcement, captures). */
function rewriteStatePaths(raw, productPrefix) {
  let next = raw;
  if (productPrefix === '.midas/product') {
    next = next.replace(/(^|\s|[[(,])product\//gm, `$1.midas/product/`);
    next = next.replace(/config:\s*product\//g, 'config: .midas/product/');
    next = next.replace(/(^|\s|[[(,])harness\/rules\//gm, `$1.midas/engine/rules/`);
    next = next.replace(/(^|\s|[[(,])\.harness\//gm, `$1.midas/`);
  }
  return next;
}

/** Fix markdown links after product tree move. */
function rewriteMarkdownLinks(productDir) {
  if (!existsSync(productDir)) return 0;
  let count = 0;
  for (const file of walkMarkdownFiles(productDir)) {
    const raw = readFileSync(file, 'utf8');
    const fixed = raw.replace(/\]\(product\//g, '](.midas/product/');
    if (fixed !== raw) {
      writeFileSync(file, fixed, 'utf8');
      count++;
    }
  }
  return count;
}

function patchStateYaml(layoutName) {
  const stateFile = join(ROOT, '.midas', 'state.yaml');
  const classicState = join(ROOT, 'harness', 'state.yaml');
  const path = existsSync(stateFile) ? stateFile : classicState;
  if (!existsSync(path)) return;

  let raw = readFileSync(path, 'utf8');
  if (!/^layout:/m.test(raw)) {
    raw = raw.replace(/^(midas_version:[^\n]*\n)/m, `$1layout: ${layoutName}\n`);
  } else {
    raw = raw.replace(/^layout:\s*\S+/m, `layout: ${layoutName}`);
  }

  const pathsBlock = layoutName === 'hub' ? hubPathsYaml() : compactPathsYaml();
  const pathsYaml = [
    'paths:',
    `  engine: ${pathsBlock.engine}`,
    `  scripts: ${pathsBlock.scripts}`,
    `  state: ${pathsBlock.state}`,
    `  runs: ${pathsBlock.runs}`,
    ...(pathsBlock.product && layoutName === 'hub' ? [`  product: ${pathsBlock.product}`] : []),
  ].join('\n');

  if (!/^paths:/m.test(raw)) {
    raw = raw.replace(/^(layout:[^\n]*\n)/m, `$1${pathsYaml}\n`);
  } else if (layoutName === 'hub' && !/^  product:/m.test(raw)) {
    raw = raw.replace(/^(  runs:[^\n]*\n)/m, `$1  product: ${pathsBlock.product}\n`);
  }

  if (layoutName === 'hub') {
    raw = rewriteStatePaths(raw, '.midas/product');
  }

  writeFileSync(path, raw, 'utf8');
}

function buildPlan(current, target) {
  if (target === 'hub') {
    if (current === 'classic') {
      return MIGRATION_MAP_HUB.map((m) => movePath(m.from, m.to, m.type)).filter(Boolean);
    }
    if (current === 'compact') {
      return [movePath(HUB_PRODUCT_MOVE.from, HUB_PRODUCT_MOVE.to, HUB_PRODUCT_MOVE.type)].filter(Boolean);
    }
    return [];
  }
  // target compact
  if (current === 'classic') {
    return MIGRATION_MAP.map((m) => movePath(m.from, m.to, m.type)).filter(Boolean);
  }
  return [];
}

function findConflicts(rows) {
  return rows.filter((r) => existsSync(r.src) && existsSync(r.dst));
}

async function main() {
  const layout = detectLayout(ROOT);
  if (layout === targetLayout) {
    console.log(`migrate-layout: already ${targetLayout} — nothing to do.`);
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
  if (layout === 'hub' && targetLayout === 'compact') {
    console.error('migrate-layout: hub → compact is not supported (move product/ manually).');
    process.exit(1);
  }

  const current = layout || 'classic';
  const rows = buildPlan(current, targetLayout);
  const label = `${current} → ${targetLayout}`;
  printPlan(rows, label);

  const conflicts = findConflicts(rows);
  if (conflicts.length) {
    console.error('\n  migrate-layout: refusing to overwrite existing destination path(s):');
    for (const r of conflicts) console.error(`     · ${r.dst}`);
    console.error('  Remove the destination(s) or resolve the partial migration before re-running --apply.\n');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n  Re-run with --apply to execute. Then run doctor --fix.\n');
    process.exit(0);
  }

  const rollbackSession = beginRollbackSession(ROOT, migrationRollbackPaths());
  try {
    const stateMove = rows.find((r) => r.from === 'harness/state.yaml');
    if (stateMove) {
      applyMove(stateMove);
      maybeFail('after-first-move');
    }

    for (const r of rows) {
      if (r.from === 'harness/state.yaml') continue;
      applyMove(r);
      maybeFail('after-first-move');
    }

    patchStateYaml(targetLayout);

    if (targetLayout === 'hub') {
      const n = rewriteMarkdownLinks(join(ROOT, '.midas', 'product'));
      if (n) console.log(`  Rewrote markdown links in ${n} file(s) under .midas/product/`);
    }

    const renderPath = join(ROOT, '.midas', 'scripts', 'render-adapters.mjs');
    if (existsSync(renderPath)) {
      const mod = await import(pathToFileURL(renderPath).href);
      if (typeof mod.renderAdapters === 'function') mod.renderAdapters(ROOT);
    }

    console.log('\n  migrate-layout: done. Run `node .midas/scripts/doctor.mjs` to verify.\n');
  } catch (err) {
    rollbackMigration(rollbackSession);
    throw err;
  } finally {
    discardRollbackSession(rollbackSession);
  }
}

main().catch((err) => {
  console.error(`migrate-layout: rolled back after failure — ${err.message || err}`);
  process.exit(1);
});
