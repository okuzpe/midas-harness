// sandbox-env.mjs — isolation floor for /midas-sandbox (engine only).

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from '../paths.mjs';
import { parseStateScalar } from '../yaml-lite.mjs';
import { walkFiles } from './walk.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');
export const SEED = join(ROOT, 'sandbox', 'seed');
export const WORK = join(ROOT, 'sandbox', 'example-product');
export const WORK_INSTALL = join(ROOT, 'sandbox', 'example-install');
export const EXPECTED_NAME = 'sandbox-example';
export const BASELINE_REL = join('.harness', 'cache', 'sandbox-baseline.json');
export const ENV_POINTER_REL = join('.harness', 'cache', 'sandbox-env.json');

const INSIDE_KEYS = Object.freeze(['state', 'product', 'rules', 'runs', 'cache']);
const PROFILES = Object.freeze(['pipeline', 'capture', 'install']);

/**
 * @param {unknown} raw
 * @returns {'pipeline'|'capture'|'install'}
 */
export function normalizeSandboxProfile(raw) {
  const p = String(raw || 'pipeline')
    .trim()
    .toLowerCase();
  if (p === 'capture' || p === 'blank-idea') return 'capture';
  if (p === 'install') return 'install';
  return 'pipeline';
}

/**
 * @param {string[]} argv
 * @returns {{ profile: 'pipeline'|'capture'|'install' }}
 */
export function parseSandboxProfileArgs(argv) {
  let profile = 'pipeline';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--blank-idea') {
      profile = 'capture';
      continue;
    }
    if (arg === '--profile') {
      const v = argv[i + 1];
      if (v && !v.startsWith('--')) {
        profile = normalizeSandboxProfile(v);
        i += 1;
      }
      continue;
    }
    if (arg.startsWith('--profile=')) profile = normalizeSandboxProfile(arg.slice('--profile='.length));
  }
  return { profile };
}

/**
 * @param {string} root
 * @param {string} [profile]
 */
export function workDirForProfile(root, profile) {
  return normalizeSandboxProfile(profile) === 'install'
    ? join(root, 'sandbox', 'example-install')
    : join(root, 'sandbox', 'example-product');
}

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
  const fixtureState = join(work, '.harness', 'state.yaml');
  const fixtureYaml = existsSync(fixtureState) ? readFileSync(fixtureState, 'utf8') : '';
  const payload = {
    engineStateSha256: sha256File(join(root, 'harness', 'state.yaml')),
    engineSkillsSha256: sha256Tree(join(root, 'harness', 'skills')),
    engineRulesSha256: sha256Tree(join(root, 'harness', 'rules')),
    fixtureUpdated: parseStateScalar(fixtureYaml, 'updated') || '',
    fixtureStateSha256: sha256File(fixtureState),
    resetAt: new Date().toISOString(),
  };
  writeFileSync(join(work, BASELINE_REL), `${JSON.stringify(payload)}\n`, 'utf8');
}

/**
 * Disk pointer for Cursor Task (no cwd/env inheritance). Residual: Task still must Read this file.
 * @param {{ work: string, midasTraceRoot?: string, name?: string, profile?: string }} info
 */
