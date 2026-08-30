// quality-log.mjs — optional quality event JSONL (ADR-012 P2 / F-040 INSPIRE).

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { resolveCacheRoot } from './cache-paths.mjs';

/** @typedef {'gate' | 'audit' | 'verify' | 'doctor'} QualityKind */
/** @typedef {'pass' | 'fail' | 'warn' | 'skip'} QualityStatus */

/** @typedef {{
 *   schema_version: 1,
 *   ts: string,
 *   kind: QualityKind,
 *   status: QualityStatus,
 *   pid: number,
 *   detail?: string | Record<string, unknown>,
 * }} QualityLogEntry */

export const QUALITY_LOG_SCHEMA_VERSION = 1;

/** @type {readonly QualityKind[]} */
export const VALID_KINDS = Object.freeze(['gate', 'audit', 'verify', 'doctor']);

/** @type {readonly QualityStatus[]} */
export const VALID_STATUSES = Object.freeze(['pass', 'fail', 'warn', 'skip']);

/** @type {readonly string[]} */
export const FORBIDDEN_DETAIL_KEYS = Object.freeze([
  'password',
  'token',
  'secret',
  'api_key',
  'authorization',
]);

/** @type {ReadonlySet<string>} */
const FORBIDDEN_KEY_SET = new Set(FORBIDDEN_DETAIL_KEYS);

/**
 * @param {string} key
 * @returns {boolean}
 */
function isForbiddenDetailKey(key) {
  const norm = String(key).toLowerCase().replace(/-/g, '_');
  return FORBIDDEN_KEY_SET.has(norm);
}

/**
 * Engine repo → `runs/cache/metrics/quality-log.jsonl`;
 * install → `.harness/cache/metrics/quality-log.jsonl`.
 * @param {string} projectRoot
 * @returns {string}
 */
export function resolveQualityLogPath(projectRoot) {
  return join(resolveCacheRoot(projectRoot), 'metrics', 'quality-log.jsonl');
}

/**
 * Strip forbidden keys from detail objects (recursive for nested dicts).
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeDetail(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 500 ? value.slice(0, 500) : value;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  /** @type {Record<string, unknown>} */
  const clean = {};
  for (const [key, nested] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
    if (isForbiddenDetailKey(key)) continue;
    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      const child = sanitizeDetail(nested);
      if (child !== undefined && typeof child === 'object' && Object.keys(child).length > 0) {
        clean[key] = child;
      }
      continue;
    }
    if (
      typeof nested === 'string' ||
      typeof nested === 'number' ||
      typeof nested === 'boolean' ||
      nested === null
    ) {
      clean[key] =
        typeof nested === 'string' && nested.length > 500 ? nested.slice(0, 500) : nested;
    }
  }
  return clean;
}

/**
 * @param {string} kind
 * @returns {boolean}
 */
export function isValidQualityKind(kind) {
  return VALID_KINDS.includes(/** @type {QualityKind} */ (kind));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isValidQualityStatus(status) {
  return VALID_STATUSES.includes(/** @type {QualityStatus} */ (status));
}

/**
 * @param {unknown} value
 * @returns {value is QualityLogEntry}
 */
export function validateQualityLogEntry(value) {
  if (!value || typeof value !== 'object') return false;
  const r = /** @type {Record<string, unknown>} */ (value);
  if (r.schema_version !== QUALITY_LOG_SCHEMA_VERSION) return false;
  if (typeof r.ts !== 'string' || Number.isNaN(Date.parse(r.ts))) return false;
  if (!isValidQualityKind(/** @type {string} */ (r.kind))) return false;
  if (!isValidQualityStatus(/** @type {string} */ (r.status))) return false;
  if (typeof r.pid !== 'number' || !Number.isFinite(r.pid)) return false;
  if (r.detail === undefined) return true;
  if (typeof r.detail === 'string') return true;
  if (r.detail && typeof r.detail === 'object' && !Array.isArray(r.detail)) return true;
  return false;
}

/**
 * Append one quality log line. Fail-open: returns false on invalid input or I/O errors.
 *
 * @param {string} projectRoot
 * @param {{ kind: string, status: string, detail?: string | Record<string, unknown> }} input
 * @returns {boolean}
 */
export function appendQualityEvent(projectRoot, input) {
  const kind = input?.kind;
  const status = input?.status;
  if (!isValidQualityKind(kind) || !isValidQualityStatus(status)) {
    return false;
  }

  let detail = input.detail;
  if (detail !== undefined) {
    if (typeof detail === 'string') {
      detail = sanitizeDetail(detail);
    } else if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      detail = sanitizeDetail(detail);
      if (
        detail &&
        typeof detail === 'object' &&
        !Array.isArray(detail) &&
        Object.keys(detail).length === 0
      ) {
        detail = undefined;
      }
    } else {
      return false;
    }
  }

  /** @type {QualityLogEntry} */
  const entry = {
    schema_version: QUALITY_LOG_SCHEMA_VERSION,
    ts: new Date().toISOString(),
    kind: /** @type {QualityKind} */ (kind),
    status: /** @type {QualityStatus} */ (status),
    pid: process.pid,
  };
  if (detail !== undefined) {
    entry.detail = /** @type {string | Record<string, unknown>} */ (detail);
  }

  if (!validateQualityLogEntry(entry)) {
    return false;
  }

  const path = resolveQualityLogPath(projectRoot);
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}
