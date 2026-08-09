// close-ready.mjs — deterministic pre-close checks (ADR-012 A3; session-resume-precedence § Close-ready).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePaths } from '../paths.mjs';
import { parseSprints } from '../yaml-lite.mjs';
import { hasProductionPaths, listChangedPaths } from '../gates/lib/diff-paths.mjs';
import { findPassingGateRunForDiff } from './gate-result.mjs';

/** @typedef {'ok' | 'warn' | 'skip'} CheckStatus */

/** @typedef {{ id: string, status: CheckStatus, message: string }} CloseReadyCheck */

/** @typedef {{ ok: boolean, sprint_id: string | null, checks: CloseReadyCheck[] }} CloseReadyReport */

/**
 * @param {string} text
 * @param {string} key
 * @returns {number}
 */
function tallyNum(text, key) {
  const m = text.match(new RegExp(`${key}=(\\d+)`));
  return m ? Number(m[1]) : 0;
}

/**
 * @param {string} progressText
 * @returns {number} rows in Done table missing Tool value
 */
export function countDoneRowsMissingTool(progressText) {
  const lines = progressText.split(/\r?\n/);
  let inDone = false;
  let missing = 0;
  for (const line of lines) {
    if (/^##\s+Done\b/i.test(line)) {
      inDone = true;
      continue;
    }
    if (inDone && /^##\s+/.test(line)) break;
    if (!inDone) continue;
    if (!/^\|/.test(line) || /^\|\s*[-:]+\s*\|/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    if (/^task$/i.test(cells[0])) continue;
    const tool = cells.length >= 3 ? cells[cells.length - 1] : '';
    if (!tool || tool === '—' || tool === '-') missing += 1;
  }
  return missing;
}

/**
 * @param {string} projectRoot
 * @param {string} sprintId
 * @param {ReturnType<typeof resolvePaths>} paths
 * @returns {CloseReadyCheck}
 */
function checkVerifyRecord(projectRoot, sprintId, paths) {
  const verifyDir = join(projectRoot, paths.runs, 'verifications');
  if (!existsSync(verifyDir)) {
    return { id: 'verify-record', status: 'skip', message: 'no verifications directory' };
  }
  const match = readdirSync(verifyDir).find((f) => f === `verify-${sprintId}.md`);
  if (!match) {
    return { id: 'verify-record', status: 'skip', message: `no verify-${sprintId}.md (UI/API proof may be n/a)` };
  }
  const raw = readFileSync(join(verifyDir, match), 'utf8');
  const line = raw.match(/MIDAS_VERIFY_RESULT:[^\n\r]*/);
  if (!line) {
    return {
      id: 'verify-record',
      status: 'warn',
      message: `verify-${sprintId}.md missing MIDAS_VERIFY_RESULT tally`,
    };
  }
  const fails = tallyNum(line[0], 'fails');
  const criticals = tallyNum(line[0], 'criticals');
  const passClaimed = /verdict=pass/.test(line[0]);
  if (passClaimed && fails === 0 && criticals === 0) {
    return { id: 'verify-record', status: 'ok', message: `verify-${sprintId}.md verdict=pass` };
  }
  return {
    id: 'verify-record',
    status: 'warn',
    message: `verify-${sprintId}.md fails=${fails} criticals=${criticals} — fix or document deferral before /close-sprint`,
  };
}

/**
 * @param {string} projectRoot
 * @param {{ sprintId?: string }} [opts]
 * @returns {CloseReadyReport}
 */
export function evaluateCloseReady(projectRoot, opts = {}) {
  /** @type {CloseReadyCheck[]} */
  const checks = [];
  const paths = resolvePaths(projectRoot);
  const statePath = join(projectRoot, paths.state);

  if (!existsSync(statePath)) {
    return {
      ok: false,
      sprint_id: null,
      checks: [{ id: 'state', status: 'warn', message: 'no state.yaml' }],
    };
  }

  const stateRaw = readFileSync(statePath, 'utf8');
  const sprintStatus = parseSprints(stateRaw);
  const active = [...sprintStatus.entries()].filter(([, st]) => st === 'active');
  if (!active.length) {
    return {
      ok: true,
      sprint_id: null,
      checks: [{ id: 'active-sprint', status: 'skip', message: 'no active sprint' }],
    };
  }

  const sprintId = opts.sprintId && sprintStatus.get(opts.sprintId) === 'active'
    ? opts.sprintId
    : active[0][0];

  checks.push({
    id: 'active-sprint',
    status: 'ok',
    message: `active sprint ${sprintId}`,
  });

  const progressRel = join(paths.runs, 'sprints', `${sprintId}-progress.md`);
  const progressAbs = join(projectRoot, progressRel);
  if (!existsSync(progressAbs)) {
    checks.push({
      id: 'progress-file',
      status: 'warn',
      message: `missing ${progressRel.replace(/\\/g, '/')}`,
    });
  } else {
    checks.push({
      id: 'progress-file',
      status: 'ok',
      message: progressRel.replace(/\\/g, '/'),
    });
    const progressText = readFileSync(progressAbs, 'utf8');
    const missingTools = countDoneRowsMissingTool(progressText);
    if (missingTools > 0) {
      checks.push({
        id: 'progress-tools',
        status: 'warn',
        message: `${missingTools} Done row(s) missing Tool column — populate before /close-sprint`,
      });
    } else {
      checks.push({
        id: 'progress-tools',
        status: 'ok',
        message: 'Done rows have Tool values or no Done rows',
      });
    }
  }

  checks.push(checkVerifyRecord(projectRoot, sprintId, paths));

  let changed = [];
  try {
    changed = listChangedPaths(projectRoot);
  } catch {
    changed = [];
  }
  if (!hasProductionPaths(changed)) {
    checks.push({
      id: 'gate-receipts',
      status: 'skip',
      message: 'no production paths in working diff',
    });
  } else {
    const match = findPassingGateRunForDiff(projectRoot, changed);
    if (match) {
      checks.push({
        id: 'gate-receipts',
        status: 'ok',
        message: `passing receipts under cache/gates/${match.runId}/`,
      });
    } else {
      checks.push({
        id: 'gate-receipts',
        status: 'warn',
        message: 'production diff lacks passing cache/gates/<run>/{test,quality}.json — run /midas-diff-gates',
      });
    }
  }

  const ok = !checks.some((c) => c.status === 'warn');
  return { ok, sprint_id: sprintId, checks };
}
