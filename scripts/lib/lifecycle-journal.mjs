// lifecycle-journal.mjs — append-only lifecycle observability JSONL (ADR-012 P2; F-039 sibling, not Trace).
//
// Intended call sites (skills may wire one-liners later):
//   /start-sprint, /close-sprint, /midas-explore, /midas-verify, /midas-progress (session_note)

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { resolvePaths } from '../paths.mjs';

/** @typedef {'start_sprint' | 'close_sprint' | 'explore_start' | 'explore_end' | 'verify' | 'session_note'} LifecycleEventName */

/** @typedef {{
 *   schema_version: 1,
 *   ts: string,
 *   event: LifecycleEventName,
 *   detail?: string,
 *   pid: number,
 * }} LifecycleJournalEntry */

export const LIFECYCLE_JOURNAL_SCHEMA_VERSION = 1;

/** @type {readonly LifecycleEventName[]} */
export const VALID_LIFECYCLE_EVENTS = Object.freeze([
  'start_sprint',
  'close_sprint',
  'explore_start',
  'explore_end',
  'verify',
  'session_note',
]);

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
export function resolveLifecycleJournalPath(projectRoot) {
  if (useHarnessCache(projectRoot)) {
    return join(projectRoot, '.harness', 'cache', 'metrics', 'lifecycle.jsonl');
  }
  return join(projectRoot, 'runs', 'cache', 'metrics', 'lifecycle.jsonl');
}

/**
 * @param {unknown} value
 * @returns {value is LifecycleJournalEntry}
 */
export function validateLifecycleJournalEntry(value) {
  if (!value || typeof value !== 'object') return false;
  const r = /** @type {Record<string, unknown>} */ (value);
  if (r.schema_version !== LIFECYCLE_JOURNAL_SCHEMA_VERSION) return false;
  if (typeof r.ts !== 'string' || Number.isNaN(Date.parse(r.ts))) return false;
  if (
    typeof r.event !== 'string' ||
    !VALID_LIFECYCLE_EVENTS.includes(/** @type {LifecycleEventName} */ (r.event))
  ) {
    return false;
  }
  if (r.detail !== undefined && typeof r.detail !== 'string') return false;
  if (typeof r.pid !== 'number' || !Number.isFinite(r.pid)) return false;
  return true;
}

/**
 * @param {string} event
 * @returns {boolean}
 */
export function isValidLifecycleEvent(event) {
  return VALID_LIFECYCLE_EVENTS.includes(/** @type {LifecycleEventName} */ (event));
}

/**
 * Append one lifecycle journal line. Fail-open: returns false on invalid input or I/O errors.
 *
 * @param {string} projectRoot
 * @param {{ event: string, detail?: string }} input
 * @returns {boolean}
 */
export function appendLifecycleEvent(projectRoot, input) {
  const event = input?.event;
  if (typeof event !== 'string' || !isValidLifecycleEvent(event)) {
    return false;
  }

  const detail = input.detail;
  if (detail !== undefined && typeof detail !== 'string') {
    return false;
  }

  /** @type {LifecycleJournalEntry} */
  const entry = {
    schema_version: LIFECYCLE_JOURNAL_SCHEMA_VERSION,
    ts: new Date().toISOString(),
    event: /** @type {LifecycleEventName} */ (event),
    pid: process.pid,
  };
  if (typeof detail === 'string') {
    entry.detail = detail;
  }

  if (!validateLifecycleJournalEntry(entry)) {
    return false;
  }

  const path = resolveLifecycleJournalPath(projectRoot);
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}
