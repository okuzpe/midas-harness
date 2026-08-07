#!/usr/bin/env node
// trace-inspect.mjs — RUN / TRACE / STATE / PROBLEMS (ADR-010).

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTracesRoot, readRun, listRuns, readCurrent } from './lib/trace-store.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');

export const SPAN_SLOW_MS = 60_000;
export const SPAN_REPEAT_MIN = 3;
export const STAGE_REPEAT_MIN = 3;

/**
 * @param {string[]} argv
 * @param {{ projectRoot?: string, tracesRoot?: string }} [opts]
 * @returns {string}
 */
export function inspectRunMarkdown(argv, opts = {}) {
  const projectRoot = opts.projectRoot || process.env.MIDAS_TRACE_ROOT || DEFAULT_ROOT;
  const tracesRoot = opts.tracesRoot || resolveTracesRoot(projectRoot);
  const runArg = argv[0];

  if (!runArg || runArg === '--list' || runArg === 'list') {
    const runs = listRuns(tracesRoot);
    const cur = readCurrent(tracesRoot);
    const lines = [
      '# Trace runs',
      '',
      `current: session=${cur.session_id || '—'} run=${cur.run_id || '—'}`,
      '',
    ];
    if (!runs.length) {
      lines.push('_No runs under `.harness/cache/traces/`._');
      return lines.join('\n');
    }
    for (const r of runs.slice(0, 30)) {
      lines.push(`- \`${r.run_id}\` (session \`${r.session_id}\`)`);
    }
    return lines.join('\n');
  }

  const run = readRun(tracesRoot, runArg);
  if (!run) {
    return `# Trace inspect\n\nRun \`${runArg}\` not found under \`${tracesRoot}\`.\n`;
  }

  return formatInspect(run);
}

/**
 * @param {{ session_id: string, run_id: string, path: string, events: import('./lib/trace-models.mjs').TraceEnvelope[] }} run
 * @returns {string}
 */
export function formatInspect(run) {
  const { events, session_id, run_id } = run;
  const started = events.find((e) => e.type === 'run.started');
  const finished = events.find((e) => e.type === 'run.finished');
  const spans = events.filter((e) => e.type === 'span.finished' || e.type === 'span.started');
  const finishedSpans = events.filter((e) => e.type === 'span.finished');
  const snapshots = events.filter((e) => e.type === 'state.snapshot');
  const errors = events.filter(
    (e) =>
      e.type === 'event' &&
      (/error/i.test(e.name) || e.attrs?.level === 'error' || e.attrs?.error === true),
  );

  const t0 = started?.ts ? Date.parse(started.ts) : events[0] ? Date.parse(events[0].ts) : NaN;
  const t1 = finished?.ts
    ? Date.parse(finished.ts)
    : events.length
      ? Date.parse(events[events.length - 1].ts)
      : NaN;
  const durationMs = Number.isFinite(t0) && Number.isFinite(t1) ? Math.max(0, t1 - t0) : null;

  const lines = [];
  lines.push('## RUN');
  lines.push('');
  lines.push(`- **run_id:** \`${run_id}\``);
  lines.push(`- **session_id:** \`${session_id}\``);
  lines.push(`- **status:** ${finished ? 'finished' : 'open'}`);
  lines.push(`- **duration:** ${durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : '—'}`);
  lines.push(`- **events:** ${events.length}`);
  lines.push(`- **span.finished:** ${finishedSpans.length}`);
  lines.push(`- **errors:** ${errors.length}`);
  lines.push('');

  lines.push('## TRACE');
  lines.push('');
  if (!spans.length && !events.length) {
    lines.push('_empty_');
  } else {
    for (const e of events) {
      if (e.type === 'span.finished') {
        const ms = typeof e.attrs.duration_ms === 'number' ? e.attrs.duration_ms : null;
        const flag = ms != null && ms >= SPAN_SLOW_MS ? ' 🔴' : '';
        lines.push(
          `- span \`${e.name || '?'}\` ${ms != null ? `${(ms / 1000).toFixed(1)}s` : ''}${flag}`,
        );
      } else if (e.type === 'span.started') {
        lines.push(`- span.start \`${e.name || '?'}\``);
      } else if (e.type === 'run.started' || e.type === 'run.finished') {
        lines.push(`- ${e.type}`);
      } else if (e.type === 'event') {
        lines.push(`- event \`${e.name || 'event'}\``);
      } else if (e.type === 'artifact') {
        lines.push(`- artifact \`${e.name || e.attrs.path || '?'}\``);
      } else if (e.type === 'state.snapshot') {
        lines.push(
          `- state ${e.attrs.stage || '?'} / ${e.attrs.stage_status || '?'} (sprint ${e.attrs.active_sprint || '—'})`,
        );
      }
    }
  }
  lines.push('');

  lines.push('## STATE');
  lines.push('');
  if (!snapshots.length) {
    lines.push('_no state.snapshot events_');
  } else {
    for (const s of snapshots) {
      lines.push(
        `- ${s.ts}: stage=\`${s.attrs.stage || '?'}\` status=\`${s.attrs.stage_status || '?'}\` sprint=\`${s.attrs.active_sprint || '—'}\``,
      );
    }
  }
  lines.push('');

  lines.push('## PROBLEMS');
  lines.push('');
  const problems = collectProblems(events);
  if (!problems.length) lines.push('_none_');
  else for (const p of problems) lines.push(`- ${p}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * @param {import('./lib/trace-models.mjs').TraceEnvelope[]} events
 * @returns {string[]}
 */
export function collectProblems(events) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Map<string, number>} */
  const nameCounts = new Map();
  /** @type {Map<string, number>} */
  const stageCounts = new Map();

  for (const e of events) {
    if (e.type === 'span.finished') {
      const name = e.name || '?';
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      const ms = typeof e.attrs.duration_ms === 'number' ? e.attrs.duration_ms : null;
      if (ms != null && ms >= SPAN_SLOW_MS) {
        problems.push(`🔴 span \`${name}\` duration ${(ms / 1000).toFixed(1)}s (≥ ${SPAN_SLOW_MS / 1000}s)`);
      }
    }
    if (
      e.type === 'event' &&
      (/error/i.test(e.name) || e.attrs?.level === 'error' || e.attrs?.error === true)
    ) {
      problems.push(`🔴 error event \`${e.name || 'error'}\``);
    }
    if (e.type === 'state.snapshot' && typeof e.attrs.stage === 'string') {
      const st = e.attrs.stage;
      stageCounts.set(st, (stageCounts.get(st) || 0) + 1);
    }
  }

  for (const [name, n] of nameCounts) {
    if (n >= SPAN_REPEAT_MIN) {
      problems.push(`🟠 span \`${name}\` repeated ${n} times`);
    }
  }
  for (const [stage, n] of stageCounts) {
    if (n >= STAGE_REPEAT_MIN) {
      problems.push(`🟠 stage \`${stage}\` snapshotted ${n} times`);
    }
  }

  return problems;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const md = inspectRunMarkdown(process.argv.slice(2));
  process.stdout.write(`${md}\n`);
}
