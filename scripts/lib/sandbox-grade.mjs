// sandbox-grade.mjs — deterministic oracles for /midas-sandbox (engine only).
// Composer does not grade its own homework: this module reads the fixture disk.

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  inspectSandboxEnv,
  isPathInside,
  readSandboxBaseline,
  sha256File,
} from './sandbox-env.mjs';
import { resolvePaths } from '../paths.mjs';

export const LEDGER_REL = join('sandbox', 'findings', '_ledger.jsonl');

/**
 * @param {string} yaml
 * @param {string} field
 */
function topLevelScalar(yaml, field) {
  const re = new RegExp(`^${field}:\\s*(.+)\\s*$`, 'm');
  const m = yaml.match(re);
  if (!m) return '';
  return m[1].replace(/#.*$/, '').trim().replace(/^["']|["']$/g, '');
}

/**
 * @param {string} skill
 * @param {string} oracleRoot
 */
export function loadOracleDoc(skill, oracleRoot) {
  const abs = join(oracleRoot, `${skill}.json`);
  if (!existsSync(abs)) return { skill, checks: [], missing: true, path: abs };
  try {
    const doc = JSON.parse(readFileSync(abs, 'utf8'));
    const checks = Array.isArray(doc.checks) ? doc.checks : [];
    return { skill: doc.skill || skill, checks, missing: false, path: abs };
  } catch (err) {
    return { skill, checks: [], missing: true, path: abs, error: String(err) };
  }
}

/**
 * @param {string} template
 * @param {Record<string, string>} tokens
 */
function subst(template, tokens) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (key in tokens ? tokens[key] : `{${key}}`));
}

/**
 * @returns {{ id: string, ok: boolean, detail: string }}
 */
function runCheck(check, ctx) {
  const id = String(check.id || check.type || 'check');
  const type = String(check.type || '');
  try {
    if (type === 'env_ok') {
      return { id, ok: ctx.env.ok === true, detail: ctx.env.error || 'env ok' };
    }
    if (type === 'engine_state_untouched') {
      if (!ctx.baseline?.engineStateSha256) {
        return { id, ok: false, detail: 'missing sandbox-baseline.json — run reset' };
      }
      const now = sha256File(ctx.engineStateAbs);
      const ok = now !== '' && now === ctx.baseline.engineStateSha256;
      return {
        id,
        ok,
        detail: ok
          ? 'engine harness/state.yaml hash matches reset'
          : 'engine harness/state.yaml changed since reset',
      };
    }
    if (type === 'engine_name') {
      const name = topLevelScalar(ctx.engineYaml, 'name');
      const want = String(check.value || 'harness');
      return { id, ok: name === want, detail: `engine name=${name} want=${want}` };
    }
    if (type === 'state_match') {
      const field = String(check.field || '');
      const want = String(check.value ?? '');
      const got = topLevelScalar(ctx.fixtureYaml, field);
      return { id, ok: Boolean(field) && got === want, detail: `${field}=${got} want=${want}` };
    }
    if (type === 'file_exists' || type === 'file_contains' || type === 'file_not_contains') {
      const rel = subst(check.path, ctx.tokens);
      const abs = resolve(ctx.work, rel);
      if (!isPathInside(ctx.work, abs)) {
        return { id, ok: false, detail: `path escapes working copy: ${abs}` };
      }
      if (type === 'file_exists') {
        return { id, ok: existsSync(abs), detail: rel };
      }
      if (!existsSync(abs)) return { id, ok: false, detail: `missing ${rel}` };
      const text = readFileSync(abs, 'utf8');
      const pattern = String(check.pattern || '');
      const hit = text.includes(pattern);
      if (type === 'file_contains') {
        return { id, ok: hit, detail: hit ? `found in ${rel}` : `missing ${JSON.stringify(pattern)} in ${rel}` };
      }
      return { id, ok: !hit, detail: hit ? `forbidden ${JSON.stringify(pattern)} in ${rel}` : `absent in ${rel}` };
    }
    return { id, ok: false, detail: `unknown check type ${type}` };
  } catch (err) {
    return { id, ok: false, detail: String(err) };
  }
}

