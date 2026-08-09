#!/usr/bin/env node
// context-digest.mjs — opt-in workspace file digest CLI (ADR-012 P2; F-034–036).
//
// OFF by default: not wired to sessionStart hooks and never auto-injected into AGENTS.md.
// Cache-only index for manual cost control; does not replace {product}/architecture.md (ADR-003).
//
// Usage:
//   node scripts/context-digest.mjs refresh [--root .]
//   node scripts/context-digest.mjs query <substring> [--root .]
//
// See docs/context-digest.md.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDigest,
  readDigest,
  resolveDigestPath,
  writeDigest,
  queryDigest,
} from './lib/context-digest.mjs';

const HELP = `context-digest — optional workspace file index (cache only; opt-in)

Usage:
  node scripts/context-digest.mjs refresh [--root <dir>]   rebuild digest.json
  node scripts/context-digest.mjs query <substring> [--root <dir>]
  node scripts/context-digest.mjs --help

Environment:
  MIDAS_PROJECT_ROOT   default project root when --root is omitted

Notes:
  - Not wired to sessionStart by default; run refresh manually when needed.
  - Never auto-injected into AGENTS.md; does not replace architecture.md.
`;

/**
 * @param {string[]} argv
 * @returns {{ command: string | null, query: string | null, root: string, help: boolean }}
 */
function parseArgs(argv) {
  /** @type {string | null} */
  let command = null;
  /** @type {string | null} */
  let query = null;
  let root = process.env.MIDAS_PROJECT_ROOT || process.cwd();
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--root') {
      const next = argv[i + 1];
      if (!next) throw new Error('--root requires a directory path');
      root = resolve(next);
      i += 1;
      continue;
    }
    if (!command && (arg === 'refresh' || arg === 'query')) {
      command = arg;
      continue;
    }
    if (command === 'query' && query === null) {
      query = arg;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return { command, query, root, help };
}

/**
 * @param {string[]} argv
 * @param {{ stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} [opts]
 * @returns {number}
 */
export function runContextDigest(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;
  const stderr = opts.stderr || process.stderr;

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr.write(`context-digest: ${err instanceof Error ? err.message : String(err)}\n`);
    stderr.write('Run with --help for usage.\n');
    return 1;
  }

  if (parsed.help || !parsed.command) {
    stdout.write(`${HELP}\n`);
    return parsed.help || !parsed.command ? (parsed.help ? 0 : 1) : 0;
  }

  const projectRoot = resolve(parsed.root);

  if (parsed.command === 'refresh') {
    try {
      const digest = buildDigest(projectRoot);
      writeDigest(projectRoot, digest);
      const summary = {
        ok: true,
        path: resolveDigestPath(projectRoot),
        files: digest.files.length,
        generated_at: digest.generated_at,
      };
      stdout.write(`${JSON.stringify(summary)}\n`);
      return 0;
    } catch (err) {
      stderr.write(`context-digest: ${err instanceof Error ? err.message : String(err)}\n`);
      return 1;
    }
  }

  if (parsed.command === 'query') {
    if (!parsed.query) {
      stderr.write('context-digest: query requires a search substring\n');
      return 1;
    }
    const digest = readDigest(projectRoot);
    if (!digest) {
      const path = resolveDigestPath(projectRoot);
      stderr.write(
        `context-digest: no digest at ${path}; run: node scripts/context-digest.mjs refresh --root ${projectRoot}\n`,
      );
      return 1;
    }
    const hits = queryDigest(digest, parsed.query);
    stdout.write(`${JSON.stringify({ ok: true, query: parsed.query, hits })}\n`);
    return 0;
  }

  stderr.write(`context-digest: unknown command ${parsed.command}\n`);
  return 1;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runContextDigest(process.argv.slice(2)));
}
