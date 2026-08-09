#!/usr/bin/env node
// test-gate.mjs — run project tests when production paths changed (ADR-012 / Phase 3).
//
//   node scripts/gates/test-gate.mjs [--run <id>] [--base <ref>]

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeResult, writeGateResult } from '../lib/gate-result.mjs';
import { hasProductionPaths, listChangedPaths } from './lib/diff-paths.mjs';

const TEST_TIMEOUT_MS = 120_000;
const TEST_SCRIPT_PRIORITY = ['test', 'test:unit', 'test:ci'];

/**
 * @param {string} metaUrl
 * @returns {string}
 */
export function resolveGateProjectRoot(metaUrl) {
  const dir = dirname(fileURLToPath(metaUrl));
  const norm = dir.replace(/\\/g, '/');
  if (norm.endsWith('/.harness/scripts/gates')) {
    return resolve(dir, '..', '..', '..');
  }
  if (norm.endsWith('/scripts/gates')) {
    return resolve(dir, '..', '..');
  }
  return resolve(dir, '..', '..');
}

/**
 * @returns {string}
 */
export function defaultRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * @param {Record<string, string> | undefined} scripts
 * @returns {string | null}
 */
export function resolveTestScript(scripts) {
  if (!scripts) return null;
  for (const name of TEST_SCRIPT_PRIORITY) {
    const value = scripts[name];
    if (typeof value === 'string' && value.trim()) return name;
  }
  return null;
}

/**
 * @param {string} projectRoot
 * @returns {Record<string, unknown> | null}
 */
export function readPackageJson(projectRoot) {
  const filePath = join(projectRoot, 'package.json');
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * @param {string} projectRoot
 * @param {string} scriptName
 * @param {{ timeout?: number, runCommand?: typeof spawnSync }} [opts]
 * @returns {{ exitCode: number | null, signal: NodeJS.Signals | null, stdout: string, stderr: string }}
 */
export function defaultRunCommand(projectRoot, scriptName, opts = {}) {
  const timeout = opts.timeout ?? TEST_TIMEOUT_MS;
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const spawn = opts.runCommand || spawnSync;
  const result = spawn(npm, ['run', scriptName], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: false,
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * @param {string} projectRoot
 * @param {{
 *   runId?: string,
 *   base?: string,
 *   listChangedPaths?: typeof listChangedPaths,
 *   readPackageJson?: typeof readPackageJson,
 *   runCommand?: typeof defaultRunCommand,
 *   writeResult?: typeof writeGateResult,
 * }} [opts]
 * @returns {import('../lib/gate-result.mjs').GateResult}
 */
export function runTestGate(projectRoot, opts = {}) {
  const startedAt = new Date();
  const runId = opts.runId || defaultRunId();
  const listFn = opts.listChangedPaths || listChangedPaths;
  const readPkg = opts.readPackageJson || readPackageJson;
  const runCmd = opts.runCommand || defaultRunCommand;
  const writeResult = opts.writeResult || writeGateResult;

  const changedPaths = listFn(projectRoot, { base: opts.base });
  const production = hasProductionPaths(changedPaths);

  const baseFields = {
    gate: /** @type {'test'} */ ('test'),
    production_paths: production,
    changed_paths: changedPaths,
    started_at: startedAt.toISOString(),
  };

  if (!production) {
    const finishedAt = new Date();
    const result = makeResult({
      ...baseFields,
      status: 'skipped',
      reason: 'no-production-paths',
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      summary: 'skipped: no production paths in diff',
    });
    writeResult(projectRoot, runId, result);
    return result;
  }

  const pkg = readPkg(projectRoot);
  const scripts =
    pkg && typeof pkg === 'object' && pkg.scripts && typeof pkg.scripts === 'object'
      ? /** @type {Record<string, string>} */ (pkg.scripts)
      : undefined;
  const testScript = resolveTestScript(scripts);

  if (!testScript) {
    const finishedAt = new Date();
    const result = makeResult({
      ...baseFields,
      status: 'blocked',
      reason: 'no-test-script',
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      summary: 'blocked: no test/test:unit/test:ci script in package.json',
    });
    writeResult(projectRoot, runId, result);
    return result;
  }

  const commandResult = runCmd(projectRoot, testScript, { timeout: TEST_TIMEOUT_MS });
  const passed = commandResult.exitCode === 0;
  const finishedAt = new Date();
  const result = makeResult({
    ...baseFields,
    status: passed ? 'pass' : 'fail',
    reason: passed ? null : 'tests-failed',
    command: `npm run ${testScript}`,
    exit_code: commandResult.exitCode,
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    summary: passed
      ? `pass: npm run ${testScript}`
      : `fail: npm run ${testScript} (exit ${commandResult.exitCode})`,
  });
  writeResult(projectRoot, runId, result);
  return result;
}

/**
 * @param {string[]} argv
 * @returns {{ runId?: string, base?: string }}
 */
export function parseCliArgs(argv) {
  /** @type {{ runId?: string, base?: string }} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--run') {
      out.runId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--base') {
      out.base = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

/**
 * @param {{ status?: string }} result
 * @returns {number}
 */
export function exitCodeForResult(result) {
  const status = result.status;
  if (status === 'pass' || status === 'skipped') return 0;
  return 1;
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const projectRoot = resolveGateProjectRoot(import.meta.url);
  const result = runTestGate(projectRoot, {
    runId: args.runId,
    base: args.base,
  });
  console.log(JSON.stringify(result));
  process.exit(exitCodeForResult(result));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
