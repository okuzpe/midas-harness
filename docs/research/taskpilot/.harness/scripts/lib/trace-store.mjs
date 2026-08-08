// trace-store.mjs — JSONL + current.json under .harness/cache/traces (ADR-010).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { createId, makeEnvelope, validateEnvelope } from './trace-models.mjs';

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function resolveTracesRoot(projectRoot) {
  return join(projectRoot, '.harness', 'cache', 'traces');
}

/**
 * @param {string} tracesRoot
 * @returns {{ session_id: string, run_id?: string | null, started_at?: string }}
 */
export function readCurrent(tracesRoot) {
  const p = join(tracesRoot, 'current.json');
  if (!existsSync(p)) return { session_id: '', run_id: null };
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return {
      session_id: typeof j.session_id === 'string' ? j.session_id : '',
      run_id: typeof j.run_id === 'string' ? j.run_id : null,
      started_at: typeof j.started_at === 'string' ? j.started_at : undefined,
    };
  } catch {
    return { session_id: '', run_id: null };
  }
}

/**
 * @param {string} tracesRoot
 * @param {{ session_id: string, run_id?: string | null, started_at?: string }} cur
 */
export function writeCurrent(tracesRoot, cur) {
  mkdirSync(tracesRoot, { recursive: true });
  writeFileSync(
    join(tracesRoot, 'current.json'),
    `${JSON.stringify({
      session_id: cur.session_id,
      run_id: cur.run_id || null,
      started_at: cur.started_at || null,
    }, null, 2)}\n`,
    'utf8',
  );
}

/**
 * @param {string} tracesRoot
 * @param {string} [sessionId]
 * @returns {string}
 */
export function ensureSession(tracesRoot, sessionId) {
  const cur = readCurrent(tracesRoot);
  if (sessionId && sessionId !== cur.session_id) {
    if (cur.run_id) finishRun(tracesRoot, { source: 'session-switch' });
    writeCurrent(tracesRoot, {
      session_id: sessionId,
      run_id: null,
      started_at: new Date().toISOString(),
    });
    return sessionId;
  }
  if (cur.session_id) return cur.session_id;
  const id = createId();
  writeCurrent(tracesRoot, { session_id: id, run_id: null, started_at: new Date().toISOString() });
  return id;
}

/**
 * @param {string} tracesRoot
 * @param {string} sessionId
 * @param {string} runId
 * @returns {string}
 */
export function runFilePath(tracesRoot, sessionId, runId) {
  return join(tracesRoot, `session-${sessionId}`, `run-${runId}.jsonl`);
}

/**
 * @param {string} tracesRoot
 * @param {{ run_id?: string, attrs?: Record<string, unknown> }} [opts]
 * @returns {{ session_id: string, run_id: string }}
 */
export function startRun(tracesRoot, opts = {}) {
  const session_id = ensureSession(tracesRoot);
  const cur = readCurrent(tracesRoot);
  if (cur.run_id && !opts.run_id) {
    return { session_id, run_id: cur.run_id };
  }
  const run_id = opts.run_id || createId();
  const started_at = new Date().toISOString();
  writeCurrent(tracesRoot, { session_id, run_id, started_at });
  appendEnvelope(
    tracesRoot,
    makeEnvelope({
      session_id,
      run_id,
      type: 'run.started',
      name: '',
      attrs: opts.attrs || {},
      ts: started_at,
    }),
  );
  return { session_id, run_id };
}

/**
 * Open a run if none active (for hooks).
 * @param {string} tracesRoot
 * @returns {{ session_id: string, run_id: string }}
 */
export function ensureRun(tracesRoot) {
  ensureSession(tracesRoot);
  const cur = readCurrent(tracesRoot);
  if (cur.session_id && cur.run_id) return { session_id: cur.session_id, run_id: cur.run_id };
  return startRun(tracesRoot);
}

/**
 * @param {string} tracesRoot
 * @param {Record<string, unknown>} [attrs]
 * @returns {{ session_id: string, run_id: string } | null}
 */
