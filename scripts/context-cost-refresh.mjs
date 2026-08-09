#!/usr/bin/env node
// context-cost-refresh.mjs — log sessionStart context budget metrics (ADR-012 P2 / F-039).

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from './paths.mjs';
import { resolveCarryoverPath } from './lib/carryover.mjs';
import {
  appendContextCost,
  buildSessionStartCostRecord,
  resolveContextCostPath,
} from './lib/context-cost.mjs';

const HELP = `context-cost-refresh — log sessionStart context budget metrics

Usage:
  node scripts/context-cost-refresh.mjs           sample + append NDJSON line
  node scripts/context-cost-refresh.mjs --hook    Cursor sessionStart (fail-open; emit continue)
  node scripts/context-cost-refresh.mjs --help

Environment:
  MIDAS_PROJECT_ROOT   project root (default: process.cwd())
`;

/**
 * @param {string} projectRoot
 * @param {string} relPath
 * @returns {{ chars: number, path: string, present: boolean }}
 */
function sampleRelFile(projectRoot, relPath) {
  const norm = relPath.replace(/\\/g, '/');
  const abs = join(projectRoot, norm);
  if (!existsSync(abs)) {
    return { chars: 0, path: norm, present: false };
  }
  try {
    const content = readFileSync(abs, 'utf8');
    return { chars: content.length, path: norm, present: true };
  } catch {
    return { chars: 0, path: norm, present: false };
  }
}

/**
 * @param {string} projectRoot
 * @returns {{
 *   agentsChars: number,
 *   carryoverChars: number,
 *   stateChars: number,
 *   pathsSampled: string[],
 * }}
 */
export function sampleContextCostInputs(projectRoot) {
  const paths = resolvePaths(projectRoot);
  /** @type {string[]} */
  const pathsSampled = [];

  const agentsRel = 'AGENTS.md';
  const agents = sampleRelFile(projectRoot, agentsRel);
  if (agents.present) pathsSampled.push(agents.path);

  const carryoverRel = relative(projectRoot, resolveCarryoverPath(projectRoot)).replace(/\\/g, '/');
  const carryover = sampleRelFile(projectRoot, carryoverRel);
  if (carryover.present) pathsSampled.push(carryover.path);

  const stateRel = paths.state.replace(/\\/g, '/');
  const state = sampleRelFile(projectRoot, stateRel);
  if (state.present) pathsSampled.push(state.path);

  return {
    agentsChars: agents.chars,
    carryoverChars: carryover.chars,
    stateChars: state.chars,
    pathsSampled,
  };
}

/**
 * @param {string} projectRoot
 * @returns {{ record: ReturnType<typeof buildSessionStartCostRecord>, appended: boolean, path: string }}
 */
export function refreshContextCost(projectRoot) {
  const sampled = sampleContextCostInputs(projectRoot);
  const record = buildSessionStartCostRecord({
    projectRoot,
    agentsChars: sampled.agentsChars,
    carryoverChars: sampled.carryoverChars,
    stateChars: sampled.stateChars,
    pathsSampled: sampled.pathsSampled,
  });
  const appended = appendContextCost(projectRoot, record);
  return { record, appended, path: resolveContextCostPath(projectRoot) };
}

/**
 * @param {string[]} argv
 * @param {{ projectRoot?: string, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream }} [opts]
 * @returns {number}
 */
export function runContextCostRefresh(argv, opts = {}) {
  const stdout = opts.stdout || process.stdout;

  if (argv.includes('--help') || argv.includes('-h')) {
    stdout.write(`${HELP}\n`);
    return 0;
  }

  const projectRoot = resolve(opts.projectRoot || process.env.MIDAS_PROJECT_ROOT || process.cwd());
  const isHook = argv.includes('--hook');

  let result;
  try {
    result = refreshContextCost(projectRoot);
  } catch {
    // fail-open — always exit 0
  }

  if (isHook) {
    stdout.write(`${JSON.stringify({ continue: true })}\n`);
    return 0;
  }

  if (result) {
    const { record, appended, path } = result;
    stdout.write(
      `${JSON.stringify({
        ok: true,
        appended,
        path,
        approx_tokens: record.approx_tokens,
        paths_sampled: record.paths_sampled,
      })}\n`,
    );
  }

  return 0;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runContextCostRefresh(process.argv.slice(2)));
}
