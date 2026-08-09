#!/usr/bin/env node
// commit-receipt.mjs — write/peek/consume typed git-write approval (ADR-012 P0).
//
//   node scripts/commit-receipt.mjs write --operation commit [--root .]
//   node scripts/commit-receipt.mjs peek [--root .]
//   node scripts/commit-receipt.mjs consume [--root .]
//
// After the human explicitly asks to commit/push, run `write` so gate-commits.mjs
// can allow the subsequent git command (fresh working-tree fingerprint).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  consumeReceipt,
  fingerprintWorkingTree,
  peekReceipt,
  writeReceipt,
  VALID_OPERATIONS,
} from './lib/commit-receipt.mjs';

const HELP = `commit-receipt — typed approval for gated git writes

Usage:
  node scripts/commit-receipt.mjs write --operation <commit|push|force-with-lease|git-write> [--root .]
  node scripts/commit-receipt.mjs peek [--root .]
  node scripts/commit-receipt.mjs consume [--root .]
  node scripts/commit-receipt.mjs --help

Write a receipt only after the human explicitly requested the git write.
Installs: node .harness/scripts/commit-receipt.mjs write --operation commit
`;

/**
 * @param {string[]} argv
 * @param {{ stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} [opts]
 * @returns {number}
 */
export function runCommitReceiptCli(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;
  const stderr = opts.stderr || process.stderr;
  const args = argv[0] === 'node' || argv[0]?.endsWith('node.exe') ? argv.slice(2) : argv;
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    stdout.write(HELP);
    return 0;
  }

  let root = process.cwd();
  let operation = 'commit';
  const cmd = args[0];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root' && args[i + 1]) {
      root = resolve(args[++i]);
    } else if (args[i] === '--operation' && args[i + 1]) {
      operation = args[++i];
    }
  }

  try {
    if (cmd === 'write') {
      if (!VALID_OPERATIONS.includes(/** @type {any} */ (operation))) {
        stderr.write(
          `commit-receipt: invalid --operation ${operation}; expected ${VALID_OPERATIONS.join('|')}\n`,
        );
        return 1;
      }
      const fp = fingerprintWorkingTree(root);
      const receipt = writeReceipt(root, {
        operation: /** @type {import('./lib/commit-receipt.mjs').CommitOperation} */ (operation),
        diff_fingerprint: fp,
      });
      stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
      return 0;
    }
    if (cmd === 'peek') {
      const receipt = peekReceipt(root);
      stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
      return receipt ? 0 : 1;
    }
    if (cmd === 'consume') {
      const receipt = consumeReceipt(root);
      stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
      return receipt ? 0 : 1;
    }
    stderr.write(`commit-receipt: unknown command ${cmd}\n`);
    return 1;
  } catch (err) {
    stderr.write(`commit-receipt: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runCommitReceiptCli(process.argv));
}
