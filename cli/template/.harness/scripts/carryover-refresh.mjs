#!/usr/bin/env node
// carryover-refresh.mjs — refresh session carryover snapshot (ADR-012 P1).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  writeCarryoverSnapshot,
  buildCarryoverSnapshot,
  resolveCarryoverPath,
} from './lib/carryover.mjs';

const HELP = `carryover-refresh — refresh session carryover snapshot

Usage:
  node scripts/carryover-refresh.mjs           write snapshot, print summary JSON
  node .harness/scripts/carryover-refresh.mjs  same (installed projects)
  node scripts/carryover-refresh.mjs --print   also dump full snapshot (pretty JSON)
  node scripts/carryover-refresh.mjs --hook    Cursor sessionStart (fail-open; emit continue)
  node scripts/carryover-refresh.mjs --help

Environment:
  MIDAS_PROJECT_ROOT   project root (default: process.cwd())
`;

/**
 * @param {import('./lib/carryover.mjs').CarryoverSnapshot} snapshot
 * @returns {number}
 */
function countSnapshotFiles(snapshot) {
  return Array.isArray(snapshot.files) ? snapshot.files.length : 0;
}

/**
 * @param {string[]} argv
 * @param {{ projectRoot?: string, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} [opts]
 * @returns {number}
 */
export function runCarryoverRefresh(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;
  const stderr = opts.stderr || process.stderr;

  if (argv.includes('--help') || argv.includes('-h')) {
    stdout.write(`${HELP}\n`);
    return 0;
  }

  const projectRoot = resolve(opts.projectRoot || process.env.MIDAS_PROJECT_ROOT || process.cwd());

  // Cursor sessionStart: always exit 0; never block the session (ADR-012 fail-open).
  if (argv.includes('--hook')) {
    try {
      writeCarryoverSnapshot(projectRoot);
    } catch {
      // fail-open
    }
    stdout.write(`${JSON.stringify({ continue: true })}\n`);
    return 0;
  }

  const wantPrint = argv.includes('--print');

  try {
    const snapshot = buildCarryoverSnapshot(projectRoot);
    writeCarryoverSnapshot(projectRoot, snapshot);
    const path = resolveCarryoverPath(projectRoot);
    const summary = {
      ok: true,
      path,
      mode: snapshot.mode,
      files: countSnapshotFiles(snapshot),
    };
    stdout.write(`${JSON.stringify(summary)}\n`);
    if (wantPrint) {
      stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    }
    return 0;
  } catch (err) {
    stderr.write(`carryover-refresh: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runCarryoverRefresh(process.argv.slice(2)));
}
