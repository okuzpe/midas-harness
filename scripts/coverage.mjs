#!/usr/bin/env node
// coverage.mjs — zero-dependency coverage via Node's built-in test runner (Node >= 22).
//   node scripts/coverage.mjs
//   npm run coverage

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNIT_TEST_FILES } from './lib/unit-test-files.mjs';
import { UNIT_TEST_SPAWN } from './lib/spawn-failure.mjs';
import { maybeHelp } from './lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const r = spawnSync(
  process.execPath,
  [
    '--test',
    '--experimental-test-coverage',
    '--test-coverage-exclude=**/cli/template/**',
    '--test-coverage-exclude=**/node_modules/**',
    '--test-coverage-exclude=**/scripts/test/snapshots/**',
    '--test-coverage-lines=76',
    ...UNIT_TEST_FILES,
  ],
  { cwd: ROOT, ...UNIT_TEST_SPAWN },
);

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.error) {
  console.error(`coverage: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status ?? 1);
