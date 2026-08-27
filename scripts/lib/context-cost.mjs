// context-cost.mjs — sessionStart context budget metrics (ADR-012 P2 / F-039).
// Schema v2: approx_tokens.by_path is a map of sampled relative paths → token estimates.
// Always-on adapters are sampled by the refresh script (not hardcoded here).

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePaths } from '../paths.mjs';

export const CONTEXT_COST_SCHEMA_VERSION = 2;

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
export function approxTokensFromChars(charCount) {
  if (!charCount || charCount < 0) return 0;
  return Math.ceil(charCount / 4);
}

/**
 * @param {{ path: string, chars: number }} sample
 * @returns {string}
 */
function bucketKey(sample) {
  const p = (sample.path || '').replace(/\\/g, '/');
  if (p === 'AGENTS.md' || p.endsWith('/AGENTS.md')) return 'agents';
  if (p.includes('current-carryover.json') || p.includes('carryover')) return 'carryover';
  if (/(^|\/)state\.yaml$/.test(p)) return 'state';
  if (p.includes('.cursor/rules/') || p.includes('.windsurf/rules/') || /(^|\/)GEMINI\.md$/.test(p) || /(^|\/)CLAUDE\.md$/.test(p)) {
    return 'adapters';
  }
  return 'other';
}

/**
 * @param {{
 *   projectRoot: string,
 *   samples?: Array<{ path: string, chars: number }>,
 *   agentsChars?: number,
 *   carryoverChars?: number,
 *   stateChars?: number,
 *   pathsSampled?: string[],
 * }} input
 * @returns {{
 *   schema_version: 2,
 *   ts: string,
 *   event: 'sessionStart',
 *   approx_tokens: {
 *     by_path: Record<string, number>,
 *     by_bucket: Record<string, number>,
 *     total: number,
 *   },
 *   paths_sampled: string[],
 * }}
 */
export function buildSessionStartCostRecord({
  projectRoot,
  samples,
  agentsChars,
  carryoverChars,
  stateChars,
  pathsSampled,
}) {
  void projectRoot;
  /** @type {Array<{ path: string, chars: number }>} */
  let list = Array.isArray(samples) ? samples.filter((s) => s && s.path) : [];
  if (!list.length) {
    const legacy = [
      { path: 'AGENTS.md', chars: agentsChars || 0 },
      { path: 'carryover', chars: carryoverChars || 0 },
      { path: 'state.yaml', chars: stateChars || 0 },
    ].filter((s) => s.chars > 0 || (pathsSampled || []).some((p) => p && p.replace(/\\/g, '/').endsWith(s.path)));
    if (Array.isArray(pathsSampled) && pathsSampled.length) {
      list = pathsSampled.map((p) => {
        const norm = p.replace(/\\/g, '/');
        const hit = [
          { path: 'AGENTS.md', chars: agentsChars || 0 },
          { path: 'carryover', chars: carryoverChars || 0 },
          { path: 'state.yaml', chars: stateChars || 0 },
        ].find((s) => norm === s.path || norm.endsWith(`/${s.path}`) || (s.path === 'carryover' && norm.includes('carryover')) || (s.path === 'state.yaml' && norm.endsWith('state.yaml')));
        return { path: norm, chars: hit ? hit.chars : 0 };
      });
    } else {
      list = legacy;
    }
  }

  /** @type {Record<string, number>} */
  const by_path = {};
  /** @type {Record<string, number>} */
  const by_bucket = {};
  let total = 0;
  const seenPaths = [];
  for (const sample of list) {
    const rel = sample.path.replace(/\\/g, '/');
    const tokens = approxTokensFromChars(sample.chars);
    by_path[rel] = tokens;
    const bucket = bucketKey(sample);
    by_bucket[bucket] = (by_bucket[bucket] || 0) + tokens;
    total += tokens;
    seenPaths.push(rel);
  }

  return {
    schema_version: CONTEXT_COST_SCHEMA_VERSION,
    ts: new Date().toISOString(),
    event: 'sessionStart',
    approx_tokens: {
      by_path,
      by_bucket,
      total,
    },
    paths_sampled: seenPaths,
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
