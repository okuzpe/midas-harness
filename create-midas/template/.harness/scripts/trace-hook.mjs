#!/usr/bin/env node
// trace-hook.mjs — Cursor hook adapter → Harness Trace (ADR-010). Fail-open + redaction.

import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createId, makeEnvelope, redactAttrs } from './lib/trace-models.mjs';
import {
  resolveTracesRoot,
  ensureSession,
  ensureRun,
  finishRun,
  appendEnvelope,
  writeCurrent,
  readCurrent,
} from './lib/trace-store.mjs';
import { resolveProjectRootFromScript } from './paths.mjs';

const DEFAULT_ROOT = resolveProjectRootFromScript(import.meta.url);

/**
 * @param {unknown} payload
 * @param {{ projectRoot?: string, tracesRoot?: string, hookEvent?: string }} [opts]
 * @returns {{ permission?: string, ok: boolean }}
 */
export function handleHookPayload(payload, opts = {}) {
  const projectRoot = opts.projectRoot || process.env.MIDAS_TRACE_ROOT || DEFAULT_ROOT;
  const tracesRoot = opts.tracesRoot || resolveTracesRoot(projectRoot);

  try {
    const p =
      payload && typeof payload === 'object'
        ? /** @type {Record<string, unknown>} */ (payload)
        : {};
    const hookEvent = String(
      opts.hookEvent ||
        p.hook_event_name ||
        p.hookEventName ||
        p.event ||
        p.type ||
        '',
    );

    if (hookEvent === 'sessionStart' || hookEvent === 'session_start') {
      const prior = readCurrent(tracesRoot);
      if (prior.run_id) {
        finishRun(tracesRoot, { source: 'hook.sessionStart', reason: 'new-session' });
      }
      const session_id = ensureSession(
        tracesRoot,
        typeof p.session_id === 'string'
          ? p.session_id
          : typeof p.sessionId === 'string'
            ? p.sessionId
            : undefined,
      );
      writeCurrent(tracesRoot, {
        session_id,
        run_id: null,
        started_at: new Date().toISOString(),
      });
      return { ok: true, permission: 'allow' };
    }

    if (hookEvent === 'stop') {
      finishRun(tracesRoot, { source: 'hook.stop' });
      return { ok: true, permission: 'allow' };
    }

    if (
      hookEvent === 'postToolUse' ||
      hookEvent === 'post_tool_use' ||
      hookEvent === 'afterToolUse'
    ) {
      const { session_id, run_id } = ensureRun(tracesRoot);
      const toolName = String(p.tool_name || p.toolName || p.tool || 'Tool');
      const duration_ms =
        typeof p.duration_ms === 'number'
          ? p.duration_ms
          : typeof p.durationMs === 'number'
            ? p.durationMs
            : undefined;
      const attrs = redactAttrs({
        tool: toolName,
        success: p.success !== false && p.error == null,
        duration_ms,
        path: summarizePath(p),
        span_id: createId('sp-'),
        source: 'hook.postToolUse',
      });
      if (duration_ms != null) attrs.duration_ms = duration_ms;
      appendEnvelope(
        tracesRoot,
        makeEnvelope({
          session_id,
          run_id,
          type: 'span.finished',
          name: `tool.${toolName}`,
          attrs,
        }),
      );
      return { ok: true, permission: 'allow' };
    }

    if (hookEvent === 'subagentStop' || hookEvent === 'subagent_stop') {
      const { session_id, run_id } = ensureRun(tracesRoot);
      const sub = String(p.subagent_type || p.subagentType || p.agent_type || p.agentType || 'subagent');
      const duration_ms =
        typeof p.duration_ms === 'number'
          ? p.duration_ms
          : typeof p.durationMs === 'number'
            ? p.durationMs
            : undefined;
      const attrs = redactAttrs({
        subagent: sub,
        duration_ms,
        source: 'hook.subagentStop',
      });
      if (duration_ms != null) attrs.duration_ms = duration_ms;
      appendEnvelope(
        tracesRoot,
        makeEnvelope({
          session_id,
          run_id,
          type: 'span.finished',
          name: `subagent.${sub}`,
          attrs,
        }),
      );
      return { ok: true, permission: 'allow' };
    }

    // Unknown hook — ignore
    return { ok: true, permission: 'allow' };
  } catch {
    return { ok: true, permission: 'allow' };
  }
}

/**
 * @param {Record<string, unknown>} p
 * @returns {string | undefined}
 */
function summarizePath(p) {
  const candidates = [p.path, p.file_path, p.filePath, p.file];
  for (const c of candidates) {
    if (typeof c === 'string' && c) {
      try {
        return basename(c).slice(0, 120);
      } catch {
        return c.slice(0, 120);
      }
    }
  }
  return undefined;
}

/**
 * @param {string} raw
 * @param {{ projectRoot?: string, tracesRoot?: string, hookEvent?: string }} [opts]
 */
export function handleHookStdin(raw, opts = {}) {
  let payload = null;
  try {
    payload = raw.trim() ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
  return handleHookPayload(payload, opts);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const hookEvent = process.argv[2] || '';
    const raw = readFileSync(0, 'utf8');
    const result = handleHookStdin(raw, { hookEvent });
    process.stdout.write(`${JSON.stringify({ permission: result.permission || 'allow' })}\n`);
  } catch {
    process.stdout.write(`${JSON.stringify({ permission: 'allow' })}\n`);
  }
  process.exit(0);
}
