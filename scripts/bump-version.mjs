#!/usr/bin/env node
// bump-version.mjs — single-command engine version bump (report + write).
//
//   node scripts/bump-version.mjs 2.0.1           write sources + rebuild mirrors
//   node scripts/bump-version.mjs 2.0.1 --dry-run  print plan only
//
// Canonical source after the bump: harness/VERSION.
// User-facing copy-paste pins live only in INSTALL.md (rewritten here).
// Skills / installer help / most docs use #v{VERSION} placeholders or read VERSION at runtime.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const next = process.argv.slice(2).find((a) => !a.startsWith('-'));

const HELP = `bump-version — bump the Midas engine version from one place

Usage:
  node scripts/bump-version.mjs <X.Y.Z> [--dry-run]

Updates:
  harness/VERSION
  package.json, create-midas/package.json, gemini-extension.json
  harness/state.yaml + harness/state.schema.md example stamps
  INSTALL.md npx #v… pins (the only user-facing copy-paste pin)
  CHANGELOG.md [Unreleased] compare link

Then runs npm run build (unless --dry-run).
Does NOT write CHANGELOG release notes or create the git tag — do those by hand.`;

if (!next || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP);
  process.exit(next ? 0 : 1);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(next)) {
  console.error(`bump-version: invalid version "${next}" (want SemVer, e.g. 2.0.1 or 2.1.0-rc.1)`);
  process.exit(1);
}

const prev = readFileSync(join(ROOT, 'harness', 'VERSION'), 'utf8').trim();
if (prev === next) {
  console.error(`bump-version: already at ${next}`);
  process.exit(1);
}

/** @type {{ path: string, before: string, after: string }[]} */
const edits = [];

/**
 * @param {string} rel
 * @param {(text: string) => string} transform
 * @param {{ allowNoop?: boolean }} [opts]
 */
function plan(rel, transform, opts = {}) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`bump-version: missing ${rel}`);
    process.exit(1);
  }
  const before = readFileSync(abs, 'utf8');
  const after = transform(before);
  if (after === before) {
    if (opts.allowNoop) {
      console.log(`  · ${rel} (already current)`);
      return;
    }
    console.error(`bump-version: no change produced in ${rel} (prev=${prev})`);
    process.exit(1);
  }
  edits.push({ path: rel, before, after });
}

function replaceJsonVersion(text) {
  return text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`);
}

plan('harness/VERSION', () => `${next}\n`);
plan('package.json', replaceJsonVersion);
plan('create-midas/package.json', replaceJsonVersion);
plan('gemini-extension.json', replaceJsonVersion);
plan('harness/state.yaml', (t) => t.replace(/^midas_version:\s*[^\s#]+/m, `midas_version: ${next}`));
plan('harness/state.schema.md', (t) => t.replace(/midas_version:\s*[0-9][^\s#]*/, `midas_version: ${next}`));
plan('INSTALL.md', (t) => {
  const out = t.replaceAll(`#v${prev}`, `#v${next}`);
  if (!out.includes(`#v${next}`)) {
    throw new Error(`INSTALL.md had no #v${prev} pins to rewrite`);
  }
  return out;
});
plan('CHANGELOG.md', (t) => {
  // Point Unreleased at the new tag once it exists; keep history rows intact.
  const nextLink = `[Unreleased]: https://github.com/okuzpe/midas-harness/compare/v${next}...HEAD`;
  if (t.includes(nextLink)) return t; // already pointed (e.g. re-run)
  const out = t.replace(
    /\[Unreleased\]:\s*https:\/\/github\.com\/okuzpe\/midas-harness\/compare\/v[\w.-]+\.\.\.HEAD/,
    nextLink,
  );
  if (out === t) {
    throw new Error('CHANGELOG.md [Unreleased] compare link not found');
  }
  return out;
}, { allowNoop: true });

console.log(`bump-version: ${prev} → ${next}${DRY ? ' (dry-run)' : ''}`);
for (const e of edits) console.log(`  · ${e.path}`);

if (DRY) {
  console.log('No files written.');
  process.exit(0);
}

for (const e of edits) writeFileSync(join(ROOT, e.path), e.after, 'utf8');

const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });
if (build.status !== 0) {
  console.error('bump-version: npm run build failed — sources already written; fix and rebuild.');
  process.exit(build.status ?? 1);
}

console.log(`
Done. Next:
  1. Add ## [${next}] section under [Unreleased] in CHANGELOG.md
  2. npm test
  3. git commit && git tag v${next} && git push origin main v${next}
`);
