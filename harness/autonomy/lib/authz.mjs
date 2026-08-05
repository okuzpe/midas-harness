import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { digestText, newToken } from './digest.mjs';
import { atomicWrite } from './state.mjs';

/**
 * Human preauthorization for commit/push — single-use or expiring,
 * bound to repo, branch prefix, action id, and policy digest.
 * Does NOT authorize merge, default-branch push, or other actions.
 *
 * schema_version 2: HMAC-SHA256 (`mac`) over the canonical payload using
 * MIDAS_AUTONOMY_AUTHZ_KEY (controller-only). Plain SHA-256 digests of public
 * fields are not attestation.
 */

export const AUTHZ_KEY_ENV = 'MIDAS_AUTONOMY_AUTHZ_KEY';

export function authzPath(projectRoot) {
  return join(projectRoot, '.harness', 'autonomy', 'authz', 'commit-push.json');
}

/** @param {NodeJS.ProcessEnv} [env] */
export function authzSigningKey(env = process.env) {
  const key = env[AUTHZ_KEY_ENV];
  return key && String(key).length > 0 ? String(key) : '';
}

function canonicalAuthzBody(record) {
  return JSON.stringify({
    kind: record.kind,
    repo: record.repo,
    branch_prefix: record.branch_prefix,
    action_id: record.action_id,
    policy_digest: record.policy_digest,
    actor: record.actor,
    nonce: record.nonce,
    expires_at: record.expires_at,
  });
}

/** HMAC-SHA256 hex over the canonical authz body. */
export function macAuthzBody(canonical, key) {
  return createHmac('sha256', key).update(canonical, 'utf8').digest('hex');
}

export function createCommitPushAuthz({
  repo,
  branchPrefix,
  actionId = 'execute-next-sprint-task',
  policyDigest,
  actor,
  expiresAt,
  singleUse = true,
  env = process.env,
}) {
  if (!repo || !branchPrefix || !policyDigest || !actor || !expiresAt) {
    throw new Error('authz requires repo, branchPrefix, policyDigest, actor, expiresAt');
  }
  const key = authzSigningKey(env);
  if (!key) {
    throw new Error(
      `${AUTHZ_KEY_ENV} is required to grant commit/push authz (controller-only HMAC key)`,
    );
  }
  const nonce = newToken('authz');
  const record = {
    schema_version: 2,
    kind: 'commit_push',
    repo,
    branch_prefix: branchPrefix,
    action_id: actionId,
    policy_digest: policyDigest,
    actor,
    nonce,
    single_use: singleUse,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    used_at: null,
  };
  const canonical = canonicalAuthzBody(record);
  record.content_digest = digestText(canonical);
  record.mac = macAuthzBody(canonical, key);
  return record;
}

export function writeAuthz(projectRoot, record) {
  const path = authzPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  atomicWrite(path, `${JSON.stringify(record, null, 2)}\n`);
  return path;
}

export function readAuthz(projectRoot) {
  const path = authzPath(projectRoot);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function validateCommitPushAuthz(
  projectRoot,
  { repo, branchPrefix, actionId, policyDigest, now = Date.now(), env = process.env },
) {
  const record = readAuthz(projectRoot);
  if (!record) return { valid: false, reason: 'missing' };
  if (record.kind !== 'commit_push') return { valid: false, reason: 'wrong_kind', record };
  if (record.used_at && record.single_use) return { valid: false, reason: 'already_used', record };
  if (Date.parse(record.expires_at) <= now) return { valid: false, reason: 'expired', record };
  if (record.repo !== repo) return { valid: false, reason: 'repo_mismatch', record };
  if (record.branch_prefix !== branchPrefix) return { valid: false, reason: 'branch_prefix_mismatch', record };
  if (record.action_id !== actionId) return { valid: false, reason: 'action_mismatch', record };
  if (record.policy_digest !== policyDigest) return { valid: false, reason: 'policy_digest_stale', record };

  const key = authzSigningKey(env);
  if (!key) return { valid: false, reason: 'missing_authz_key', record };

  const schema = Number(record.schema_version) || 1;
  if (schema < 2 || !record.mac) {
    return { valid: false, reason: 'unsigned_authz', record };
  }

  const canonical = canonicalAuthzBody(record);
  const expectedMac = macAuthzBody(canonical, key);
  if (record.mac !== expectedMac) return { valid: false, reason: 'mac_mismatch', record };

  return { valid: true, record, mac: record.mac };
}

export function consumeAuthz(projectRoot) {
  const record = readAuthz(projectRoot);
  if (!record) return { ok: false, reason: 'missing' };
  if (record.single_use) {
    record.used_at = new Date().toISOString();
    writeAuthz(projectRoot, record);
  }
  return { ok: true, record };
}

export function clearAuthz(projectRoot) {
  const path = authzPath(projectRoot);
  if (existsSync(path)) unlinkSync(path);
}
