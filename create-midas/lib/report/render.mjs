// render.mjs — human stepper + JSON emitters for installer lifecycle.

import { styleText } from 'node:util';
import { planToJSON, renderPlan } from '../core/plan.mjs';

const PHASES = ['requirements', 'checks', 'plan', 'confirm', 'execute', 'verify', 'complete'];

function color(enabled, format, text) {
  if (!enabled) return text;
  try {
    return styleText(format, text);
  } catch {
    return text;
  }
}

/**
 * @param {object} result
 * @param {{ json?: boolean, color?: boolean }} opts
 */
export function emitResult(result, opts = {}) {
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.plan && result.dryRun) {
    console.log(renderPlan(result.plan));
    console.log('\n  (dry run — nothing written)\n');
    return;
  }
  if (result.message) console.log(result.message);
  if (result.detail) console.log(result.detail);
}

/**
 * @param {string} phase
 * @param {{ json?: boolean, color?: boolean, status?: 'active'|'done'|'failed'|'skip' }} opts
 */
export function emitPhase(phase, opts = {}) {
  if (opts.json) return;
  const idx = PHASES.indexOf(phase);
  const label = idx >= 0 ? `[${idx + 1}/${PHASES.length}] ${phase}` : phase;
  const status = opts.status || 'active';
  const mark = status === 'done' ? '✓' : status === 'failed' ? '✗' : status === 'skip' ? '·' : '…';
  const useColor = opts.color !== false && process.stdout.isTTY;
  const painted = status === 'done'
    ? color(useColor, 'green', `${mark} ${label}`)
    : status === 'failed'
      ? color(useColor, 'red', `${mark} ${label}`)
      : `${mark} ${label}`;
  console.log(`  ${painted}`);
}

/** Build a machine-readable lifecycle result envelope. */
export function buildResultEnvelope({
  ok,
  mode,
  target,
  phase,
  plan = null,
  dryRun = false,
  verify = null,
  error = null,
  diagnosis = null,
  written = null,
  skipped = null,
  message = null,
}) {
  return {
    schema_version: 1,
    ok: !!ok,
    mode,
    target,
    phase,
    dryRun: !!dryRun,
    ...(plan ? { plan: planToJSON(plan) } : {}),
    ...(verify ? { verify } : {}),
    ...(error ? { error: String(error.message || error) } : {}),
    ...(diagnosis ? { diagnosis } : {}),
    ...(written ? { written } : {}),
    ...(skipped ? { skipped } : {}),
    ...(message ? { message } : {}),
  };
}

export { PHASES, renderPlan, planToJSON };
