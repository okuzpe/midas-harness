#!/usr/bin/env node
// trace-write.mjs — CLI emitter for Harness Trace V1 (ADR-010).
// Usage: node scripts/trace-write.mjs <start-run|finish|event|span-start|span-end|snapshot|artifact> [json-attrs]
// Fail-open: unknown/invalid commands exit 0 with a one-line stderr note (hooks must not break).

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEnvelope, createId } from './lib/trace-models.mjs';
import {
  resolveTracesRoot,
  ensureSession,
  ensureRun,
  startRun,
  finishRun,
  appendEnvelope,
  readCurrent,
  digestStateYaml,
} from './lib/trace-store.mjs';
import { detectLayout, resolvePaths, resolveProjectRootFromScript } from './paths.mjs';

const DEFAULT_ROOT = resolveProjectRootFromScript(import.meta.url);

/**
 * @param {string[]} argv
 * @param {{ projectRoot?: string, tracesRoot?: string, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} [opts]
 * @returns {number} exit code (always 0 for fail-open when used from hooks; CLI uses same)
 */
export function runTraceWrite(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;
  const stderr = opts.stderr || process.stderr;
  const projectRoot = opts.projectRoot || process.env.MIDAS_TRACE_ROOT || DEFAULT_ROOT;
  const tracesRoot = opts.tracesRoot || resolveTracesRoot(projectRoot);

  try {
    const cmd = argv[0] || '';
    const attrs = parseAttrs(argv.slice(1));

    if (cmd === 'start-run') {
      const r = startRun(tracesRoot, { attrs });
      stdout.write(`${JSON.stringify(r)}\n`);
      return 0;
    }

    if (cmd === 'finish') {
      const r = finishRun(tracesRoot, attrs);
      stdout.write(`${JSON.stringify(r || { ok: false, reason: 'no-active-run' })}\n`);
      return 0;
    }

    if (cmd === 'ensure-session') {
      const session_id = ensureSession(tracesRoot, typeof attrs.session_id === 'string' ? attrs.session_id : undefined);
      stdout.write(`${JSON.stringify({ session_id })}\n`);
      return 0;
    }

    if (cmd === 'event' || cmd === 'span-start' || cmd === 'span-end' || cmd === 'snapshot' || cmd === 'artifact') {
      const { session_id, run_id } = ensureRun(tracesRoot);
      let type = 'event';
      let name = typeof attrs.name === 'string' ? attrs.name : '';
      /** @type {Record<string, unknown>} */
      let body = { ...attrs };
      delete body.name;

      if (cmd === 'span-start') {
        type = 'span.started';
        if (!name) name = 'span';
        if (!body.span_id) body.span_id = createId('sp-');
      } else if (cmd === 'span-end') {
        type = 'span.finished';
        if (!name) name = 'span';
      } else if (cmd === 'snapshot') {
        type = 'state.snapshot';
        name = name || 'state';
        Object.assign(body, loadStateDigest(projectRoot));
      } else if (cmd === 'artifact') {
        type = 'artifact';
        if (!name && typeof body.path === 'string') name = String(body.path);
      } else {
        type = 'event';
        if (!name) name = typeof body.kind === 'string' ? String(body.kind) : 'event';
      }

      const env = makeEnvelope({ session_id, run_id, type, name, attrs: body });
      const res = appendEnvelope(tracesRoot, env);
      if (!res.ok) {
        stderr.write(`trace-write: ${res.error}\n`);
        return 0;
      }
      stdout.write(`${JSON.stringify({ ok: true, type, name, session_id, run_id })}\n`);
      return 0;
    }

    if (!cmd) {
      stderr.write(
        'usage: trace-write <start-run|finish|ensure-session|event|span-start|span-end|snapshot|artifact> [json]\n',
      );
      return 0;
    }

    stderr.write(`trace-write: unknown command ${cmd}\n`);
    return 0;
  } catch (err) {
    stderr.write(`trace-write: ${err instanceof Error ? err.message : String(err)}\n`);
    return 0;
  }
}

/**
 * @param {string[]} parts
 * @returns {Record<string, unknown>}
 */
function parseAttrs(parts) {
  if (!parts.length) return {};
  const raw = parts.join(' ').trim();
  if (!raw) return {};
  if (raw.startsWith('{')) {
    try {
      const j = JSON.parse(raw);
      return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
    } catch {
      return { note: raw.slice(0, 200) };
    }
  }
  // key=value pairs
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const part of parts) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

/**
 * @param {string} projectRoot
 * @returns {Record<string, unknown>}
 */
function loadStateDigest(projectRoot) {
  try {
    const layout = detectLayout(projectRoot);
    const paths = resolvePaths(layout, projectRoot);
    const statePath = join(projectRoot, paths.state);
    if (!existsSync(statePath)) return { state: 'missing' };
    return digestStateYaml(readFileSync(statePath, 'utf8'));
  } catch {
    return { state: 'error' };
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const code = runTraceWrite(process.argv.slice(2));
  process.exit(code);
}
