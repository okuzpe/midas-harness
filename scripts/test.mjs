#!/usr/bin/env node
// test.mjs — thin runner for Midas structural tests (domains under scripts/test/).
//
// Run: `node scripts/test.mjs`  (exit 0 = all pass, 1 = at least one failure).
// Fast: `MIDAS_TEST_FAST=1 node scripts/test.mjs` skips installer subprocess fixtures.

import { maybeHelp } from './lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

import { reportAndExit } from './test/harness.mjs';

const domains = [
  './test/json.mjs',
  './test/skills.mjs',
  './test/adapters.mjs',
  './test/version.mjs',
  './test/gates.mjs',
  './test/installer.mjs',
  './test/paths.mjs',
  './test/bundle.mjs',
  './test/runtime.mjs',
];

for (const rel of domains) {
  const mod = await import(rel);
  await mod.run();
}

reportAndExit();
