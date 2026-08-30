// recall-fifo.mjs — session-scoped FIFO tracker for /midas-recall injected paths (F-033 / ADR-012 P3).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { resolveCacheRoot } from './cache-paths.mjs';

export const FIFO_SCHEMA_VERSION = 1;
export const FIFO_INJECTED_CAP = 50;

/** @typedef {{ schema_version: 1, injected: string[] }} RecallFifoState */

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function resolveFifoPath(projectRoot) {
  return join(resolveCacheRoot(projectRoot), 'session', 'recall-fifo.json');
}

/**
 * @returns {RecallFifoState}
 */
export function emptyFifoState() {
  return { schema_version: FIFO_SCHEMA_VERSION, injected: [] };
}

/**
 * @param {unknown} value
 * @returns {value is RecallFifoState}
 */
export function validateFifoState(value) {
  if (!value || typeof value !== 'object') return false;
  const s = /** @type {Record<string, unknown>} */ (value);
  if (s.schema_version !== FIFO_SCHEMA_VERSION) return false;
  if (!Array.isArray(s.injected)) return false;
  return s.injected.every((p) => typeof p === 'string');
}

/**
 * @param {string[]} injected
 * @returns {string[]}
 */
function capInjected(injected) {
  if (!Array.isArray(injected)) return [];
  if (injected.length <= FIFO_INJECTED_CAP) return injected;
  return injected.slice(injected.length - FIFO_INJECTED_CAP);
}

/**
 * @param {string} projectRoot
 * @returns {RecallFifoState}
 */
export function readFifo(projectRoot) {
  const path = resolveFifoPath(projectRoot);
  if (!existsSync(path)) return emptyFifoState();
  try {
    const raw = readFileSync(path, 'utf8').trim();
    if (!raw) return emptyFifoState();
    const parsed = JSON.parse(raw);
    if (!validateFifoState(parsed)) return emptyFifoState();
    return parsed;
  } catch {
    return emptyFifoState();
  }
}

/**
 * @param {string} projectRoot
 * @param {RecallFifoState} state
 * @returns {RecallFifoState | null}
 */
export function writeFifo(projectRoot, state) {
  if (!validateFifoState(state)) return null;
  const normalized = {
    schema_version: FIFO_SCHEMA_VERSION,
    injected: capInjected(state.injected),
  };
  const path = resolveFifoPath(projectRoot);
  try {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `${JSON.stringify(normalized)}\n`, 'utf8');
    return normalized;
  } catch {
    return null;
  }
}

/**
 * @param {string} projectRoot
 * @param {string[]} paths
 * @returns {RecallFifoState}
 */
export function markInjected(projectRoot, paths) {
  if (!Array.isArray(paths) || paths.length === 0) return readFifo(projectRoot);
  const state = readFifo(projectRoot);
  const injected = [...state.injected];
  for (const raw of paths) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const p = raw.trim();
    if (!injected.includes(p)) injected.push(p);
  }
  const written = writeFifo(projectRoot, {
    schema_version: FIFO_SCHEMA_VERSION,
    injected,
  });
  return written ?? {
    schema_version: FIFO_SCHEMA_VERSION,
    injected: capInjected(injected),
  };
}

/**
 * Return paths not yet injected this session (up to max), then mark them.
 *
 * @param {string} projectRoot
 * @param {string[]} paths
 * @param {{ max?: number }} [options]
 * @returns {string[]}
 */
export function filterUnseen(projectRoot, paths, { max = 5 } = {}) {
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : 5;
  if (!Array.isArray(paths)) return [];
  const state = readFifo(projectRoot);
  const seen = new Set(state.injected);
  const unseen = [];
  for (const raw of paths) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const p = raw.trim();
    if (seen.has(p)) continue;
    unseen.push(p);
    if (unseen.length >= cap) break;
  }
  if (unseen.length > 0) markInjected(projectRoot, unseen);
  return unseen;
}
