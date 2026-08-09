// quality-gate.mjs — diff-scoped lint/typecheck gate receipt (ADR-012).

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeResult, writeGateResult } from '../lib/gate-result.mjs';
import { hasProductionPaths, listChangedPaths } from './lib/diff-paths.mjs';

const DEFAULT_TIMEOUT_MS = 120_000;

/** @type {readonly string[]} */
export const QUALITY_SCRIPT_KEYS = ['typecheck', 'lint', 'lint:ci', 'tsc'];

/**
 * @param {string} metaUrl
 * @returns {string}
 */
export function resolveGateProjectRoot(metaUrl) {
  const scriptDir = dirname(fileURLToPath(metaUrl));
  const norm = scriptDir.replace(/\\/g, '/');
  if (norm.endsWith('/.harness/scripts/gates') || norm.endsWith('/.midas/scripts/gates')) {
    return resolve(scriptDir, '..', '..', '..');
  }
  if (norm.endsWith('/scripts/gates')) {
    return resolve(scriptDir, '..', '..');
  }
  return resolve(scriptDir, '..', '..');
}

const DEFAULT_ROOT = resolveGateProjectRoot(import.meta.url);

/**
 * @returns {string}
 */
export function defaultRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * @param {string[]} argv
 * @returns {{ runId: string, base?: string }}
 */
export function parseQualityGateArgs(argv) {
  let runId = null;
  /** @type {string | undefined} */
  let base;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--run' && argv[i + 1]) {
      runId = argv[++i];
      continue;
    }
    if (arg === '--base' && argv[i + 1]) {
      base = argv[++i];
    }
  }
  return { runId: runId ?? defaultRunId(), base };
}

/**
 * @param {Record<string, string> | undefined} packageScripts
 * @returns {string[]}
 */
export function resolveQualityScripts(packageScripts) {
  if (!packageScripts || typeof packageScripts !== 'object') return [];
  return QUALITY_SCRIPT_KEYS.filter((key) => typeof packageScripts[key] === 'string');
}

/**
 * @param {string} projectRoot
 * @returns {Record<string, string> | null}
 */
function readPackageScripts(projectRoot) {
  try {
    const raw = readFileSync(join(projectRoot, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed?.scripts && typeof parsed.scripts === 'object' ? parsed.scripts : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} scriptKey
 * @param {string} projectRoot
 * @param {number} timeoutMs
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
export function runNpmScript(scriptKey, projectRoot, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmBin, ['run', scriptKey], {
    cwd: projectRoot,
    shell: false,
    timeout: timeoutMs,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * @typedef {{
 *   projectRoot?: string,
 *   runId?: string,
 *   base?: string,
 *   timeoutMs?: number,
 *   runScript?: typeof runNpmScript,
 *   readScripts?: (root: string) => Record<string, string> | null,
 *   listPaths?: typeof listChangedPaths,
 * }} QualityGateOptions
 */

/**
 * @param {QualityGateOptions} [opts]
 * @returns {import('../lib/gate-result.mjs').GateResult}
 */
export function runQualityGate(opts = {}) {
  const startedAt = new Date();
  const projectRoot = opts.projectRoot ?? DEFAULT_ROOT;
  const runId = opts.runId ?? defaultRunId();
  const listPaths = opts.listPaths ?? listChangedPaths;
  const readScripts = opts.readScripts ?? readPackageScripts;
  const runScript = opts.runScript ?? runNpmScript;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const changedPaths = listPaths(projectRoot, { base: opts.base });
  const productionPaths = hasProductionPaths(changedPaths);

  const baseFields = {
    gate: /** @type {'quality'} */ ('quality'),
    production_paths: productionPaths,
    changed_paths: changedPaths,
    started_at: startedAt.toISOString(),
  };

  if (!productionPaths) {
    const finishedAt = new Date();
    const result = makeResult({
      ...baseFields,
      status: 'skipped',
      reason: 'no-production-paths',
      command: null,
      exit_code: null,
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      summary: 'skipped: no production paths in diff',
    });
    writeGateResult(projectRoot, runId, result);
    return result;
  }

  const packageScripts = readScripts(projectRoot);
  const scriptKeys = resolveQualityScripts(packageScripts ?? undefined);

  if (scriptKeys.length === 0) {
    const finishedAt = new Date();
    const result = makeResult({
      ...baseFields,
      status: 'blocked',
      reason: 'no-quality-scripts',
      command: null,
      exit_code: null,
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      summary: 'blocked: no lint/typecheck scripts in package.json',
    });
    writeGateResult(projectRoot, runId, result);
    return result;
  }

  const commands = scriptKeys.map((key) => `npm run ${key}`);
  /** @type {number | null} */
  let exitCode = 0;
  /** @type {string | null} */
  let failedCommand = null;

  for (const key of scriptKeys) {
    const { exitCode: code } = runScript(key, projectRoot, timeoutMs);
    if (code !== 0) {
      exitCode = code;
      if (!failedCommand) failedCommand = `npm run ${key}`;
    }
  }

  const finishedAt = new Date();
  const status = failedCommand ? 'fail' : 'pass';
  const result = makeResult({
    ...baseFields,
    status,
    reason: failedCommand ? `command failed: ${failedCommand}` : null,
    command: failedCommand ?? commands.join('; '),
    exit_code: failedCommand ? exitCode : 0,
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    summary: failedCommand
      ? `fail: ${failedCommand} (exit ${exitCode})`
      : `pass: ${commands.join('; ')}`,
  });
  writeGateResult(projectRoot, runId, result);
  return result;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { runId, base } = parseQualityGateArgs(process.argv);
  const result = runQualityGate({ runId, base });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.status === 'fail' || result.status === 'blocked' ? 1 : 0);
}
