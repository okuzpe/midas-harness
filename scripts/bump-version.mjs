#!/usr/bin/env node
// bump-version.mjs — write harness/VERSION (sole source), sync mirrors, rebuild.
//
//   npm run bump -- 2.0.1
//   node scripts/bump-version.mjs 2.0.1 --dry-run

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ENGINE_VERSION_REL } from './lib/engine-version.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const next = process.argv.slice(2).find((a) => !a.startsWith('-'));

const HELP = `bump-version — set harness/VERSION and propagate everywhere

Usage:
  npm run bump -- <X.Y.Z> [--dry-run]

Sole editable source: ${ENGINE_VERSION_REL}
Propagation: node scripts/sync-version.mjs (also runs at start of npm run build)
Install shims (install.sh / install.ps1) read ${ENGINE_VERSION_REL} at runtime — not duplicated.

Does NOT write CHANGELOG release notes or create the git tag.`;

if (!next || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP);
  process.exit(next ? 0 : 1);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(next)) {
  console.error(`bump-version: invalid version "${next}" (want SemVer, e.g. 2.0.1 or 2.1.0-rc.1)`);
  process.exit(1);
}

const versionPath = join(ROOT, ENGINE_VERSION_REL);
const prev = existsSync(versionPath) ? readFileSync(versionPath, 'utf8').trim() : '';
if (prev === next) {
  console.error(`bump-version: already at ${next}`);
  process.exit(1);
}

console.log(`bump-version: ${prev || '(none)'} → ${next}${DRY ? ' (dry-run)' : ''}`);
console.log(`  · ${ENGINE_VERSION_REL}`);

if (DRY) {
  console.log('No files written.');
  process.exit(0);
}

writeFileSync(versionPath, `${next}\n`, 'utf8');

const sync = spawnSync(process.execPath, [join(ROOT, 'scripts', 'sync-version.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (sync.status !== 0) {
  console.error('bump-version: sync-version failed');
  process.exit(sync.status ?? 1);
}

const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });
if (build.status !== 0) {
  console.error('bump-version: npm run build failed — VERSION written; fix and rebuild.');
  process.exit(build.status ?? 1);
}

console.log(`
Done. Next:
  1. Add ## [${next}] under [Unreleased] in CHANGELOG.md
  2. npm test
  3. git commit && git tag v${next} && git push origin main v${next}
`);
