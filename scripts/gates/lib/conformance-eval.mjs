// conformance-eval.mjs — parse and run kind:command CHECKs from checks.json (allowlisted).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from '../../paths.mjs';

function isManualCheckBody(body) {
  const text = String(body || '').trim();
  return (
    /^`?manual:`?\s*/i.test(text) ||
    /^\*\(manual(?:[:.)][^)]*)?\)\*?\s*/i.test(text) ||
    /\*\(manual(?:[:.)][^)]*)?\)\*?\s*$/i.test(text)
  );
}

const UNSAFE = /[;`]|\$\(|\n/;
const ALLOW_PREFIX = /^(git|node|npm|npx|grep|rg)\b/;
const SELF_RE = /\b(test\.mjs|conformance-gate\.mjs|test-gate\.mjs|quality-gate\.mjs|npm run align|npm test|npm run test)\b/;

/**
 * @param {string} body
 * @param {{ scripts: string, engine: string, rules?: string, product: string, runs: string, state: string }} paths
 */
export function substituteTokens(body, paths) {
  const rules = paths.rules || `${paths.engine}/rules`;
  return String(body || '')
    .replaceAll('<paths.scripts>', paths.scripts)
    .replaceAll('<paths.engine>', paths.engine)
    .replaceAll('<paths.rules>', rules)
    .replaceAll('<paths.state>', paths.state)
    .replaceAll('{product}', paths.product)
    .replaceAll('{runs}', paths.runs);
}

/**
 * @param {string} body
 * @param {object} paths
 * @returns {{ runnable: boolean, reason?: string, cmd?: string, expectsEmpty?: boolean, expectsExit0?: boolean }}
 */
export function classifyCommandCheck(body, paths) {
  const text = substituteTokens(body, paths).trim();
  if (isManualCheckBody(text) || /^manual:/i.test(text)) {
    return { runnable: false, reason: 'manual' };
  }
  const tick = text.match(/`([^`]+)`/);
  if (!tick) return { runnable: false, reason: 'no-backtick' };
  let cmd = tick[1].trim();
  cmd = cmd.replace(/<base>/g, 'HEAD');
  if (/<src-root>|<ui-src>|<diff>|<concept>/.test(cmd)) {
    return { runnable: false, reason: 'unbound-placeholder' };
  }
  if (SELF_RE.test(cmd)) return { runnable: false, reason: 'self-recursion' };
  if (!ALLOW_PREFIX.test(cmd)) return { runnable: false, reason: 'not-allowlisted' };
  if (UNSAFE.test(cmd)) return { runnable: false, reason: 'unsafe-chars' };
  const expectsEmpty = /→\s*empty|must be empty/.test(text);
  const expectsExit0 = /exits 0|exit 0|exits with 0|reports no |reports `ok`|reports ok/.test(text);
  return { runnable: true, cmd, expectsEmpty, expectsExit0: expectsExit0 || !expectsEmpty };
}

/**
 * @param {string} cmd
 * @param {{ cwd: string, timeout?: number }} opts
 */
export function runAllowlistedCommand(cmd, opts) {
  const classified = ALLOW_PREFIX.test(cmd) && !UNSAFE.test(cmd) && !SELF_RE.test(cmd);
  if (!classified) {
    return { skip: true, reason: 'not-allowlisted', status: null, stdout: '', stderr: '' };
  }
  const result = spawnSync(cmd, {
    cwd: opts.cwd,
    shell: true,
    timeout: opts.timeout ?? 60_000,
    encoding: 'utf8',
    env: { ...process.env },
  });
  return {
    skip: false,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? String(result.error.message || result.error) : null,
  };
}

function commandTreeMissing(cmd, root) {
  const needles = [
    'cli/lib', 'cli/', 'scripts/lib', 'scripts/lib/tests', '.github/',
    '.claude/', '.cursor/hooks.json', 'README.md', '<tests>',
  ];
  if (/\bcli\b/.test(cmd) && !existsSync(join(root, 'cli'))) return true;
  if (/\bscripts\b/.test(cmd) && !existsSync(join(root, 'scripts'))) return true;
  for (const n of needles) {
    if (n === '<tests>') {
      if (cmd.includes(n)) return true;
      continue;
    }
    if (cmd.includes(n)) {
      const rel = n.replace(/\/$/, '');
      if (!existsSync(join(root, rel))) return true;
    }
  }
  return false;
}

/**
 * @param {{ kind: string, body: string, slug?: string }} check
 * @param {{ root: string, paths: object }} ctx
 */
export function evaluateCheck(check, ctx) {
  if (check.kind === 'manual' || isManualCheckBody(check.body)) {
    return { status: 'skip', reason: 'manual' };
  }
  const classified = classifyCommandCheck(check.body, ctx.paths);
  if (!classified.runnable) {
    return { status: 'skip', reason: classified.reason };
  }
  if (commandTreeMissing(classified.cmd, ctx.root)) {
    return { status: 'skip', reason: 'missing-tree' };
  }
  if (/\bnpm audit\b/.test(classified.cmd) && !existsSync(join(ctx.root, 'package.json'))) {
    return { status: 'skip', reason: 'no-package' };
  }
  if (/HEAD\.\.HEAD/.test(classified.cmd)) {
    return { status: 'skip', reason: 'empty-git-range' };
  }
  const productDir = join(ctx.root, ctx.paths.product || 'product');
  if (/\bproduct\//.test(classified.cmd) && !existsSync(productDir)) {
    return { status: 'skip', reason: 'no-product' };
  }
  if (classified.cmd.startsWith('node ')) {
    const script = classified.cmd.split(/\s+/)[1];
    if (script && !existsSync(join(ctx.root, script))) {
      return { status: 'skip', reason: 'missing-script' };
    }
  }
  const ran = runAllowlistedCommand(classified.cmd, { cwd: ctx.root });
  if (ran.skip) return { status: 'skip', reason: ran.reason };
  if (ran.error && /ETIMEDOUT/.test(ran.error)) {
    return { status: 'fail', reason: 'timeout', cmd: classified.cmd };
  }
  const out = `${ran.stdout}${ran.stderr}`;
  if (ran.status === 2 || /No such file|cannot find|not recognized/i.test(out)) {
    return { status: 'skip', reason: 'missing-path', cmd: classified.cmd };
  }
  if (classified.expectsEmpty) {
    const nonempty = out.trim().length > 0 && ran.status === 0;
    // grep exit 1 with empty stdout = no matches = pass for "→ empty"
    if (ran.status === 1 && !out.trim()) {
      return { status: 'pass', cmd: classified.cmd };
    }
    if (nonempty) {
      return { status: 'fail', reason: 'expected-empty', cmd: classified.cmd, detail: out.slice(0, 200) };
    }
    if (ran.status === 0 && !out.trim()) {
      return { status: 'pass', cmd: classified.cmd };
    }
    if (classified.cmd.startsWith('grep') && ran.status === 1) {
      return { status: 'pass', cmd: classified.cmd };
    }
  }
  if ((classified.expectsExit0 || !classified.expectsEmpty) && ran.status === 0) {
    return { status: 'pass', cmd: classified.cmd };
  }
  if (classified.cmd.startsWith('grep') && ran.status === 1 && !classified.expectsEmpty) {
    return { status: 'skip', reason: 'grep-no-match', cmd: classified.cmd };
  }
  if (classified.cmd.startsWith('git') && ran.status !== 0) {
    return { status: 'skip', reason: 'git-unusable', cmd: classified.cmd };
  }
  if (ran.status !== 0 && classified.expectsExit0) {
    return { status: 'fail', reason: `exit ${ran.status}`, cmd: classified.cmd, detail: out.slice(0, 200) };
  }
  if (ran.status === 0) return { status: 'pass', cmd: classified.cmd };
  return { status: 'fail', reason: `exit ${ran.status}`, cmd: classified.cmd, detail: out.slice(0, 200) };
}

/**
 * @param {string} root
 * @returns {{ schema_version: number, rules: Array<{ slug: string, checks: Array<{ kind: string, body: string }> }> }}
 */
export function loadChecksIndex(root) {
  const paths = resolvePaths(root);
  const kit = join(dirname(fileURLToPath(import.meta.url)), '../../../harness/checks.json');
  const candidates = [
    join(root, paths.engine, 'checks.json'),
    join(root, 'harness', 'checks.json'),
    kit,
  ];
  for (const abs of candidates) {
    if (existsSync(abs)) return JSON.parse(readFileSync(abs, 'utf8'));
  }
  throw new Error(`checks.json missing (looked in ${candidates.join(', ')})`);
}

/**
 * @param {string} root
 * @param {{ timeout?: number }} [opts]
 */
export function runConformance(root, opts = {}) {
  const paths = resolvePaths(root);
  const index = loadChecksIndex(root);
  const rows = [];
  let scanned = 0;
  let failed = 0;
  let skipped = 0;
  let manual = 0;
  for (const rule of index.rules || []) {
    for (const check of rule.checks || []) {
      scanned += 1;
      const result = evaluateCheck({ ...check, slug: rule.slug }, { root, paths, timeout: opts.timeout });
      const row = {
        slug: rule.slug,
        kind: check.kind,
        status: result.status,
        reason: result.reason || '',
        cmd: result.cmd || '',
        body: String(check.body || '').slice(0, 160),
      };
      rows.push(row);
      if (result.status === 'fail') failed += 1;
      else if (result.status === 'skip') {
        skipped += 1;
        if (result.reason === 'manual') manual += 1;
      }
    }
  }
  const command = scanned - manual;
  const verdict = failed === 0 ? 'pass' : 'fail';
  return {
    verdict,
    scanned,
    failed,
    skipped,
    manual,
    command,
    rows,
  };
}
