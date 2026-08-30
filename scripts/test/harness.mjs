// harness.mjs — shared structural-test helpers and assertion counter.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, extname, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { splitSkillDocument, parseFrontmatter } from '../lib/frontmatter.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { HARNESS_ENGINE_ONLY_RELS } from '../engine-only.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PRODUCT_CLOSED = join(ROOT, 'scripts', 'fixtures', 'product-closed');
export const TEST_FAST = process.env.MIDAS_TEST_FAST === '1' || process.env.MIDAS_TEST_FAST === 'true';
export const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'inherit'];
export const RITUAL_GUARD = 'Run only when the user explicitly invokes';
export const RITUAL_CITE = 'skill-state-ritual.md';
export const skillsDir = join(ROOT, 'harness', 'skills');
export const agentsDir = join(ROOT, 'harness', 'agents');
export const snippetPath = join(ROOT, 'harness', 'templates', 'gitignore-midas.snippet');

let passed = 0;
const failures = [];

export function check(name, cond, detail) {
  if (cond) passed += 1;
  else failures.push(detail ? `${name} — ${detail}` : name);
}

export function results() {
  return { passed, failed: failures.length, failures: [...failures] };
}

export function reportAndExit() {
  const { passed: ok, failed, failures: list } = results();
  console.log(`midas test: ${ok} passed, ${failed} failed`);
  if (failed) {
    console.log('\nFailures:');
    for (const f of list) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('All structural invariants hold.');
  process.exit(0);
}

export function isHarnessEngineOnlyRel(rel) {
  const n = rel.replace(/\\/g, '/');
  return HARNESS_ENGINE_ONLY_RELS.some((ex) => n === ex || n.startsWith(`${ex}/`));
}

export function walk(dir) {
  return walkFiles(dir);
}

export function walkRelativeFiles(root, base = root) {
  return walkFiles(root, { relativeTo: base, exclude: [] });
}

export function treeDigest(root) {
  const hash = createHash('sha256');
  for (const rel of walkRelativeFiles(root)) {
    hash.update(rel.replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(readFileSync(join(root, rel)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function parsePortableSkill(text) {
  const parts = splitSkillDocument(text);
  if (!parts) return null;
  const parsed = parseFrontmatter(parts.frontmatter) || {};
  return { ...parsed, metadata: parsed.metadata || {} };
}

export function normalizePortableScalar(value) {
  const text = String(value ?? '').trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\\\\/g, '\\').replace(/\\"/g, '"');
  }
  if (text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

export function dirNames(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export function gitTrackedRelpaths() {
  try {
    return new Set(
      execSync('git ls-files -z', { cwd: ROOT, encoding: 'utf8' })
        .split('\0')
        .filter(Boolean)
        .map((p) => p.replace(/\\/g, '/')),
    );
  } catch {
    return null;
  }
}

export function ver(rel, json) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, 'utf8');
  return json ? JSON.parse(raw).version || null : raw.trim();
}

export const engineVersion = ver('harness/VERSION', false);
export const installer = readFileSync(join(ROOT, 'cli', 'index.mjs'), 'utf8');

export function agentModelT(name) {
  const p = join(agentsDir, name + '.md');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/^model:\s*([^\s#]+)/m);
  return m ? m[1] : null;
}

export function doctorOutput(fixtureRel) {
  const dr = join(ROOT, 'scripts', 'doctor.mjs');
  try {
    return execSync(`node "${dr}" "${join(ROOT, fixtureRel)}"`, { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || '');
  }
}

export function doctorExit(fixtureRel, flags = '') {
  const dr = join(ROOT, 'scripts', 'doctor.mjs');
  try {
    execSync(`node "${dr}" ${flags} "${join(ROOT, fixtureRel)}"`, { cwd: ROOT, stdio: 'pipe' });
    return 0;
  } catch (e) {
    return typeof e.status === 'number' ? e.status : 1;
  }
}
