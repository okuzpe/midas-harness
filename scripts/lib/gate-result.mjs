// gate-result.mjs — shared gate receipt schema + persistence (ADR-012).

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { resolvePaths } from '../paths.mjs';

/** @typedef {'test' | 'quality' | 'security'} GateKind */
/** @typedef {'pass' | 'fail' | 'skipped' | 'blocked'} GateStatus */

/** @typedef {{
 *   schema_version: 1,
 *   gate: GateKind,
 *   status: GateStatus,
 *   reason: string | null,
 *   command: string | null,
 *   exit_code: number | null,
 *   started_at: string,
 *   finished_at: string,
 *   duration_ms: number,
 *   production_paths: boolean,
 *   changed_paths: string[],
 *   summary: string,
 * }} GateResult */

export const GATE_RESULT_SCHEMA_VERSION = 1;

/** @type {readonly GateKind[]} */
/** `security` is schema-reserved for a future scanner gate; `/midas-diff-gates` runs test+quality only. */
export const VALID_GATES = Object.freeze(['test', 'quality', 'security']);

/** @type {readonly GateStatus[]} */
export const VALID_STATUSES = Object.freeze(['pass', 'fail', 'skipped', 'blocked']);

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
function useHarnessCache(projectRoot) {
  if (existsSync(join(projectRoot, '.harness'))) return true;
  try {
    return resolvePaths(projectRoot).layout === 'harness';
  } catch {
    return false;
  }
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function resolveCacheRoot(projectRoot) {
  if (useHarnessCache(projectRoot)) {
    return join(projectRoot, '.harness', 'cache');
  }
  return join(projectRoot, 'runs', 'cache');
}

/**
 * @param {string} projectRoot
 * @param {string} runId
 * @returns {string}
 */
export function listGateRunDir(projectRoot, runId) {
  return join(resolveCacheRoot(projectRoot), 'gates', runId);
}

/**
 * @param {unknown} value
 * @returns {value is GateResult}
 */
export function validateGateResult(value) {
  if (!value || typeof value !== 'object') return false;
  const r = /** @type {Record<string, unknown>} */ (value);
  if (r.schema_version !== GATE_RESULT_SCHEMA_VERSION) return false;
  if (typeof r.gate !== 'string' || !VALID_GATES.includes(/** @type {GateKind} */ (r.gate))) {
    return false;
  }
  if (typeof r.status !== 'string' || !VALID_STATUSES.includes(/** @type {GateStatus} */ (r.status))) {
    return false;
  }
  if (!(r.reason === null || typeof r.reason === 'string')) return false;
  if (!(r.command === null || typeof r.command === 'string')) return false;
  if (!(r.exit_code === null || (typeof r.exit_code === 'number' && Number.isFinite(r.exit_code)))) {
    return false;
  }
  if (typeof r.started_at !== 'string' || Number.isNaN(Date.parse(r.started_at))) return false;
  if (typeof r.finished_at !== 'string' || Number.isNaN(Date.parse(r.finished_at))) return false;
  if (typeof r.duration_ms !== 'number' || !Number.isFinite(r.duration_ms) || r.duration_ms < 0) {
    return false;
  }
  if (typeof r.production_paths !== 'boolean') return false;
  if (!Array.isArray(r.changed_paths) || !r.changed_paths.every((p) => typeof p === 'string')) {
    return false;
  }
  if (typeof r.summary !== 'string') return false;
  return true;
}

/**
 * @param {Partial<GateResult> & { gate: GateKind, status: GateStatus }} partial
 * @returns {GateResult}
 */
export function makeResult(partial) {
  const now = new Date().toISOString();
  const started_at = typeof partial.started_at === 'string' ? partial.started_at : now;
  const finished_at = typeof partial.finished_at === 'string' ? partial.finished_at : now;
  const startedMs = Date.parse(started_at);
  const finishedMs = Date.parse(finished_at);
  const duration_ms =
    typeof partial.duration_ms === 'number' && Number.isFinite(partial.duration_ms)
      ? partial.duration_ms
      : Number.isFinite(startedMs) && Number.isFinite(finishedMs)
        ? Math.max(0, finishedMs - startedMs)
        : 0;

  const result = {
    schema_version: GATE_RESULT_SCHEMA_VERSION,
    gate: partial.gate,
    status: partial.status,
    reason: partial.reason === undefined ? null : partial.reason,
    command: partial.command === undefined ? null : partial.command,
    exit_code: partial.exit_code === undefined ? null : partial.exit_code,
    started_at,
    finished_at,
    duration_ms,
    production_paths: typeof partial.production_paths === 'boolean' ? partial.production_paths : false,
    changed_paths: Array.isArray(partial.changed_paths) ? [...partial.changed_paths] : [],
    summary: typeof partial.summary === 'string' ? partial.summary : '',
  };

  if (!validateGateResult(result)) {
    throw new Error('Invalid gate result');
  }
  return result;
}

/**
 * @param {unknown} result
 * @returns {boolean}
 */
export function isPassingReceipt(result) {
  if (!validateGateResult(result)) return false;
  if (result.status === 'pass') return true;
  if (result.status === 'skipped' && typeof result.reason === 'string' && result.reason.trim()) {
    return true;
  }
  return false;
}

/**
 * @param {string} projectRoot
 * @param {string} runId
 * @param {GateResult} result
 * @returns {GateResult}
 */
export function writeGateResult(projectRoot, runId, result) {
  if (!validateGateResult(result)) {
    throw new Error('Invalid gate result');
  }
  const dir = listGateRunDir(projectRoot, runId);
  mkdirSync(dir, { recursive: true });
  const gatePath = join(dir, `${result.gate}.json`);
  writeFileSync(gatePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  const aggregatePath = join(dir, 'result.json');
  /** @type {Record<string, GateResult>} */
  let gates = {};
  if (existsSync(aggregatePath)) {
    try {
      const prev = JSON.parse(readFileSync(aggregatePath, 'utf8'));
      if (prev && typeof prev === 'object' && prev.gates && typeof prev.gates === 'object') {
        gates = { ...prev.gates };
      }
    } catch {
      gates = {};
    }
  }
  gates[result.gate] = result;
  const passing = Object.values(gates).every((g) => isPassingReceipt(g));
  const aggregate = {
    schema_version: 1,
    run_id: runId,
    updated_at: new Date().toISOString(),
    gates,
    passing,
  };
  writeFileSync(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`, 'utf8');
  return result;
}

/**
 * @param {string} projectRoot
 * @param {string} runId
 * @param {string} gate
 * @returns {GateResult | null}
 */
export function readGateResult(projectRoot, runId, gate) {
  const path = join(listGateRunDir(projectRoot, runId), `${gate}.json`);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return validateGateResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
export function normalizeChangedPaths(paths) {
  return [...new Set(paths.map((p) => String(p).replace(/\\/g, '/').trim()).filter(Boolean))].sort();
}

/**
 * True when both receipts pass and their changed_paths match the current diff exactly.
 * @param {GateResult | null} testReceipt
 * @param {GateResult | null} qualityReceipt
 * @param {string[]} currentPaths
 * @returns {boolean}
 */
export function receiptsMatchDiff(testReceipt, qualityReceipt, currentPaths) {
  if (!isPassingReceipt(testReceipt) || !isPassingReceipt(qualityReceipt)) return false;
  const current = normalizeChangedPaths(currentPaths);
  const testPaths = normalizeChangedPaths(testReceipt.changed_paths);
  const qualityPaths = normalizeChangedPaths(qualityReceipt.changed_paths);
  const key = JSON.stringify(current);
  return JSON.stringify(testPaths) === key && JSON.stringify(qualityPaths) === key;
}

/**
 * Find a gate run whose passing receipts cover the current changed-path set.
 * @param {string} projectRoot
 * @param {string[]} currentPaths
 * @returns {{ runId: string, test: GateResult, quality: GateResult } | null}
 */
export function findPassingGateRunForDiff(projectRoot, currentPaths) {
  const gatesRoot = join(resolveCacheRoot(projectRoot), 'gates');
  if (!existsSync(gatesRoot)) return null;
  for (const runId of readdirSync(gatesRoot)) {
    if (runId.startsWith('_')) continue;
    const testR = readGateResult(projectRoot, runId, 'test');
    const qualityR = readGateResult(projectRoot, runId, 'quality');
    if (receiptsMatchDiff(testR, qualityR, currentPaths)) {
      return { runId, test: testR, quality: qualityR };
    }
  }
  return null;
}
