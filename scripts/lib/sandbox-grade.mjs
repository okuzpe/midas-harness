// sandbox-grade.mjs — deterministic oracles for /midas-sandbox (engine only).
// Composer does not grade its own homework: this module reads the fixture disk.

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  inspectSandboxEnv,
  isPathInside,
  readSandboxBaseline,
  sha256File,
  sha256Tree,
} from './sandbox-env.mjs';
import { resolvePaths } from '../paths.mjs';

export const LEDGER_REL = join('sandbox', 'findings', '_ledger.jsonl');

const ISOLATION_FILE_ID = 'oracle-isolation-file';

/**
 * Strip a leading slash so `--skill /idea-intake` matches `idea-intake.json`.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSkillName(raw) {
  return String(raw || '')
    .trim()
    .replace(/^\/+/, '');
}

/**
 * @param {string} yaml
 * @param {string} field dotted path (`mode`, `phases.idea_intake.status`)
 */
export function yamlPathScalar(yaml, field) {
  const parts = String(field || '')
    .split('.')
    .filter(Boolean);
  if (parts.length === 0) return '';
  const lines = yaml.split(/\r?\n/);
  let start = 0;
  for (let p = 0; p < parts.length; p++) {
    const wantIndent = p * 2;
    const key = parts[p].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyRe = new RegExp(`^ {${wantIndent}}${key}:\\s*(.*)$`);
    let found = false;
    for (let i = start; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || /^\s*#/.test(line)) continue;
      const indent = (line.match(/^ */) || [''])[0].length;
      if (indent < wantIndent) break;
      if (indent !== wantIndent) continue;
      const m = line.match(keyRe);
      if (!m) continue;
      found = true;
      const rest = m[1].replace(/#.*$/, '').trim().replace(/^["']|["']$/g, '');
      if (p === parts.length - 1) return rest;
      start = i + 1;
      break;
    }
    if (!found) return '';
  }
  return '';
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
 * Isolation check ids from isolation.json, plus the missing-file sentinel.
 * @param {{ missing: boolean, checks: { id?: string, type?: string }[] }} isolationDoc
 */
export function isolationCheckIds(isolationDoc) {
  const ids = new Set();
  if (isolationDoc.missing) {
    ids.add(ISOLATION_FILE_ID);
    return ids;
  }
  for (const c of isolationDoc.checks) {
    ids.add(String(c.id || c.type || ''));
  }
  return ids;
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
    if (type === 'engine_tree_untouched') {
      const tree = String(check.tree || '');
      const key = tree === 'skills' ? 'engineSkillsSha256' : tree === 'rules' ? 'engineRulesSha256' : '';
      const dir = tree === 'skills' || tree === 'rules' ? join(ctx.root, 'harness', tree) : '';
      if (!key || !dir) {
        return { id, ok: false, detail: `unknown engine tree ${JSON.stringify(tree)}` };
      }
      if (!ctx.baseline?.[key]) {
        return { id, ok: false, detail: 'missing sandbox-baseline.json tree hash — run reset' };
      }
      const now = sha256Tree(dir);
      const ok = now !== '' && now === ctx.baseline[key];
      return {
        id,
        ok,
        detail: ok
          ? `engine harness/${tree} hash matches reset`
          : `engine harness/${tree} changed since reset`,
      };
    }
    if (type === 'engine_name') {
      const name = yamlPathScalar(ctx.engineYaml, 'name');
      const want = String(check.value || 'harness');
      return { id, ok: name === want, detail: `engine name=${name} want=${want}` };
    }
    if (type === 'state_match' || type === 'state_not_match') {
      const field = String(check.field || '');
      const want = String(check.value ?? '');
      const got = yamlPathScalar(ctx.fixtureYaml, field);
      const equal = Boolean(field) && got === want;
      const ok = type === 'state_match' ? equal : Boolean(field) && !equal;
      return { id, ok, detail: `${field}=${got} want${type === 'state_not_match' ? '≠' : '='}${want}` };
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
 * @param {{
 *   root: string,
 *   skill?: string,
 *   ledger?: boolean,
 *   ledgerPath?: string,
 *   missing?: 'fail' | 'skip',
 * }} opts
 */
export function gradeSandbox(opts) {
  const root = opts.root;
  const skill = normalizeSkillName(opts.skill || 'isolation') || 'isolation';
  const missingMode = opts.missing === 'skip' ? 'skip' : 'fail';
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
  const ctx = { root, env, work, baseline, engineStateAbs, fixtureYaml, engineYaml, tokens };
  const oracleRoot = join(root, 'sandbox', 'oracles');
  const isolationDoc = loadOracleDoc('isolation', oracleRoot);
  const skillDoc = skill === 'isolation' ? { checks: [], missing: false } : loadOracleDoc(skill, oracleRoot);
  const isolationIds = isolationCheckIds(isolationDoc);
  const checks = [];
  if (isolationDoc.missing) {
    checks.push({ id: ISOLATION_FILE_ID, ok: false, detail: `missing ${isolationDoc.path}` });
  } else {
    for (const c of isolationDoc.checks) checks.push(runCheck(c, ctx));
  }
  if (skill !== 'isolation') {
    if (skillDoc.missing) {
      if (missingMode === 'skip') {
        checks.push({
          id: `oracle-${skill}-file`,
          ok: true,
          detail: `no oracle for skill ${skill} — skipped (--missing skip)`,
        });
      } else {
        checks.push({
          id: `oracle-${skill}-file`,
          ok: false,
          detail: skillDoc.error || `no oracle for skill ${skill} at ${skillDoc.path}`,
        });
      }
    } else {
      for (const c of skillDoc.checks) checks.push(runCheck(c, ctx));
    }
  }
  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;
  const isolationFail = checks.some((c) => !c.ok && isolationIds.has(c.id));
  const isolation = env.ok && !isolationFail ? 'ok' : 'fail';
  const ok = fail === 0 && env.ok;
  const failIds = checks.filter((c) => !c.ok).map((c) => c.id);
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
        fail_ids: failIds,
      })}\n`,
      'utf8',
    );
  }
  return { ok, isolation, skill, checks, pass, fail, tally, failIds };
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
