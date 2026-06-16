#!/usr/bin/env node
// doctor.mjs — Keel adapter drift checker (dependency-free, Node ESM).
//
// Re-derives what render-adapters WOULD write, diffs it against the on-disk adapters, prints a
// per-file OK/DRIFT report, and exits 0 (all in sync) or 1 (drift detected). With --fix it calls
// the shared render logic to rewrite the adapters (then exits 0).
//
// Shares its render logic with render-adapters.mjs by importing it (no duplication, no npm deps).
// Runs on Windows: `node scripts/doctor.mjs` or `node scripts/doctor.mjs --fix`.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeAdapters, renderAdapters } from './render-adapters.mjs';

const FIX = process.argv.includes('--fix');

/** Read an absolute file or null if it does not exist (robust to missing adapters). */
function readOrNull(abs) {
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function main() {
  if (FIX) {
    // --fix: rewrite everything via the same render path render-adapters.mjs uses.
    const { hash, results } = renderAdapters();
    console.log('keel doctor --fix: re-rendered adapters from harness/conventions.md');
    for (const r of results) {
      console.log(`  ${r.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${r.path}`);
    }
    console.log(`  source hash: ${hash}`);
    process.exit(0);
  }

  // Check mode: compute intended content and compare against disk.
  const { hash, files } = computeAdapters();
  let drift = false;

  console.log('keel doctor: checking generated adapters against harness/conventions.md');
  for (const f of files) {
    const onDisk = readOrNull(f.abs);
    if (onDisk === null) {
      drift = true;
      console.log(`  MISSING  ${f.path}`);
    } else if (onDisk !== f.content) {
      drift = true;
      console.log(`  DRIFT    ${f.path}`);
    } else {
      console.log(`  OK       ${f.path}`);
    }
  }

  // Cross-check the persisted source hash (informational; the per-file drift above is authoritative).
  const adaptersHashAbs = resolve(new URL('../.harness/adapters.hash', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const storedHash = (readOrNull(adaptersHashAbs) || '').trim();
  if (storedHash && storedHash !== hash) {
    console.log(`  NOTE     .harness/adapters.hash stale (stored ${storedHash}, source ${hash})`);
  } else if (!storedHash) {
    console.log('  NOTE     .harness/adapters.hash missing — run with --fix to write it');
  }

  if (drift) {
    console.log('\nAdapters are OUT OF SYNC. Run `node scripts/doctor.mjs --fix` (or `/keel-doctor`) to re-render.');
    process.exit(1);
  }
  console.log('\nAll adapters in sync.');
  process.exit(0);
}

main();
