#!/usr/bin/env node
// sync-version.mjs — propagate harness/VERSION to all derived surfaces (never edit mirrors by hand).
//
//   node scripts/sync-version.mjs           write mirrors from harness/VERSION
//   node scripts/sync-version.mjs --check   exit 1 when any mirror drifts
//   node scripts/sync-version.mjs --dry-run print planned writes only

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION_REL, readEngineVersion } from './lib/engine-version.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry-run');

const version = readEngineVersion(ROOT);
if (!version) {
  console.error(`sync-version: missing ${ENGINE_VERSION_REL}`);
  process.exit(1);
}

/** @type {{ path: string, before: string, after: string }[]} */
const edits = [];

/**
 * @param {string} rel
 * @param {(text: string, v: string) => string} transform
 * @param {{ optional?: boolean }} [opts]
 */
function plan(rel, transform, opts = {}) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    if (opts.optional) return;
    console.error(`sync-version: missing ${rel}`);
    process.exit(1);
  }
  const before = readFileSync(abs, 'utf8');
  const after = transform(before, version);
  if (after !== before) edits.push({ path: rel, before, after });
}

function replaceJsonVersion(text, v) {
  return text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`);
}

plan('package.json', (t, v) => replaceJsonVersion(t, v));
plan('cli/package.json', (t, v) => replaceJsonVersion(t, v));
plan('gemini-extension.json', (t, v) => replaceJsonVersion(t, v));
plan('harness/state.yaml', (t, v) => t.replace(/^midas_version:\s*[^\s#]+/m, `midas_version: ${v}`));
plan('harness/state.schema.md', (t, v) => t.replace(/midas_version:\s*[0-9][^\s#]*/, `midas_version: ${v}`));
plan(
  'scripts/fixtures/product-closed/.harness/state.yaml',
  (t, v) => t.replace(/^midas_version:\s*[^\s#]+/m, `midas_version: ${v}`),
  { optional: false },
);
plan('INSTALL.md', (t, v) => {
  let out = t.replace(/#v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g, `#v${v}`);
  out = out.replace(/currently \*\*v[\d.]+(?:-[0-9A-Za-z.-]+)?\*\*/g, `currently **v${v}**`);
  if (!out.includes(`#v${v}`)) {
    throw new Error(`INSTALL.md sync produced no #v${v} pins`);
  }
  return out;
});
plan('CHANGELOG.md', (t, v) => {
  const nextLink = `[Unreleased]: https://github.com/okuzpe/midas-harness/compare/v${v}...HEAD`;
  if (t.includes(nextLink)) return t;
  const out = t.replace(
    /\[Unreleased\]:\s*https:\/\/github\.com\/okuzpe\/midas-harness\/compare\/v[\w.-]+\.\.\.HEAD/,
    nextLink,
  );
  return out === t ? t : out;
});

if (CHECK) {
  if (edits.length) {
    console.error(`sync-version: ${edits.length} file(s) drift from ${ENGINE_VERSION_REL} (${version}):`);
    for (const e of edits) console.error(`  · ${e.path}`);
    process.exit(1);
  }
  console.log(`sync-version: ok — all mirrors match ${ENGINE_VERSION_REL} (${version})`);
  process.exit(0);
}

if (edits.length === 0) {
  console.log(`sync-version: ok — already aligned with ${ENGINE_VERSION_REL} (${version})`);
  process.exit(0);
}

console.log(`sync-version: ${ENGINE_VERSION_REL} → ${version}`);
for (const e of edits) console.log(`  · ${e.path}`);

if (DRY) {
  console.log('No files written (--dry-run).');
  process.exit(0);
}

for (const e of edits) writeFileSync(join(ROOT, e.path), e.after, 'utf8');
