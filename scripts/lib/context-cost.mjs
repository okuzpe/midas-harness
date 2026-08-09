// context-cost.mjs — sessionStart context budget metrics (ADR-012 P2 / F-039).

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePaths } from '../paths.mjs';

export const CONTEXT_COST_SCHEMA_VERSION = 1;

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
function useHarnessCache(projectRoot) {
  if (existsSync(join(projectRoot, '.harness'))) return true;
  const layout = resolvePaths(projectRoot).layout;
  return layout === 'harness';
}

/**
 * Engine repo → `runs/cache/metrics/`; install → `.harness/cache/metrics/`.
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
 * @returns {string}
 */
export function resolveContextCostPath(projectRoot) {
  return join(resolveCacheRoot(projectRoot), 'metrics', 'context-cost.jsonl');
}

/**
 * Rough token estimate (~4 characters per token for English prose).
 * @param {string} text
 * @returns {number}
 */
export function estimateApproxTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * @param {number} charCount
 * @returns {number}
 */
function approxTokensFromChars(charCount) {
  if (!charCount || charCount < 0) return 0;
  return Math.ceil(charCount / 4);
}

/**
 * @param {{
 *   projectRoot: string,
 *   agentsChars: number,
 *   carryoverChars: number,
 *   stateChars: number,
 *   pathsSampled?: string[],
 * }} input
 * @returns {{
 *   schema_version: 1,
 *   ts: string,
 *   event: 'sessionStart',
 *   approx_tokens: { agents: number, carryover: number, state: number, total: number },
 *   paths_sampled: string[],
 * }}
 */
export function buildSessionStartCostRecord({
  projectRoot,
  agentsChars,
  carryoverChars,
  stateChars,
  pathsSampled = [],
}) {
  void projectRoot;
  const agents = approxTokensFromChars(agentsChars);
  const carryover = approxTokensFromChars(carryoverChars);
  const state = approxTokensFromChars(stateChars);
  return {
    schema_version: CONTEXT_COST_SCHEMA_VERSION,
    ts: new Date().toISOString(),
    event: 'sessionStart',
    approx_tokens: {
      agents,
      carryover,
      state,
      total: agents + carryover + state,
    },
    paths_sampled: pathsSampled,
  };
}

/**
 * Append one NDJSON metrics line. Never throws — returns false on I/O failure.
 * @param {string} projectRoot
 * @param {Record<string, unknown>} record
 * @returns {boolean}
 */
export function appendContextCost(projectRoot, record) {
  try {
    const path = resolveContextCostPath(projectRoot);
    mkdirSync(join(path, '..'), { recursive: true });
    appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}
