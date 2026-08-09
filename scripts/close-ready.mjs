#!/usr/bin/env node
// close-ready.mjs — pre-close sprint readiness report (ADR-012 A3).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCloseReady } from './lib/close-ready.mjs';

const HELP = `close-ready — deterministic pre-close checks before /close-sprint

Usage:
  node scripts/close-ready.mjs
  node .harness/scripts/close-ready.mjs
  node scripts/close-ready.mjs --json
  node scripts/close-ready.mjs --sprint 03-auth
  node scripts/close-ready.mjs --help

Exit codes:
  0 — all checks ok or skip (ready)
  1 — one or more warn checks (not ready)
`;

/**
 * @param {string[]} argv
 * @param {{ projectRoot?: string, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} [opts]
 * @returns {number}
 */
export function runCloseReady(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;
  const stderr = opts.stderr || process.stderr;

  if (argv.includes('--help') || argv.includes('-h')) {
    stdout.write(`${HELP}\n`);
    return 0;
  }

  const projectRoot = resolve(opts.projectRoot || process.env.MIDAS_PROJECT_ROOT || process.cwd());
  const sprintIdx = argv.indexOf('--sprint');
  const sprintId = sprintIdx >= 0 ? argv[sprintIdx + 1] : undefined;

  try {
    const report = evaluateCloseReady(projectRoot, { sprintId });
    const asJson = argv.includes('--json');
    if (asJson) {
      stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      stdout.write(`close-ready: ${report.ok ? 'ready' : 'not ready'}${report.sprint_id ? ` (sprint ${report.sprint_id})` : ''}\n`);
      for (const c of report.checks) {
        stdout.write(`  [${c.status}] ${c.id}: ${c.message}\n`);
      }
    }
    return report.ok ? 0 : 1;
  } catch (err) {
    stderr.write(`close-ready: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runCloseReady(process.argv.slice(2)));
}
