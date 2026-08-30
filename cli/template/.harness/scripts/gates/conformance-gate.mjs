#!/usr/bin/env node
// conformance-gate.mjs — run kind:command CHECKs from checks.json and write a receipt.
//
//   node scripts/gates/conformance-gate.mjs [--root <dir>] [--run <id>]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeHelp } from '../lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

import { resolvePaths } from '../paths.mjs';
import { runConformance } from './lib/conformance-eval.mjs';

export function defaultRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * @param {string[]} argv
 */
export function parseConformanceArgs(argv) {
  let root = null;
  let runId = null;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' && argv[i + 1]) {
      root = argv[++i];
      continue;
    }
    if (arg === '--run' && argv[i + 1]) {
      runId = argv[++i];
    }
  }
  return { root, runId: runId ?? defaultRunId() };
}

/**
 * @param {string} root
 * @param {object} report
 * @param {string} runId
 */
export function writeConformanceReceipt(root, report, runId) {
  const paths = resolvePaths(root);
  const dir = join(root, paths.runs, 'gates');
  mkdirSync(dir, { recursive: true });
  const line =
    `MIDAS_CONFORMANCE_RESULT: verdict=${report.verdict} scanned=${report.scanned} ` +
    `failed=${report.failed} skipped=${report.skipped} manual=${report.manual} command=${report.command}`;
  const fails = report.rows.filter((r) => r.status === 'fail');
  const md = [
    `# Conformance gate ${runId}`,
    '',
    line,
    '',
    `Command CHECKs: ${report.command}. Manual: ${report.manual}. Failed: ${report.failed}.`,
    '',
    fails.length ? '## Failures' : '## Failures',
    fails.length
      ? fails.map((r) => `- \`${r.slug}\` ${r.reason} \`${r.cmd}\``).join('\n')
      : '_none_',
    '',
  ].join('\n');
  const mdPath = join(dir, `conformance-${runId}.md`);
  const jsonPath = join(dir, `conformance-${runId}.json`);
  writeFileSync(mdPath, `${md}\n`, 'utf8');
  writeFileSync(jsonPath, `${JSON.stringify({ runId, ...report, tally: line }, null, 2)}\n`, 'utf8');
  return { dir, mdPath, jsonPath, line };
}

function main() {
  const args = parseConformanceArgs(process.argv);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const defaultRoot = scriptDir.replace(/\\/g, '/').endsWith('/.harness/scripts/gates')
    ? resolve(scriptDir, '..', '..', '..')
    : resolve(scriptDir, '..', '..');
  const root = args.root ? resolve(process.cwd(), args.root) : defaultRoot;
  const report = runConformance(root);
  const written = writeConformanceReceipt(root, report, args.runId);
  console.log(written.line);
  console.log(`receipt ${written.mdPath}`);
  process.exit(report.verdict === 'pass' ? 0 : 1);
}

const invoked =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) main();
