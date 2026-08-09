#!/usr/bin/env node
// lifecycle-journal.mjs — CLI for append-only lifecycle observability JSONL (ADR-012 P2).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendLifecycleEvent,
  resolveLifecycleJournalPath,
} from './lib/lifecycle-journal.mjs';

const HELP = `lifecycle-journal — append lifecycle observability events (fail-open)

Usage:
  node scripts/lifecycle-journal.mjs <event> [--detail "..."] [--root .] [--verbose]
  node scripts/lifecycle-journal.mjs --help

Events:
  start_sprint | close_sprint | explore_start | explore_end | verify | session_note

Environment:
  MIDAS_PROJECT_ROOT   project root when --root is omitted (default: process.cwd())

Always exits 0 (fail-open). Prints only with --verbose.
`;

/**
 * @param {string[]} argv
 * @param {{ projectRoot?: string, stdout?: NodeJS.WritableStream }} [opts]
 * @returns {number}
 */
export function runLifecycleJournal(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;

  if (argv.includes('--help') || argv.includes('-h')) {
    stdout.write(`${HELP}\n`);
    return 0;
  }

  const verbose = argv.includes('--verbose');
  let event = '';
  let detail = undefined;
  let root = opts.projectRoot || process.env.MIDAS_PROJECT_ROOT || process.cwd();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--detail') {
      detail = argv[++i];
    } else if (arg === '--root') {
      root = resolve(argv[++i] || '.');
    } else if (arg === '--verbose') {
      continue;
    } else if (!arg.startsWith('-') && !event) {
      event = arg;
    }
  }

  root = resolve(root);

  if (!event) {
    if (verbose) {
      stdout.write(`${JSON.stringify({ ok: false, reason: 'missing-event', root })}\n`);
    }
    return 0;
  }

  const ok = appendLifecycleEvent(root, { event, detail });
  if (verbose) {
    stdout.write(
      `${JSON.stringify({
        ok,
        event,
        path: resolveLifecycleJournalPath(root),
        root,
      })}\n`,
    );
  }
  return 0;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runLifecycleJournal(process.argv.slice(2)));
}
