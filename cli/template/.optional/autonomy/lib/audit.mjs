import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { brokerDecide } from './broker.mjs';
import { evaluateHook, loadFailClosedHooks } from './hooks.mjs';
import { assertAuditorReadonlyEnv, injectRoleEnv } from './credentials.mjs';

/**
 * Independent auditor — reuses midas-orchestrator role (read-only).
 * Controller (not producer) persists the verdict.
 */

export function buildAuditPrompt({ commitSha, policyDigest, sprintId, taskId }) {
  return [
    'You are midas-orchestrator acting as a READ-ONLY Phase-8 style auditor.',
    'Do not modify files, run mutating shell, or push.',
    `Audit detached commit SHA: ${commitSha}`,
    `policy_digest: ${policyDigest}`,
    `sprint: ${sprintId} task: ${taskId}`,
    'Return JSON: {"verdict":"pass"|"fail","findings":[],"model":"<id>"}',
  ].join('\n');
}

export function auditRecordPath(projectRoot, commitSha) {
  return join(
    projectRoot,
    '.harness',
    'runs',
    'autonomy',
    'audits',
    `audit-${String(commitSha).slice(0, 12).toLowerCase()}.json`,
  );
}

/** Producer must never write the audit path — broker + hooks deny. */
export function assertProducerCannotWriteAudit(projectRoot, commitSha, policy, policyDigest) {
  const rel = `.harness/runs/autonomy/audits/audit-${String(commitSha).slice(0, 12).toLowerCase()}.json`;
  const broker = brokerDecide(
    { effect: 'fs.write', payload: { path: rel } },
    { policy, authz: { valid: false }, policyDigest },
  );
  const hooks = loadFailClosedHooks();
  const hook = evaluateHook('builder', { effect: 'fs.write', path: rel }, hooks);
  const auditorHook = evaluateHook('auditor', { effect: 'fs.write', path: rel }, hooks);
  return {
    ok: !broker.allow && !hook.allow && !auditorHook.allow,
    broker,
    hook,
    auditorHook,
  };
}

/**
 * Persist audit verdict — callable only from the controller process.
 * Sets MIDAS_AUTONOMY_PERSIST_AUDIT=1 in-process gate (tests may set it).
 */
export function persistAuditVerdict(projectRoot, record) {
  if (process.env.MIDAS_AUTONOMY_PRODUCER_PROCESS === '1') {
    throw new Error('producer_cannot_persist_audit');
  }
  const path = auditRecordPath(projectRoot, record.commit_sha);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return path;
}

export async function runAuditor({
  projectRoot,
  commitSha,
  policyDigest,
  sprintId,
  taskId,
  mode = 'fake',
  orchestrateModel,
  policy,
}) {
  const readonlyEnv = injectRoleEnv('auditor');
  const envCheck = assertAuditorReadonlyEnv({
    ...readonlyEnv,
    // Fail if write tokens leaked into auditor injection
    GITHUB_TOKEN: process.env.MIDAS_TEST_AUDITOR_LEAK_GITHUB_TOKEN,
  });
  if (!envCheck.ok && process.env.MIDAS_TEST_AUDITOR_LEAK_GITHUB_TOKEN) {
    return {
      ok: false,
      verdict: 'fail',
      reason: 'auditor_write_credential_leak',
      writeish: envCheck.writeish,
      model: orchestrateModel || 'un-attested',
    };
  }

  if (!commitSha || !/^[0-9a-f]{40}$/i.test(commitSha)) {
    return {
      ok: false,
      verdict: 'fail',
      reason: 'invalid_sha',
      model: orchestrateModel || 'un-attested',
    };
  }

  const hooks = loadFailClosedHooks();
  if (mode === 'mutating_probe') {
    const hook = evaluateHook('auditor', { effect: 'fs.write', path: 'src/x.ts' }, hooks);
    const broker = brokerDecide(
      { effect: 'audit.mutate_verdict', payload: {} },
      { policy: policy || { mode: 'bounded', enabled: true }, authz: { valid: false }, policyDigest },
    );
    return {
      ok: false,
      verdict: 'fail',
      reason: 'auditor_mutation_attempt',
      attempted_effect: 'fs.write',
      hook_denied: !hook.allow,
      broker_denied: !broker.allow,
      model: orchestrateModel || 'claude-opus-4-8',
    };
  }

  const model = orchestrateModel || process.env.MIDAS_ORCHESTRATE_MODEL || 'claude-opus-4-8';
  const verdict =
    process.env.MIDAS_AUTONOMY_AUDIT_VERDICT === 'fail'
      ? 'fail'
      : 'pass';

  const record = {
    schema_version: 1,
    role: 'midas-orchestrator',
    read_only: true,
    commit_sha: commitSha.toLowerCase(),
    policy_digest: policyDigest,
    sprint_id: sprintId,
    task_id: taskId,
    verdict,
    findings: verdict === 'pass' ? [] : [{ severity: 'high', note: 'forced fail fixture' }],
    model,
    attested: !String(model).startsWith('local'),
    at: new Date().toISOString(),
    record_hash: null,
  };
  record.record_hash = createHash('sha256').update(JSON.stringify({ ...record, record_hash: null })).digest('hex');

  const path = persistAuditVerdict(projectRoot, record);
  return { ok: verdict === 'pass', ...record, path };
}

export function readAuditVerdict(projectRoot, commitSha) {
  const path = auditRecordPath(projectRoot, commitSha);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}
