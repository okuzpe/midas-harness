#!/usr/bin/env node
// sandbox-run.mjs — engine-only mechanical floor for /midas-sandbox (ADR-015).
//
//   node scripts/sandbox-run.mjs reset
//   node scripts/sandbox-run.mjs env
//   node scripts/sandbox-run.mjs start-run
//   node scripts/sandbox-run.mjs finish
//   node scripts/sandbox-run.mjs grade [--skill <name>] [--ledger] [--missing fail|skip]
//
// Not shipped to product installs (omit from ship-manifest.mjs).

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEngineRepo } from './engine-only.mjs';
import {
  EXPECTED_NAME,
  ROOT,
  SEED,
  WORK,
  inspectSandboxEnv,
  isPathInside,
  resetSandbox,
} from './lib/sandbox-env.mjs';
import { gradeSandbox, printGrade, normalizeSkillName } from './lib/sandbox-grade.mjs';
import { runTraceWrite } from './trace-write.mjs';

const HELP = `sandbox-run — mechanical floor for /midas-sandbox (engine only)

Usage:
  node scripts/sandbox-run.mjs reset      copy sandbox/seed/ → sandbox/example-product/
  node scripts/sandbox-run.mjs env        print resolved paths; exit 1 on isolation fail
  node scripts/sandbox-run.mjs start-run  trace-write start-run scoped to the working copy
  node scripts/sandbox-run.mjs finish     trace-write finish scoped to the working copy
  node scripts/sandbox-run.mjs grade [--skill <name>] [--ledger] [--missing fail|skip]
      run isolation + skill oracles against the working copy (does not reset)
      --missing skip: absent skill oracle is not a fail (for --smoke / --all next skills)
  node scripts/sandbox-run.mjs --help
`;

const fsApi = { existsSync, readFileSync };
const pathApi = { join };

function printEnv(info) {
  console.log(`name:             ${info.name}`);
  console.log(`state:            ${info.state}`);
  console.log(`engine:           ${info.engine}`);
  console.log(`scripts:          ${info.scripts}`);
  console.log(`product:          ${info.product}`);
  console.log(`MIDAS_TRACE_ROOT: ${info.midasTraceRoot}`);
  if (!info.ok) console.error(`sandbox-run env: ${info.error}`);
}

function bindTraceRoot(work) {
  process.env.MIDAS_TRACE_ROOT = work;
}

function parseGradeArgs(argv) {
  let skill = 'isolation';
  let ledger = false;
  let missing = 'fail';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ledger') {
      ledger = true;
      continue;
    }
    if (arg === '--missing') {
      const v = argv[i + 1];
      if (v && !v.startsWith('--')) {
        missing = v === 'skip' ? 'skip' : 'fail';
        i += 1;
      }
      continue;
    }
    if (arg.startsWith('--missing=')) {
      missing = arg.slice('--missing='.length) === 'skip' ? 'skip' : 'fail';
      continue;
    }
    if (arg === '--skill') {
      const v = argv[i + 1];
      if (v && !v.startsWith('--')) {
        skill = v;
        i += 1;
      }
      continue;
    }
    if (arg.startsWith('--skill=')) skill = arg.slice('--skill='.length);
  }
  return { skill: normalizeSkillName(skill) || 'isolation', ledger, missing };
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h') || !argv[0]) {
    console.log(HELP);
    return argv[0] ? 0 : 2;
  }
  if (!isEngineRepo(ROOT, fsApi, pathApi)) {
    console.error('sandbox-run: not the midas-harness engine repo — abort.');
    return 2;
  }
  const cmd = argv[0];
  if (cmd === 'reset') {
    const r = resetSandbox(ROOT);
    if (!r.ok) {
      console.error(`sandbox-run reset: ${r.error}`);
      return 1;
    }
    console.log(`sandbox-run reset: ${r.work}`);
    return 0;
  }
  if (cmd === 'env') {
    const info = inspectSandboxEnv(ROOT);
    printEnv(info);
    return info.ok ? 0 : 1;
  }
  if (cmd === 'start-run' || cmd === 'finish') {
    const info = inspectSandboxEnv(ROOT);
    if (!info.ok) {
      console.error(`sandbox-run ${cmd}: ${info.error}`);
      return 1;
    }
    bindTraceRoot(info.work);
    return runTraceWrite([cmd, ...argv.slice(1)], { projectRoot: info.work });
  }
  if (cmd === 'grade') {
    const { skill, ledger, missing } = parseGradeArgs(argv.slice(1));
    const result = gradeSandbox({ root: ROOT, skill, ledger, missing });
    printGrade(result, process.stdout, process.stderr);
    return result.ok ? 0 : 1;
  }
  console.error(`sandbox-run: unknown command ${cmd}`);
  console.log(HELP);
  return 2;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}

export { EXPECTED_NAME, SEED, WORK, ROOT, inspectSandboxEnv, isPathInside, resetSandbox, gradeSandbox, main, parseGradeArgs, normalizeSkillName };
