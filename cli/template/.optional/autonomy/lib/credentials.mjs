/**
 * Role-scoped credentials for autonomy — never inherit controller secrets to agents.
 *
 * Roles:
 *   controller — lease, CAS, journal MAC, Cursor API to create/resume
 *   builder    — Cursor API only (no journal MAC, no merge token)
 *   auditor    — read-only SCM + optional Cursor resume; no write tokens
 */

const ROLE_ENV = {
  controller: ['CURSOR_API_KEY', 'MIDAS_AUTONOMY_JOURNAL_KEY', 'MIDAS_AUTONOMY_AUTHZ_KEY'],
  builder: ['CURSOR_API_KEY'],
  auditor: ['CURSOR_API_KEY_READONLY', 'GITHUB_TOKEN_READONLY'],
};

const FORBIDDEN_IN_AGENT = [
  'MIDAS_AUTONOMY_JOURNAL_KEY',
  'MIDAS_AUTONOMY_AUTHZ_KEY',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'MERGE_TOKEN',
  'DEPLOY_TOKEN',
  'AWS_SECRET_ACCESS_KEY',
];

/** Build env for a role; strips forbidden inheritance. */
export function injectRoleEnv(role, sourceEnv = process.env) {
  if (!ROLE_ENV[role]) throw new Error(`unknown credential role: ${role}`);
  const out = {};
  for (const key of ROLE_ENV[role]) {
    if (sourceEnv[key]) out[key] = sourceEnv[key];
  }
  return out;
}

/** Detect leak: agent-bound env must not carry controller-only secrets. */
export function detectCredentialLeak(env = {}) {
  const leaks = FORBIDDEN_IN_AGENT.filter((k) => env[k] != null && String(env[k]).length > 0);
  return { ok: leaks.length === 0, leaks };
}

/** Redact secrets from a log/journal payload (allowlist keys only). */
const LOG_ALLOWLIST = new Set([
  'type',
  'status',
  'reason',
  'kind',
  'seq',
  'actor',
  'at',
  'commit_sha',
  'agent_id',
  'run_id',
  'policy_digest',
  'fencing_token',
  'idempotency_key',
  'task_id',
  'sprint_id',
  'audit_verdict',
  'phase',
  'message',
]);

export function redactForJournal(entry) {
  const out = {};
  for (const [k, v] of Object.entries(entry || {})) {
    if (!LOG_ALLOWLIST.has(k)) continue;
    if (typeof v === 'string' && /sk-|ghp_|token|secret|password/i.test(v)) {
      out[k] = '[redacted]';
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Rotation/revocation registry (project-local).
 * File: .harness/autonomy/credentials-registry.json
 */
export function defaultRegistry() {
  return { schema_version: 1, credentials: {} };
}

export function registerCredential(registry, { id, role, expiresAt, revoked = false }) {
  const next = { ...registry, credentials: { ...registry.credentials } };
  next.credentials[id] = {
    role,
    expires_at: expiresAt,
    revoked,
    rotated_at: new Date().toISOString(),
  };
  return next;
}

export function revokeCredential(registry, id) {
  const cur = registry.credentials?.[id];
  if (!cur) return { ok: false, reason: 'unknown' };
  return {
    ok: true,
    registry: registerCredential(registry, {
      id,
      role: cur.role,
      expiresAt: cur.expires_at,
      revoked: true,
    }),
  };
}

export function validateCredential(registry, id, now = Date.now()) {
  const cur = registry.credentials?.[id];
  if (!cur) return { valid: false, reason: 'missing' };
  if (cur.revoked) return { valid: false, reason: 'revoked' };
  if (cur.expires_at && Date.parse(cur.expires_at) <= now) return { valid: false, reason: 'expired' };
  return { valid: true, credential: cur };
}

/** Auditor must use read-only token names — never GITHUB_TOKEN write scope. */
export function assertAuditorReadonlyEnv(env = {}) {
  const writeish = ['GITHUB_TOKEN', 'GH_TOKEN', 'MERGE_TOKEN', 'DEPLOY_TOKEN'].filter(
    (k) => env[k] != null && String(env[k]).length > 0,
  );
  return { ok: writeish.length === 0, writeish };
}

export { ROLE_ENV, FORBIDDEN_IN_AGENT, LOG_ALLOWLIST };