export function finishRun(tracesRoot, attrs = {}) {
  const cur = readCurrent(tracesRoot);
  if (!cur.session_id || !cur.run_id) return null;
  const { session_id, run_id } = cur;
  appendEnvelope(
    tracesRoot,
    makeEnvelope({
      session_id,
      run_id,
      type: 'run.finished',
      name: '',
      attrs,
    }),
  );
  writeCurrent(tracesRoot, { session_id, run_id: null, started_at: cur.started_at });
  return { session_id, run_id };
}

/**
 * @param {string} tracesRoot
 * @param {import('./trace-models.mjs').TraceEnvelope} envelope
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function appendEnvelope(tracesRoot, envelope) {
  const checked = validateEnvelope(envelope);
  if (!checked.ok) return checked;
  const file = runFilePath(tracesRoot, checked.envelope.session_id, checked.envelope.run_id);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(checked.envelope)}\n`, 'utf8');
  return { ok: true };
}

/**
 * Skip invalid lines; never throw on corrupt trailing data.
 * @param {string} tracesRoot
 * @param {string} runId — with or without `run-` prefix
 * @returns {{ session_id: string, run_id: string, path: string, events: import('./trace-models.mjs').TraceEnvelope[] } | null}
 */
export function readRun(tracesRoot, runId) {
  const bare = String(runId || '').replace(/^run-/, '');
  if (!bare || !existsSync(tracesRoot)) return null;
  for (const ent of readdirSync(tracesRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || !ent.name.startsWith('session-')) continue;
    const session_id = ent.name.slice('session-'.length);
    const path = join(tracesRoot, ent.name, `run-${bare}.jsonl`);
    if (!existsSync(path)) continue;
    /** @type {import('./trace-models.mjs').TraceEnvelope[]} */
    const events = [];
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const v = validateEnvelope(JSON.parse(line));
        if (v.ok) events.push(v.envelope);
      } catch {
        // skip corrupt line
      }
    }
    return { session_id, run_id: bare, path, events };
  }
  return null;
}

/**
 * @param {string} tracesRoot
 * @returns {{ session_id: string, run_id: string, path: string, mtimeMs: number }[]}
 */
export function listRuns(tracesRoot) {
  /** @type {{ session_id: string, run_id: string, path: string, mtimeMs: number }[]} */
  const out = [];
  if (!existsSync(tracesRoot)) return out;
  for (const ent of readdirSync(tracesRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || !ent.name.startsWith('session-')) continue;
    const session_id = ent.name.slice('session-'.length);
    const dir = join(tracesRoot, ent.name);
    for (const f of readdirSync(dir)) {
      if (!f.startsWith('run-') || !f.endsWith('.jsonl')) continue;
      const run_id = f.slice('run-'.length, -'.jsonl'.length);
      const path = join(dir, f);
      out.push({ session_id, run_id, path, mtimeMs: statSync(path).mtimeMs });
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

/**
 * Digest subset of state.yaml text.
 * @param {string} yaml
 * @returns {Record<string, unknown>}
 */
export function digestStateYaml(yaml) {
  const stage = yaml.match(/^stage:\s*(.+)$/m)?.[1]?.trim() || null;
  const stage_status = yaml.match(/^stage_status:\s*(.+)$/m)?.[1]?.trim() || null;
  let active_sprint = null;
  const lines = yaml.split(/\r?\n/);
  let inSprints = false;
  let current = /** @type {Record<string, string>} */ ({});
  for (const line of lines) {
    if (/^sprints:\s*$/.test(line)) {
      inSprints = true;
      continue;
    }
    if (inSprints && /^\S/.test(line) && !/^\s/.test(line)) break;
    if (!inSprints) continue;
    const idM = line.match(/^\s+-\s+id:\s*["']?([^"'\s]+)/);
    if (idM) {
      if (current.status === 'active') active_sprint = current.id;
      current = { id: idM[1] };
      continue;
    }
    const stM = line.match(/^\s+status:\s*(\S+)/);
    if (stM && current.id) current.status = stM[1].replace(/["']/g, '');
  }
  if (current.status === 'active') active_sprint = current.id;
  return { stage, stage_status, active_sprint };
}
