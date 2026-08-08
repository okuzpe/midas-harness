// trace-models.mjs — envelopes, ids, redaction for Harness Trace V1 (ADR-010).

import { randomBytes } from 'node:crypto';

export const TRACE_TYPES = Object.freeze([
  'run.started',
  'run.finished',
  'span.started',
  'span.finished',
  'event',
  'state.snapshot',
  'artifact',
]);

/** @type {RegExp} */
export const SECRET_RE =
  /(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY|api[_-]?key\s*[:=]\s*['\"]?[^\s'\"]{12,})/i;

/** Keys whose values are bulk payloads — never persist; use redactValue for short fields like `message`. */
const BODY_KEYS = new Set([
  'prompt',
  'result',
  'output',
  'content',
  'body',
  'diff',
  'text',
  'arguments',
  'input',
  'stdout',
  'stderr',
]);

/**
 * @param {string} [prefix]
 * @returns {string}
 */
export function createId(prefix = '') {
  const id = randomBytes(6).toString('hex');
  return prefix ? `${prefix}${id}` : id;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactValue(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (SECRET_RE.test(value)) return '[redacted]';
    if (value.length > 240) return `${value.slice(0, 120)}…[truncated ${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(redactValue);
  if (typeof value === 'object') return redactAttrs(/** @type {Record<string, unknown>} */ (value));
  return value;
}

/**
 * Drop bulky/secret-prone keys; redact remaining string values.
 * @param {Record<string, unknown> | null | undefined} attrs
 * @returns {Record<string, unknown>}
 */
export function redactAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object') return {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, raw] of Object.entries(attrs)) {
    const lower = key.toLowerCase();
    if (BODY_KEYS.has(lower) || lower.endsWith('_result') || lower.endsWith('prompt')) {
      out[key] = '[omitted]';
      continue;
    }
    out[key] = redactValue(raw);
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, envelope: TraceEnvelope } | { ok: false, error: string }}
 */
export function validateEnvelope(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'envelope must be an object' };
  const e = /** @type {Record<string, unknown>} */ (raw);
  if (typeof e.ts !== 'string' || !e.ts) return { ok: false, error: 'ts required' };
  if (typeof e.session_id !== 'string' || !e.session_id) {
    return { ok: false, error: 'session_id required' };
  }
  if (typeof e.run_id !== 'string' || !e.run_id) return { ok: false, error: 'run_id required' };
  if (typeof e.type !== 'string' || !TRACE_TYPES.includes(e.type)) {
    return { ok: false, error: `type must be one of ${TRACE_TYPES.join('|')}` };
  }
  if (e.name != null && typeof e.name !== 'string') return { ok: false, error: 'name must be string' };
  if (e.attrs != null && (typeof e.attrs !== 'object' || Array.isArray(e.attrs))) {
    return { ok: false, error: 'attrs must be object' };
  }
  return {
    ok: true,
    envelope: {
      ts: e.ts,
      session_id: e.session_id,
      run_id: e.run_id,
      type: /** @type {string} */ (e.type),
      name: typeof e.name === 'string' ? e.name : '',
      attrs: redactAttrs(/** @type {Record<string, unknown>} */ (e.attrs || {})),
    },
  };
}

/**
 * @param {{
 *   session_id: string,
 *   run_id: string,
 *   type: string,
 *   name?: string,
 *   attrs?: Record<string, unknown>,
 *   ts?: string,
 * }} partial
 * @returns {TraceEnvelope}
 */
export function makeEnvelope(partial) {
  const checked = validateEnvelope({
    ts: partial.ts || new Date().toISOString(),
    session_id: partial.session_id,
    run_id: partial.run_id,
    type: partial.type,
    name: partial.name || '',
    attrs: partial.attrs || {},
  });
  if (!checked.ok) throw new Error(checked.error);
  return checked.envelope;
}

/**
 * @typedef {{
 *   ts: string,
 *   session_id: string,
 *   run_id: string,
 *   type: string,
 *   name: string,
 *   attrs: Record<string, unknown>,
 * }} TraceEnvelope
 */
