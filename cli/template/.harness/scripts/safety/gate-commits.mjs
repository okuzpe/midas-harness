// gate-commits.mjs — Cursor beforeShellExecution: gate git write ops on commit receipt.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { peekReceipt, consumeReceipt } from '../lib/commit-receipt.mjs';
import { resolveProjectRootFromScript } from '../paths.mjs';
import {
  normalizeCommand,
  extractCommand,
  emitDecision,
  allowDecision,
  denyDecision,
} from './lib/hook-io.mjs';

const DEFAULT_ROOT = resolveProjectRootFromScript(import.meta.url);

const RECEIPT_REQUIRED_MSG =
  'Git write blocked: no valid commit approval receipt. The user must explicitly request the operation; write a receipt via `node scripts/commit-receipt.mjs write --operation commit` (installs: `node .harness/scripts/commit-receipt.mjs …`) before retrying.';

const RECEIPT_LIB_MSG =
  'Git write blocked: commit receipt library (scripts/lib/commit-receipt.mjs) is unavailable.';

/** @typedef {'commit' | 'push' | 'force-with-lease' | 'git-write'} NeededOp */

/**
 * @param {string} command
 * @returns {boolean}
 */
export function hasDryRunFlag(command) {
  return /(?:^|\s)--dry-run\b/i.test(command);
}

/**
 * @param {string} gitArgs
 * @returns {NeededOp | null}
 */
export function classifyPush(gitArgs) {
  if (/(?:^|\s)\+[\w./-]/.test(gitArgs) || /(?:^|\s)\+refs\//i.test(gitArgs)) {
    return 'force-with-lease';
  }
  if (/(?:^|\s)--force-with-lease\b/i.test(gitArgs)) {
    return 'force-with-lease';
  }
  if (/(?:^|\s)--force\b/i.test(gitArgs) || /(?:^|\s)-f(?:\s|$)/.test(gitArgs)) {
    return 'force-with-lease';
  }
  return 'push';
}

/**
 * @param {string} segment
 * @returns {string | null}
 */
function extractGitArgs(segment) {
  const trimmed = segment.trim();
  const match = trimmed.match(/^(?:\S+=\S+\s+)*git(?:\.exe)?\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * @param {string} command
 * @returns {{ neededOp: NeededOp } | null}
 */
export function detectGitWrite(command) {
  const normalized = normalizeCommand(command);
  if (!normalized) return null;

  const segments = normalized.split(/\s*(?:&&|\|\||;)\s*/);
  let sawWrite = null;

  for (const segment of segments) {
    const gitArgs = extractGitArgs(segment);
    if (!gitArgs) continue;
    if (hasDryRunFlag(gitArgs) || hasDryRunFlag(segment)) continue;

    const lower = gitArgs.toLowerCase();
    if (/^cherry-pick\b/.test(lower)) sawWrite = { neededOp: 'git-write' };
    else if (/^commit-tree\b/.test(lower)) sawWrite = { neededOp: 'git-write' };
    else if (/^commit\b/.test(lower)) sawWrite = { neededOp: 'commit' };
    else if (/^push\b/.test(lower)) sawWrite = { neededOp: classifyPush(gitArgs) };
    else if (/^rebase\b/.test(lower)) sawWrite = { neededOp: 'git-write' };
    else if (/^merge\b/.test(lower)) sawWrite = { neededOp: 'git-write' };
    else if (/^am\b/.test(lower)) sawWrite = { neededOp: 'git-write' };
  }

  return sawWrite;
}

/**
 * @param {string} command
 * @param {{
 *   projectRoot?: string,
 *   peekReceipt?: typeof peekReceipt,
 *   consumeReceipt?: typeof consumeReceipt,
 *   receiptLibMissing?: boolean,
 * }} [opts]
 * @returns {import('./lib/hook-io.mjs').HookDecision}
 */
export function evaluateCommand(command, opts = {}) {
  const normalized = normalizeCommand(command);
  if (!normalized) {
    return denyDecision('Empty shell command blocked by gate-commits (fail-closed).');
  }

  const write = detectGitWrite(normalized);
  if (!write) return allowDecision();

  if (opts.receiptLibMissing) {
    return denyDecision(RECEIPT_LIB_MSG);
  }

  const projectRoot = opts.projectRoot || DEFAULT_ROOT;
  const peek = opts.peekReceipt || peekReceipt;
  const consume = opts.consumeReceipt || consumeReceipt;
  const { neededOp } = write;

  if (neededOp === 'force-with-lease') {
    const receipt = peek(projectRoot, neededOp);
    if (!receipt) {
      return denyDecision(RECEIPT_REQUIRED_MSG);
    }
    return allowDecision();
  }

  if (!consume(projectRoot, neededOp)) {
    return denyDecision(RECEIPT_REQUIRED_MSG);
  }
  return allowDecision();
}

/**
 * @param {string} raw
 * @param {{ projectRoot?: string, receiptLibMissing?: boolean }} [opts]
 * @returns {import('./lib/hook-io.mjs').HookDecision}
 */
export function handleHookStdin(raw, opts = {}) {
  const command = extractCommand(raw);
  return evaluateCommand(command, opts);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const raw = readFileSync(0, 'utf8');
    const result = handleHookStdin(raw);
    emitDecision(result);
  } catch {
    emitDecision(denyDecision('gate-commits hook failed (fail-closed).'));
  }
  process.exit(0);
}
