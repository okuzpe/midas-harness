// commit-receipt.mjs — one-shot typed approval receipt for git write ops (ADR-012).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolvePaths } from '../paths.mjs';

/** @typedef {'commit' | 'push' | 'force-with-lease' | 'git-write'} CommitOperation */

/** @typedef {{
 *   schema_version: 2,
 *   operation: CommitOperation,
 *   diff_fingerprint: string,
 *   created_at: string,
 *   ttl_seconds: number,
 * }} CommitReceipt */

export const RECEIPT_SCHEMA_VERSION = 2;
export const DEFAULT_TTL_SECONDS = 3600;

/** @type {readonly CommitOperation[]} */
export const VALID_OPERATIONS = ['commit', 'push', 'force-with-lease', 'git-write'];

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
function useHarnessCache(projectRoot) {
  if (existsSync(join(projectRoot, '.harness'))) return true;
  const layout = resolvePaths(projectRoot).layout;
  return layout === 'harness';
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function resolveReceiptPath(projectRoot) {
  if (useHarnessCache(projectRoot)) {
    return join(projectRoot, '.harness', 'cache', 'session', 'commit-approved.json');
  }
  return join(projectRoot, 'runs', 'cache', 'session', 'commit-approved.json');
}

/**
 * @param {unknown} value
 * @returns {value is CommitReceipt}
 */
export function validateReceipt(value) {
  if (!value || typeof value !== 'object') return false;
  const r = /** @type {Record<string, unknown>} */ (value);
  if (r.schema_version !== RECEIPT_SCHEMA_VERSION) return false;
  if (typeof r.operation !== 'string' || !VALID_OPERATIONS.includes(/** @type {CommitOperation} */ (r.operation))) {
    return false;
  }
  if (typeof r.diff_fingerprint !== 'string' || !r.diff_fingerprint.startsWith('sha256:')) {
    return false;
  }
  const fpBody = r.diff_fingerprint.slice('sha256:'.length);
  if (!fpBody) return false;
  if (fpBody !== 'unavailable' && !/^[a-f0-9]{64}$/i.test(fpBody)) return false;
  if (typeof r.created_at !== 'string' || Number.isNaN(Date.parse(r.created_at))) return false;
  if (typeof r.ttl_seconds !== 'number' || !Number.isFinite(r.ttl_seconds) || r.ttl_seconds <= 0) {
    return false;
  }
  return true;
}

/**
 * @param {string} projectRoot
 * @returns {CommitReceipt | null}
 */
export function readReceipt(projectRoot) {
  const path = resolveReceiptPath(projectRoot);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!validateReceipt(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {CommitReceipt} receipt
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isReceiptFresh(receipt, now = new Date()) {
  if (!receipt?.created_at) return false;
  const created = Date.parse(receipt.created_at);
  if (Number.isNaN(created)) return false;
  const ttl = receipt.ttl_seconds ?? DEFAULT_TTL_SECONDS;
  const ageMs = now.getTime() - created;
  return ageMs >= 0 && ageMs <= ttl * 1000;
}

/**
 * @param {string} needed
 * @param {string} receiptOp
 * @returns {boolean}
 */
export function operationsMatch(needed, receiptOp) {
  if (needed === receiptOp) return true;
  if (receiptOp === 'git-write') return true;
  if (needed === 'force-with-lease') {
    return receiptOp === 'push' || receiptOp === 'force-with-lease' || receiptOp === 'git-write';
  }
  return false;
}

/**
 * @param {string} projectRoot
 * @param {CommitOperation} neededOp
 * @returns {CommitReceipt | null}
 */
export function peekReceipt(projectRoot, neededOp) {
  const receipt = readReceipt(projectRoot);
  if (!receipt) return null;
  if (!isReceiptFresh(receipt)) return null;
  if (!operationsMatch(neededOp, receipt.operation)) return null;
  return receipt;
}

/**
 * @param {string} projectRoot
 * @param {CommitOperation} neededOp
 * @returns {boolean}
 */
export function consumeReceipt(projectRoot, neededOp) {
  const receipt = peekReceipt(projectRoot, neededOp);
  if (!receipt) return false;
  const path = resolveReceiptPath(projectRoot);
  try {
    unlinkSync(path);
  } catch {
    return false;
  }
  return true;
}

/**
 * @param {string} projectRoot
 * @param {{ operation: CommitOperation, diff_fingerprint: string, ttl_seconds?: number }} input
 * @returns {CommitReceipt}
 */
export function writeReceipt(projectRoot, input) {
  const { operation, diff_fingerprint, ttl_seconds = DEFAULT_TTL_SECONDS } = input;
  const receipt = {
    schema_version: RECEIPT_SCHEMA_VERSION,
    operation,
    diff_fingerprint,
    created_at: new Date().toISOString(),
    ttl_seconds,
  };
  if (!validateReceipt(receipt)) {
    throw new Error('Invalid commit receipt payload');
  }
  const path = resolveReceiptPath(projectRoot);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt)}\n`, 'utf8');
  return receipt;
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 * @returns {string}
 */
function gitStdout(projectRoot, args) {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'git failed');
  }
  return result.stdout || '';
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function fingerprintWorkingTree(projectRoot) {
  try {
    const status = gitStdout(projectRoot, ['status', '--porcelain=v1']);
    const diff = gitStdout(projectRoot, ['diff']);
    const staged = gitStdout(projectRoot, ['diff', '--cached']);
    const digest = createHash('sha256')
      .update(status)
      .update(diff)
      .update(staged)
      .digest('hex');
    return `sha256:${digest}`;
  } catch {
    return 'sha256:unavailable';
  }
}
