#!/usr/bin/env node
// sandbox-run.mjs — engine-only mechanical floor for /midas-sandbox (ADR-015).
//
//   node scripts/sandbox-run.mjs reset [--profile pipeline|capture|install] [--blank-idea]
//   node scripts/sandbox-run.mjs env [--profile pipeline|capture|install]
//   node scripts/sandbox-run.mjs start-run [--profile pipeline|capture|install]
//   node scripts/sandbox-run.mjs finish [--profile pipeline|capture|install]
//   node scripts/sandbox-run.mjs grade [--skill <name>] [--ledger] [--missing fail|skip]
//
// Not shipped to product installs (omit from ship-manifest.mjs).

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEngineRepo } from './engine-only.mjs';
import {
  EXPECTED_NAME,
  ENV_POINTER_REL,
  ROOT,
  SEED,
  WORK,
  WORK_INSTALL,
  inspectSandboxEnv,
  isPathInside,
  parseSandboxProfileArgs,
  resetSandbox,
  writeSandboxEnvPointer,
} from './lib/sandbox-env.mjs';
import { gradeSandbox, printGrade, normalizeSkillName } from './lib/sandbox-grade.mjs';
import { resolveTracesRoot } from './lib/trace-store.mjs';
import { runTraceWrite } from './trace-write.mjs';

const HELP = `sandbox-run — mechanical floor for /midas-sandbox (engine only)

Usage:
  node scripts/sandbox-run.mjs reset [--profile pipeline|capture|install] [--blank-idea]
      pipeline (default): copy sandbox/seed/ → sandbox/example-product/
      capture / --blank-idea / --empty-idea: same, then overlay blank templates/idea.md
      install: nested create-midas --force into sandbox/example-install/
  node scripts/sandbox-run.mjs env [--profile pipeline|capture|install]
      print resolved paths; write .harness/cache/sandbox-env.json; exit 1 on isolation fail
  node scripts/sandbox-run.mjs start-run [--profile pipeline|capture|install]
  node scripts/sandbox-run.mjs finish [--profile pipeline|capture|install]
                              (exit 1 if no-active-run — lab is not fail-open)
  node scripts/sandbox-run.mjs grade [--skill <name>] [--ledger] [--missing fail|skip]
      run isolation + skill oracles against the pipeline working copy (does not reset)
      --missing skip: absent skill oracle is not a fail (for --smoke / --all next skills)
  node scripts/sandbox-run.mjs --help
`;

const fsApi = { existsSync, readFileSync };
const pathApi = { join };

function printEnv(info) {
  console.log(`profile:          ${info.profile || 'pipeline'}`);
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

const ACTIVE_RUN_REL = join('sandbox', 'findings', '_active-run.json');

function activeRunPath(root = ROOT) {
  return join(root, ACTIVE_RUN_REL);
}

function readActiveRun(root = ROOT) {
  const abs = activeRunPath(root);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function writeActiveRun(payload, root = ROOT) {
  mkdirSync(join(root, 'sandbox', 'findings'), { recursive: true });
  writeFileSync(activeRunPath(root), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function clearActiveRun(root = ROOT) {
  const abs = activeRunPath(root);
  if (existsSync(abs)) unlinkSync(abs);
}

function parseTracePayload(body) {
  const line = String(body || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .pop();
  if (!line) return {};
  try {
    const j = JSON.parse(line);
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch {
    return {};
  }
}

function stripProfileArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--profile') {
      i += 1;
      continue;
    }
    if (arg.startsWith('--profile=')) continue;
    if (arg === '--blank-idea' || arg === '--empty-idea') continue;
    out.push(arg);
  }
  return out;
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
  const { profile } = parseSandboxProfileArgs(argv.slice(1));
  if (cmd === 'reset') {
    const r = resetSandbox(ROOT, { profile });
    if (!r.ok) {
      console.error(`sandbox-run reset: ${r.error}`);
      return 1;
    }
    console.log(`sandbox-run reset: ${r.work}${r.profile && r.profile !== 'pipeline' ? ` profile=${r.profile}` : ''}`);
    return 0;
  }
  if (cmd === 'env') {
    const info = inspectSandboxEnv(ROOT, { profile });
    printEnv(info);
    return info.ok ? 0 : 1;
  }
  if (cmd === 'start-run' || cmd === 'finish') {
    const info = inspectSandboxEnv(ROOT, { profile });
    if (!info.ok) {
      console.error(`sandbox-run ${cmd}: ${info.error}`);
      return 1;
    }
    bindTraceRoot(info.work);
    const chunks = [];
    const stdout = {
      write(s) {
        chunks.push(s);
        return process.stdout.write(s);
      },
    };
    runTraceWrite([cmd, ...stripProfileArgs(argv.slice(1))], {
      projectRoot: info.work,
      stdout,
    });
    const payload = parseTracePayload(chunks.join(''));
    const tracesRoot = resolveTracesRoot(info.work);
    if (cmd === 'start-run') {
      if (payload.session_id && payload.run_id) {
        writeSandboxEnvPointer(info);
        writeActiveRun({
          session_id: payload.session_id,
          run_id: payload.run_id,
          traces_root: tracesRoot,
          work: info.work,
          profile: info.profile,
        });
        return 0;
      }
      console.error('sandbox-run start-run: missing session_id/run_id');
      return 1;
    }
    if (payload.ok === false || payload.reason === 'no-active-run' || !payload.run_id) {
      const last = readActiveRun();
      const hint = last
        ? ` last start-run session=${last.session_id} run=${last.run_id} traces=${last.traces_root}`
        : '';
      console.error(`sandbox-run finish: no-active-run.${hint}`);
      return 1;
    }
    clearActiveRun();
    return 0;
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

export {
  EXPECTED_NAME,
  ENV_POINTER_REL,
  SEED,
  WORK,
  WORK_INSTALL,
  ROOT,
  ACTIVE_RUN_REL,
  inspectSandboxEnv,
  isPathInside,
  parseSandboxProfileArgs,
  resetSandbox,
  gradeSandbox,
  main,
  parseGradeArgs,
  normalizeSkillName,
};