/**
 * Isolation ids that flip isolation=fail (not just overall verdict).
 * Keep in sync with sandbox/oracles/isolation.json `id` fields.
 */
const ISOLATION_IDS = new Set(['env', 'engine-untouched', 'engine-name', 'name']);

/**
 * @param {{ root: string, skill?: string, ledger?: boolean, ledgerPath?: string }} opts
 */
export function gradeSandbox(opts) {
  const root = opts.root;
  const skill = String(opts.skill || 'isolation');
  const env = inspectSandboxEnv(root);
  const work = env.work;
  const engineStateAbs = join(root, 'harness', 'state.yaml');
  const baseline = readSandboxBaseline(work);
  const fixtureYaml = env.state && existsSync(env.state) ? readFileSync(env.state, 'utf8') : '';
  const engineYaml = existsSync(engineStateAbs) ? readFileSync(engineStateAbs, 'utf8') : '';
  const paths = existsSync(join(work, '.harness', 'state.yaml')) ? resolvePaths(work) : {};
  const tokens = {
    product: paths.product || '.harness/product',
    state: paths.state || '.harness/state.yaml',
    runs: paths.runs || '.harness/runs',
    rules: paths.rules || '.harness/rules',
    cache: paths.cache || '.harness/cache',
  };
  const ctx = { env, work, baseline, engineStateAbs, fixtureYaml, engineYaml, tokens };
  const oracleRoot = join(root, 'sandbox', 'oracles');
  const isolationDoc = loadOracleDoc('isolation', oracleRoot);
  const skillDoc = skill === 'isolation' ? { checks: [], missing: false } : loadOracleDoc(skill, oracleRoot);
  const checks = [];
  if (isolationDoc.missing) {
    checks.push({ id: 'oracle-isolation-file', ok: false, detail: `missing ${isolationDoc.path}` });
  } else {
    for (const c of isolationDoc.checks) checks.push(runCheck(c, ctx));
  }
  if (skill !== 'isolation') {
    if (skillDoc.missing) {
      checks.push({
        id: `oracle-${skill}-file`,
        ok: false,
        detail: skillDoc.error || `no oracle for skill ${skill} at ${skillDoc.path}`,
      });
    } else {
      for (const c of skillDoc.checks) checks.push(runCheck(c, ctx));
    }
  }
  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;
  const isolationFail = checks.some((c) => !c.ok && ISOLATION_IDS.has(c.id));
  const isolation = env.ok && !isolationFail ? 'ok' : 'fail';
  const ok = fail === 0 && env.ok;
  const tally =
    `MIDAS_SANDBOX_ORACLE: skill=${skill} isolation=${isolation} checks=${checks.length} ` +
    `pass=${pass} fail=${fail} verdict=${ok ? 'pass' : 'fail'}`;
  if (opts.ledger) {
    const ledgerPath = opts.ledgerPath || join(root, LEDGER_REL);
    mkdirSync(join(root, 'sandbox', 'findings'), { recursive: true });
    appendFileSync(
      ledgerPath,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        skill,
        isolation,
        verdict: ok ? 'pass' : 'fail',
        pass,
        fail,
        checks: checks.length,
      })}\n`,
      'utf8',
    );
  }
  return { ok, isolation, skill, checks, pass, fail, tally };
}

/**
 * @param {{ ok: boolean, tally: string, checks: { id: string, ok: boolean, detail: string }[], fail: number }} result
 */
export function printGrade(result, stdout, stderr) {
  stdout.write(`${result.tally}\n`);
  for (const c of result.checks) {
    stdout.write(`  ${c.ok ? 'ok' : 'FAIL'}  ${c.id} — ${c.detail}\n`);
  }
  if (!result.ok) stderr.write(`sandbox-run grade: ${result.fail} check(s) failed\n`);
}