export function writeSandboxEnvPointer(info) {
  if (!info?.work) return;
  mkdirSync(join(info.work, '.harness', 'cache'), { recursive: true });
  const payload = {
    MIDAS_TRACE_ROOT: info.midasTraceRoot || info.work,
    work: info.work,
    name: info.name || '',
    profile: normalizeSandboxProfile(info.profile),
  };
  writeFileSync(join(info.work, ENV_POINTER_REL), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/**
 * @param {string} work
 * @returns {{
 *   engineStateSha256?: string,
 *   engineSkillsSha256?: string,
 *   engineRulesSha256?: string,
 *   fixtureUpdated?: string,
 *   fixtureStateSha256?: string,
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
 * Overlay `{product}/idea.md` with the blank Phase-0 template (capture signal).
 * @param {string} root
 * @param {string} work
 */
function applyCaptureOverlay(root, work) {
  const tmpl = join(root, 'harness', 'templates', 'idea.md');
  if (!existsSync(tmpl)) {
    return { ok: false, error: `missing idea template at ${tmpl}` };
  }
  const ideaPath = join(work, '.harness', 'product', 'idea.md');
  mkdirSync(dirname(ideaPath), { recursive: true });
  writeFileSync(ideaPath, readFileSync(tmpl, 'utf8').replaceAll('{{PROJECT_NAME}}', 'Chorechip'), 'utf8');
  return { ok: true };
}

/**
 * Installer writes `name:` from the folder basename; sandbox isolation requires sandbox-example.
 * @param {string} work
 */
function overlayInstallIdentity(work) {
  const statePath = join(work, '.harness', 'state.yaml');
  if (!existsSync(statePath)) return;
  const yaml = readFileSync(statePath, 'utf8').replace(/^name:\s*\S+/m, `name: ${EXPECTED_NAME}`);
  writeFileSync(statePath, yaml, 'utf8');
}

/**
 * Nested product install (`paths.engine=.harness/engine`) for reconcile/update — not the pipeline seed.
 * @param {string} root
 */
function resetInstallSandbox(root) {
  const work = join(root, 'sandbox', 'example-install');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(dirname(work), { recursive: true });
  const installer = join(root, 'cli', 'index.mjs');
  if (!existsSync(installer)) {
    return { ok: false, work, error: `missing installer at ${installer}` };
  }
  const spawned = spawnSync(process.execPath, [installer, '--yes', '--force', '--tools=cursor', work], {
    cwd: root,
    encoding: 'utf8',
  });
  if (spawned.status !== 0) {
    const detail = `${spawned.stderr || ''}\n${spawned.stdout || ''}`.trim();
    return {
      ok: false,
      work,
      error: `nested install failed (exit ${spawned.status})${detail ? `: ${detail.slice(0, 800)}` : ''}`,
    };
  }
  if (!existsSync(join(work, '.harness', 'engine', 'VERSION'))) {
    return { ok: false, work, error: 'nested install wrote no .harness/engine/VERSION' };
  }
  overlayInstallIdentity(work);
  writeSandboxBaseline(root, work);
  writeSandboxEnvPointer({ work, midasTraceRoot: work, name: EXPECTED_NAME, profile: 'install' });
  return { ok: true, work, profile: 'install' };
}

/**
 * Copy seed → working copy (wipe first) and write isolation baseline.
 * @param {string} [root]
 * @param {{ profile?: string }} [opts]
 * @returns {{ ok: boolean, work: string, profile?: string, error?: string }}
 */
export function resetSandbox(root = ROOT, opts = {}) {
  const profile = normalizeSandboxProfile(opts.profile);
  if (profile === 'install') return resetInstallSandbox(root);
  const seed = join(root, 'sandbox', 'seed');
  const work = join(root, 'sandbox', 'example-product');
  if (!existsSync(join(seed, '.harness', 'state.yaml'))) {
    return { ok: false, work, profile, error: `missing seed state at ${join(seed, '.harness', 'state.yaml')}` };
  }
  rmSync(work, { recursive: true, force: true });
  mkdirSync(dirname(work), { recursive: true });
  cpSync(seed, work, { recursive: true });
  if (profile === 'capture') {
    const overlay = applyCaptureOverlay(root, work);
    if (!overlay.ok) return { ok: false, work, profile, error: overlay.error };
  }
  writeSandboxBaseline(root, work);
  writeSandboxEnvPointer({ work, midasTraceRoot: work, name: EXPECTED_NAME, profile });
  return { ok: true, work, profile };
}

function emptyInspect(work, profile) {
  return {
    ok: false,
    name: '',
    state: '',
    engine: '',
    scripts: '',
    product: '',
    work,
    midasTraceRoot: work,
    profile,
  };
}

/**
 * Resolve and validate isolation: fixture name from resolved state, lifecycle paths inside
 * the working copy. Pipeline/capture: engine/scripts point at this repo. Install: both live
 * inside the working copy (real nested vendor tree).
 * @param {string} [root]
 * @param {{ profile?: string }} [opts]
 * @returns {{ ok: boolean, name: string, state: string, engine: string, scripts: string, product: string, work: string, midasTraceRoot: string, profile: string, error?: string }}
 */
export function inspectSandboxEnv(root = ROOT, opts = {}) {
  const profile = normalizeSandboxProfile(opts.profile);
  const work = workDirForProfile(root, profile);
  const empty = emptyInspect(work, profile);
  if (!existsSync(join(work, '.harness', 'state.yaml'))) {
    const hint =
      profile === 'install'
        ? 'node scripts/sandbox-run.mjs reset --profile install'
        : 'node scripts/sandbox-run.mjs reset';
    return { ...empty, error: `working copy missing — run \`${hint}\`` };
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
  let ok = leaked.length === 0 && name === EXPECTED_NAME;
  if (profile === 'install') {
    ok = ok && isPathInside(work, engineAbs) && isPathInside(work, scriptsAbs);
  } else {
    ok = ok && engineAbs === wantEngine && scriptsAbs === wantScripts;
  }
  let error;
  if (!ok) {
    if (leaked.length) {
      error = `isolation fail paths outside working copy: ${leaked.map((k) => `${k}=${resolved[k]}`).join(' ')}`;
    } else if (profile === 'install') {
      error =
        `isolation fail name=${name} engine=${engineAbs} scripts=${scriptsAbs} ` +
        `(want name=${EXPECTED_NAME} engine+scripts inside ${work})`;
    } else {
      error =
        `isolation fail name=${name} engine=${engineAbs} scripts=${scriptsAbs} ` +
        `(want name=${EXPECTED_NAME} engine=${wantEngine} scripts=${wantScripts})`;
    }
  }
  const info = {
    ok,
    name,
    state: resolved.state,
    engine: engineAbs,
    scripts: scriptsAbs,
    product: resolved.product,
    work,
    midasTraceRoot: work,
    profile,
    error,
  };
  if (ok) writeSandboxEnvPointer(info);
  return info;
}

export { PROFILES };
