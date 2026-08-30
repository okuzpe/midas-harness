// sandbox-env.mjs — isolation floor for /midas-sandbox (engine only).

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from '../paths.mjs';
import { walkFiles } from './walk.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');
export const SEED = join(ROOT, 'sandbox', 'seed');
export const WORK = join(ROOT, 'sandbox', 'example-product');
export const EXPECTED_NAME = 'sandbox-example';
export const BASELINE_REL = join('.harness', 'cache', 'sandbox-baseline.json');

const INSIDE_KEYS = Object.freeze(['state', 'product', 'rules', 'runs', 'cache']);

/**
 * True when `abs` is `root` or a path under it (no `..` escape).
 * @param {string} root
 * @param {string} abs
 */
export function isPathInside(root, abs) {
  const rel = relative(resolve(root), resolve(abs));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * @param {string} abs
 * @returns {string}
 */
export function sha256File(abs) {
  if (!existsSync(abs)) return '';
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

/**
 * Deterministic content hash of every file under `absDir` (posix-relative paths, sorted).
 * Empty / missing dir → `''`.
 * @param {string} absDir
 * @returns {string}
 */
export function sha256Tree(absDir) {
  if (!existsSync(absDir)) return '';
  const rels = walkFiles(absDir, { relativeTo: absDir });
  const lines = rels.map((rel) => `${rel.replace(/\\/g, '/')}\0${sha256File(join(absDir, rel))}`);
  lines.sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

/**
 * @param {string} statePath
 * @returns {string}
 */
function readNameFromStateFile(statePath) {
  if (!existsSync(statePath)) return '';
  const m = readFileSync(statePath, 'utf8').match(/^name:\s*(\S+)/m);
  return m ? m[1].trim() : '';
}

/**
 * Snapshot engine state + authored skills/rules so grade can detect isolation leaks.
 * @param {string} root
 * @param {string} work
 */
export function writeSandboxBaseline(root, work) {
  mkdirSync(join(work, '.harness', 'cache'), { recursive: true });
  const payload = {
    engineStateSha256: sha256File(join(root, 'harness', 'state.yaml')),
    engineSkillsSha256: sha256Tree(join(root, 'harness', 'skills')),
    engineRulesSha256: sha256Tree(join(root, 'harness', 'rules')),
    resetAt: new Date().toISOString(),
  };
  writeFileSync(join(work, BASELINE_REL), `${JSON.stringify(payload)}\n`, 'utf8');
}

/**
 * @param {string} work
 * @returns {{
 *   engineStateSha256?: string,
 *   engineSkillsSha256?: string,
 *   engineRulesSha256?: string,
 *   resetAt?: string,
 * } | null}
 */
export function readSandboxBaseline(work) {
  const abs = join(work, BASELINE_REL);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Copy seed → working copy (wipe first) and write isolation baseline.
 * @returns {{ ok: boolean, work: string, error?: string }}
 */
export function resetSandbox(root = ROOT) {
  const seed = join(root, 'sandbox', 'seed');
  const work = join(root, 'sandbox', 'example-product');
  if (!existsSync(join(seed, '.harness', 'state.yaml'))) {
    return { ok: false, work, error: `missing seed state at ${join(seed, '.harness', 'state.yaml')}` };
  }
  rmSync(work, { recursive: true, force: true });
  mkdirSync(dirname(work), { recursive: true });
  cpSync(seed, work, { recursive: true });
  writeSandboxBaseline(root, work);
  return { ok: true, work };
}

/**
 * Resolve and validate isolation: fixture name from resolved state, lifecycle paths inside
 * the working copy, engine/scripts pointing at this repo.
 * @returns {{ ok: boolean, name: string, state: string, engine: string, scripts: string, product: string, work: string, midasTraceRoot: string, error?: string }}
 */
export function inspectSandboxEnv(root = ROOT) {
  const work = join(root, 'sandbox', 'example-product');
  const empty = {
    ok: false,
    name: '',
    state: '',
    engine: '',
    scripts: '',
    product: '',
    work,
    midasTraceRoot: work,
  };
  if (!existsSync(join(work, '.harness', 'state.yaml'))) {
    return { ...empty, error: 'working copy missing — run `node scripts/sandbox-run.mjs reset`' };
  }
  const paths = resolvePaths(work);
  const engineAbs = resolve(work, paths.engine);
  const scriptsAbs = resolve(work, paths.scripts);
  const wantEngine = resolve(root, 'harness');
  const wantScripts = resolve(root, 'scripts');
  const resolved = {};
  for (const key of INSIDE_KEYS) {
    const raw = paths[key];
    if (!raw) {
      return { ...empty, engine: engineAbs, scripts: scriptsAbs, error: `isolation fail missing paths.${key}` };
    }
    resolved[key] = resolve(work, raw);
  }
  const leaked = INSIDE_KEYS.filter((key) => !isPathInside(work, resolved[key]));
  const name = leaked.includes('state') ? '' : readNameFromStateFile(resolved.state);
  const ok =
    leaked.length === 0 &&
    name === EXPECTED_NAME &&
    engineAbs === wantEngine &&
    scriptsAbs === wantScripts;
  let error;
  if (!ok) {
    if (leaked.length) {
      error = `isolation fail paths outside working copy: ${leaked.map((k) => `${k}=${resolved[k]}`).join(' ')}`;
    } else {
      error =
        `isolation fail name=${name} engine=${engineAbs} scripts=${scriptsAbs} ` +
        `(want name=${EXPECTED_NAME} engine=${wantEngine} scripts=${wantScripts})`;
    }
  }
  return {
    ok,
    name,
    state: resolved.state,
    engine: engineAbs,
    scripts: scriptsAbs,
    product: resolved.product,
    work,
    midasTraceRoot: work,
    error,
  };
}
