import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { atomicWrite } from './state.mjs';

export function ledgerPath(projectRoot) {
  return join(projectRoot, '.harness', 'autonomy', 'budget-ledger.json');
}

export function defaultLedger() {
  return {
    schema_version: 1,
    day: utcDay(),
    runs_today: 0,
    reserved_cents: 0,
    settled_cents: 0,
    open_reservations: {},
  };
}

function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function readLedger(projectRoot) {
  const path = ledgerPath(projectRoot);
  if (!existsSync(path)) return defaultLedger();
  const ledger = JSON.parse(readFileSync(path, 'utf8'));
  const today = utcDay();
  if (ledger.day !== today) {
    return {
      ...defaultLedger(),
      settled_cents: ledger.settled_cents || 0,
    };
  }
  return ledger;
}

export function writeLedger(projectRoot, ledger) {
  const path = ledgerPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  atomicWrite(path, `${JSON.stringify(ledger, null, 2)}\n`);
}

/**
 * Hard limits BEFORE starting a run.
 * mid-run limits are best-effort; documented overshoot may occur until settle.
 */
export function canReserve(projectRoot, policy, reserveCents) {
  const ledger = readLedger(projectRoot);
  const budget = policy.budget || {};
  if ((ledger.runs_today || 0) >= (budget.max_runs_per_day || 20)) {
    return { ok: false, reason: 'max_runs_per_day', ledger };
  }
  const open = Object.keys(ledger.open_reservations || {}).length;
  if (open >= (budget.max_concurrent_runs || 1)) {
    return { ok: false, reason: 'max_concurrent_runs', ledger };
  }
  const cap = budget.max_cost_cents_reserve ?? 500;
  if ((ledger.reserved_cents || 0) + reserveCents > cap) {
    return { ok: false, reason: 'budget_envelope', ledger, cap, reserved: ledger.reserved_cents };
  }
  return { ok: true, ledger };
}

export function reserve(projectRoot, policy, { reservationId, cents }) {
  const check = canReserve(projectRoot, policy, cents);
  if (!check.ok) return check;
  const ledger = check.ledger;
  ledger.open_reservations[reservationId] = {
    cents,
    at: new Date().toISOString(),
  };
  ledger.reserved_cents = (ledger.reserved_cents || 0) + cents;
  ledger.runs_today = (ledger.runs_today || 0) + 1;
  writeLedger(projectRoot, ledger);
  return { ok: true, ledger, reservationId, cents };
}

export function releaseReservation(projectRoot, reservationId, { chargedCents = 0 } = {}) {
  const ledger = readLedger(projectRoot);
  const open = ledger.open_reservations?.[reservationId];
  if (!open) return { ok: false, reason: 'unknown_reservation', ledger };
  ledger.reserved_cents = Math.max(0, (ledger.reserved_cents || 0) - open.cents);
  delete ledger.open_reservations[reservationId];
  ledger.settled_cents = (ledger.settled_cents || 0) + (chargedCents || 0);
  writeLedger(projectRoot, ledger);
  return { ok: true, ledger };
}

/**
 * Classify limit errors from Cursor / HTTP.
 * P0: unknown → blocked_unknown_limit (no auto-retry). Transient only when documented.
 */
export function classifyLimitError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const name = String(err?.name || '');
  const code = err?.code || err?.status || '';

  if (/spend.?limit|budget|insufficient.?credits|payment/.test(msg)) {
    return { kind: 'budget', status: 'paused_budget', retryable: false };
  }
  if (/monthly|usage.?limit|quota/.test(msg) && !/rate.?limit/.test(msg)) {
    return { kind: 'quota', status: 'paused_quota', retryable: false };
  }
  if (name === 'RateLimitError' || /rate.?limit/.test(msg)) {
    // Ambiguous RateLimitError → blocked_unknown_limit in P0 (no cycle detect).
    if (err?.isRetryable === true && /burst|temporary|try again/.test(msg)) {
      return { kind: 'transient', status: null, retryable: true };
    }
    return { kind: 'unknown_limit', status: 'blocked_unknown_limit', retryable: false };
  }
  if (code === 429) {
    return { kind: 'unknown_limit', status: 'blocked_unknown_limit', retryable: false };
  }
  return { kind: 'other', status: 'blocked', retryable: false };
}
