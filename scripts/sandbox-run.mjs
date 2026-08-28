#!/usr/bin/env node
// sandbox-run.mjs — engine-only mechanical floor for /midas-sandbox (ADR-015).
//
//   node scripts/sandbox-run.mjs reset
//   node scripts/sandbox-run.mjs env
//   node scripts/sandbox-run.mjs start-run
//   node scripts/sandbox-run.mjs finish
//
// Not shipped to product installs (omit from ship-manifest.mjs).

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEngineRepo } from './engine-only.mjs';
import { resolvePaths } from './paths.mjs';
import { runTraceWrite } from './trace-write.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SEED = join(ROOT, 'sandbox', 'seed');
const WORK = join(ROOT, 'sandbox', 'example-product');
const EXPECTED_NAME = 'sandbox-example';

const HELP = `sandbox-run — mechanical floor for /midas-sandbox (engine only)

Usage:
  node scripts/sandbox-run.mjs reset      copy sandbox/seed/ → sandbox/example-product/
  node scripts/sandbox-run.mjs env        print resolved paths; exit 1 on isolation fail
  node scripts/sandbox-run.mjs start-run  trace-write start-run scoped to the working copy
  node scripts/sandbox-run.mjs finish     trace-write finish scoped to the working copy
  node scripts/sandbox-run.mjs --help
`;

const fsApi = { existsSync, readFileSync };
const pathApi = { join };

/**
 * @returns {string}
 */
function readFixtureName(projectRoot) {
  const statePath = join(projectRoot, '.harness', 'state.yaml');
  if (!existsSync(statePath)) return '';
  const m = readFileSync(statePath, 'utf8').match(/^name:\s*(\S+)/m);
  return m ? m[1].trim() : '';
}

/**
 * Copy seed → working copy (wipe first).
 * @returns {{ ok: boolean, work: string, error?: string }}
 */
export function resetSandbox(root = ROOT) {
  const seed = join(root, 'sandbox', 'seed');
  const work = join(root, 'sandbox', 'example-product');
  if (!existsSync(join(seed, '.harness', 'state.yaml'))) {
    return { ok: false, work, error: `missing seed state at ${join(seed, '.harness', 'state.yaml')}` };
  }
  rmSync(work, { recursive: true, force: true });
  mkdirSync(dirname(work), { recursive: true });
  cpSync(seed, work, { recursive: true });
  return { ok: true, work };
}

/**
 * Resolve and validate isolation: fixture name + engine/scripts point at this repo.
 * @returns {{ ok: boolean, name: string, state: string, engine: string, scripts: string, product: string, error?: string }}
 */
export function inspectSandboxEnv(root = ROOT) {
  const work = join(root, 'sandbox', 'example-product');
  if (!existsSync(join(work, '.harness', 'state.yaml'))) {
    return {
      ok: false,
      name: '',
      state: '',
      engine: '',
      scripts: '',
      product: '',
      error: 'working copy missing — run `node scripts/sandbox-run.mjs reset`',
    };
  }
  const paths = resolvePaths(work);
  const name = readFixtureName(work);
  const engineAbs = resolve(work, paths.engine);
  const scriptsAbs = resolve(work, paths.scripts);
  const wantEngine = resolve(root, 'harness');
  const wantScripts = resolve(root, 'scripts');
  const stateAbs = resolve(work, paths.state);
  const productAbs = resolve(work, paths.product);
  const ok =
    name === EXPECTED_NAME &&
    engineAbs === wantEngine &&
    scriptsAbs === wantScripts;
  return {
    ok,
    name,
    state: stateAbs,
    engine: engineAbs,
    scripts: scriptsAbs,
    product: productAbs,
    error: ok
      ? undefined
      : `isolation fail name=${name} engine=${engineAbs} scripts=${scriptsAbs} (want name=${EXPECTED_NAME} engine=${wantEngine} scripts=${wantScripts})`,
  };
}

function printEnv(info) {
  console.log(`name:    ${info.name}`);
  console.log(`state:   ${info.state}`);
  console.log(`engine:  ${info.engine}`);
  console.log(`scripts: ${info.scripts}`);
  console.log(`product: ${info.product}`);
  if (!info.ok) console.error(`sandbox-run env: ${info.error}`);
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
    return runTraceWrite([cmd, ...argv.slice(1)], { projectRoot: WORK });
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

export { EXPECTED_NAME, SEED, WORK, main };
