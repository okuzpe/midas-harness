#!/usr/bin/env node
// quality-log.mjs — CLI for optional quality event JSONL (F-040 INSPIRE; fail-open).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendQualityEvent,
  resolveQualityLogPath,
} from './lib/quality-log.mjs';

const HELP = `quality-log — append quality observability events (fail-open)

Usage:
  node scripts/quality-log.mjs <kind> <status> [--detail "..."] [--root .] [--verbose]
  node scripts/quality-log.mjs --help

Kinds:
  gate | audit | verify | doctor

Statuses:
  pass | fail | warn | skip

Environment:
  MIDAS_PROJECT_ROOT   project root when --root is omitted (default: process.cwd())

Always exits 0 (fail-open). Prints only with --verbose.
`;

/**
 * @param {string[]} argv
 * @param {{ projectRoot?: string, stdout?: NodeJS.WritableStream }} [opts]
 * @returns {number}
 */
export function runQualityLog(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;

  if (argv.includes('--help') || argv.includes('-h')) {
    stdout.write(`${HELP}\n`);
    return 0;
  }

  const verbose = argv.includes('--verbose');
  let kind = '';
  let status = '';
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
    } else if (!arg.startsWith('-')) {
      if (!kind) {
        kind = arg;
      } else if (!status) {
        status = arg;
      }
    }
  }

  root = resolve(root);

  if (!kind || !status) {
    if (verbose) {
      stdout.write(
        `${JSON.stringify({
          ok: false,
          reason: !kind ? 'missing-kind' : 'missing-status',
          root,
        })}\n`,
      );
    }
    return 0;
  }

  const payload =
    detail === undefined ? { kind, status } : { kind, status, detail };

  const ok = appendQualityEvent(root, payload);
  if (verbose) {
    stdout.write(
      `${JSON.stringify({
        ok,
        kind,
        status,
        path: resolveQualityLogPath(root),
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
  process.exit(runQualityLog(process.argv.slice(2)));
}
