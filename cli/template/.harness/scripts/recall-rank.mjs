#!/usr/bin/env node
// recall-rank.mjs — CLI for scored /midas-recall snippets (ADR-003; no entry corpus).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectRecallCorpus,
  excerptText,
  rankSnippets,
} from './lib/recall-score.mjs';
import { filterUnseen } from './lib/recall-fifo.mjs';

/**
 * @param {string[]} argv
 * @returns {{ root: string, query: string, limit: number, paths: string[], fifo?: boolean, help?: boolean }}
 */
export function parseRecallRankArgs(argv) {
  let root = process.cwd();
  let query = '';
  let limit = 5;
  let fifo = false;
  /** @type {string[]} */
  const paths = [];

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { root, query, limit, paths, fifo, help: true };
    }
    if (arg === '--fifo') {
      fifo = true;
      continue;
    }
    if (arg === '--root' && argv[i + 1]) {
      root = resolve(argv[++i]);
      continue;
    }
    if (arg === '--query' && argv[i + 1]) {
      query = argv[++i];
      continue;
    }
    if (arg === '--limit' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[++i], 10);
      if (Number.isFinite(parsed) && parsed > 0) limit = parsed;
      continue;
    }
    if (arg === '--paths' && argv[i + 1]) {
      paths.push(
        ...argv[++i]
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      );
      continue;
    }
    if (!arg.startsWith('-')) {
      paths.push(arg);
    }
  }

  return { root: resolve(root), query, limit, paths, fifo };
}

/**
 * @param {{ root: string, query: string, limit: number, paths: string[], fifo?: boolean }} args
 * @returns {Array<{ path: string, score: number, excerpt: string }>}
 */
export function runRecallRank(args) {
  const corpus = collectRecallCorpus(args.root, args.paths);
  const ranked = rankSnippets(args.query, corpus, { limit: args.limit });
  let results = ranked.map(({ path, score, text }) => ({
    path,
    score,
    excerpt: excerptText(text),
  }));

  if (args.fifo) {
    const unseen = filterUnseen(args.root, results.map((row) => row.path), { max: args.limit });
    const unseenSet = new Set(unseen);
    results = results.filter((row) => unseenSet.has(row.path));
  }

  return results;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseRecallRankArgs(process.argv);
  if (args.help) {
    process.stdout.write(
      [
        'Usage: node recall-rank.mjs --root <dir> --query "<text>" [--limit N] [--fifo] [--paths a,b,c] [path ...]',
        '',
        'Prints JSON array of { path, score, excerpt } ranked by term overlap.',
        'Reads git-visible markdown only — no memory/entries corpus (ADR-003).',
        '',
      ].join('\n'),
    );
    process.exit(0);
  }
  const output = runRecallRank(args);
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exit(0);
}
