#!/usr/bin/env node
// capture-candidates.mjs — propose-only post-sprint capture helper (F-031).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatCaptureProposalMarkdown,
  proposeCaptureCandidates,
} from './lib/capture-candidates.mjs';

const HELP = `capture-candidates — propose capture candidates (never writes rules)

Usage:
  node scripts/capture-candidates.mjs --progress <path> [--sprint <path>]
  node scripts/capture-candidates.mjs --help

Reads sprint progress (and optional sprint file), prints markdown proposals.
Exit 0 always when inputs are readable; prints "No capture candidates found." when empty.
`;

/**
 * @param {string[]} argv
 * @param {{ stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} [opts]
 * @returns {number}
 */
export function runCaptureCandidates(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;
  const stderr = opts.stderr || process.stderr;

  if (argv.includes('--help') || argv.includes('-h')) {
    stdout.write(`${HELP}\n`);
    return 0;
  }

  const progressIdx = argv.indexOf('--progress');
  const sprintIdx = argv.indexOf('--sprint');

  const progressPath = progressIdx >= 0 ? argv[progressIdx + 1] : undefined;
  const sprintPath = sprintIdx >= 0 ? argv[sprintIdx + 1] : undefined;

  if (!progressPath && !sprintPath) {
    stderr.write('capture-candidates: provide --progress and/or --sprint\n');
    return 1;
  }

  let progressText = '';
  let sprintText = '';

  try {
    if (progressPath) {
      progressText = readFileSync(resolve(progressPath), 'utf8');
    }
    if (sprintPath) {
      sprintText = readFileSync(resolve(sprintPath), 'utf8');
    }
  } catch (err) {
    stderr.write(
      `capture-candidates: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  const candidates = proposeCaptureCandidates({ progressText, sprintText });
  stdout.write(formatCaptureProposalMarkdown(candidates));
  return 0;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runCaptureCandidates(process.argv.slice(2)));
}
