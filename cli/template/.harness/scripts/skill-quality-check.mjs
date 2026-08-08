#!/usr/bin/env node
// skill-quality-check.mjs — report-only mechanical checks for skill-quality hard fails.
//
//   node scripts/skill-quality-check.mjs [dir]     scan canonical skills + agents (exit 1 on hard fail)
//   node scripts/skill-quality-check.mjs --staged  only staged harness/skills + harness/agents (strict-warns default)
//   node scripts/skill-quality-check.mjs --changed  working tree + staged canonical artifacts
//   node scripts/skill-quality-check.mjs --json     machine-readable report
//   node scripts/skill-quality-check.mjs --help
//
// Covers hard fails #1–#3 from docs/skill-quality-gate.md (frontmatter, description length, line cap)
// plus ritual-guard for disable-model-invocation skills, `recommended-model`/`harness-tier` drift,
// the `## Tier & delegation` section, and skills-catalog (docs/skills.md) membership. These four
// were `manual:` CHECKs in skill-quality.md / model-routing.md — mechanized here to cut review load
// without adding new scored rubric dimensions (see harness/rules/skill-quality.md). Remaining
// semantic dims (Clarity, Specificity, Trigger quality, …) still require manual scoring.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolvePaths, resolveProjectRootFromScript } from './paths.mjs';
import { CLAUDE_COST_PROFILE_ROUTING } from './model-profiles.mjs';

const MAX_LINES = 500;
const MAX_DESCRIPTION = 1024;
const TIERS = new Set(['orchestrate', 'build', 'scout']);
const RITUAL_GUARD = 'Run only when the user explicitly invokes';
const RITUAL_CITE = 'skill-state-ritual.md';
/** Canonical tier→model map every skill's `recommended-model` is authored against (docs/skills.md § Skill properties). */
const CANONICAL_TIER_MODEL = CLAUDE_COST_PROFILE_ROUTING.balanced;
const TIER_SECTION_RE = /^##\s+Tier\b/m;

const HELP = `skill-quality-check — mechanical skill quality report (report-only)

Usage:
  node scripts/skill-quality-check.mjs [dir]       scan all canonical skills + agents
  node scripts/skill-quality-check.mjs --staged      staged harness/skills + harness/agents only
  node scripts/skill-quality-check.mjs --changed     changed canonical artifacts (HEAD + index)
  node scripts/skill-quality-check.mjs --json      JSON output
  node scripts/skill-quality-check.mjs --help        show this help

--staged implies --strict-warns (warnings on touched artifacts fail). Full-engine scan stays in CI.`;

const CANONICAL_SKILL_RE = /^harness\/skills\/([^/]+)\/SKILL\.md$/;
const CANONICAL_AGENT_RE = /^harness\/agents\/([^/]+)\.md$/;

/** @typedef {{ kind: 'skill' | 'agent', id: string }} ArtifactRef */
/** @typedef {{ kind: 'skill' | 'agent', id: string, path: string, lines: number, fails: string[], warns: string[] }} ArtifactReport */

/**
 * @param {string} relPath
 * @returns {ArtifactRef | null}
 */
export function parseCanonicalArtifactPath(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  let m = norm.match(CANONICAL_SKILL_RE);
  if (m) return { kind: 'skill', id: m[1] };
  m = norm.match(CANONICAL_AGENT_RE);
  if (m) return { kind: 'agent', id: m[1] };
  return null;
}

/**
 * @param {string} root
 * @param {'staged' | 'changed'} mode
 * @returns {string[]}
 */
export function listGitChangedPaths(root, mode) {
  const args = mode === 'staged'
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
    : ['diff', 'HEAD', '--name-only', '--diff-filter=ACMR'];
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return [];
  return (r.stdout || '').trim().split(/\r?\n/).filter(Boolean);
}

/**
 * @param {string} root
 * @param {'staged' | 'changed'} mode
 * @returns {ArtifactRef[]}
 */
export function listTouchedArtifacts(root, mode) {
  const seen = new Map();
  for (const rel of listGitChangedPaths(root, mode)) {
    const art = parseCanonicalArtifactPath(rel);
    if (art) seen.set(`${art.kind}:${art.id}`, art);
  }
  return [...seen.values()];
}

/**
 * @param {ArtifactReport[]} reports
 * @param {{ strictWarns?: boolean }} [opts]
 */
export function applyStrictWarns(reports, opts = {}) {
  if (!opts.strictWarns) return reports;
  for (const r of reports) {
    for (const w of r.warns) r.fails.push(w);
    r.warns = [];
  }
  return reports;
}

/**
 * @param {string} text
 * @returns {Record<string, string> | null}
 */
export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0 && !line.startsWith(' ')) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}

/**
 * Count distinct local .md links in the ## Steps section (heuristic for hard fail #6).
 * @param {string} body
 */
export function stepsMarkdownLinkCount(body) {
  const steps = body.match(/## Steps[\s\S]*?(?=\n## |\s*$)/i);
  if (!steps) return 0;
  const links = [...steps[0].matchAll(/\[[^\]]*]\(([^)]+)\)/g)]
    .map((m) => m[1].trim())
    .filter((t) => /\.md(?:[#?].*)?$/i.test(t));
  return new Set(links).size;
}

/**
 * @param {{ kind: 'skill' | 'agent', id: string, relPath: string, text: string }} input
 * @returns {ArtifactReport}
 */
export function inspectArtifact({ kind, id, relPath, text }) {
  const lines = text.split(/\r?\n/).length;
  const fails = [];
  const warns = [];
  const fm = parseFrontmatter(text);
  const body = text.replace(/^---[\s\S]*?---\r?\n?/, '');

  if (!fm) {
    fails.push('missing YAML frontmatter');
    return { kind, id, path: relPath, lines, fails, warns };
  }

  if (!fm.name) fails.push('missing frontmatter `name`');
  else if (fm.name !== id) fails.push(`name "${fm.name}" ≠ directory/file "${id}"`);

  const desc = fm.description || '';
  if (!desc) fails.push('missing frontmatter `description`');
  else if (desc.length > MAX_DESCRIPTION) {
    fails.push(`description length ${desc.length} (> ${MAX_DESCRIPTION})`);
  } else if (desc.length < 20) {
    warns.push(`description very short (${desc.length} chars)`);
  }

  if (lines > MAX_LINES) fails.push(`entry file ${lines} lines (> ${MAX_LINES})`);

  if (kind === 'skill') {
    if (!fm['harness-tier']) warns.push('missing `harness-tier`');
    else if (!TIERS.has(fm['harness-tier'])) warns.push(`unknown harness-tier "${fm['harness-tier']}"`);
    else if (!fm['recommended-model']) {
      warns.push('missing `recommended-model`');
    } else {
      const expected = CANONICAL_TIER_MODEL[fm['harness-tier']];
      if (fm['recommended-model'] !== expected) {
        warns.push(
          `recommended-model "${fm['recommended-model']}" does not match harness-tier "${fm['harness-tier']}" (expected "${expected}")`,
        );
      }
    }
    if (fm['disable-model-invocation'] === 'true') {
      const hasGuard = text.includes(RITUAL_GUARD) || text.includes(RITUAL_CITE);
      if (!hasGuard) fails.push('disable-model-invocation skill missing ritual guard or skill-state-ritual.md cite');
    }
    if (!TIER_SECTION_RE.test(body)) {
      warns.push('missing `## Tier & delegation` (or `## Tier & cost`) section (see rules/model-routing.md)');
    }
  }

  const stepLinks = stepsMarkdownLinkCount(body);
  if (stepLinks > 2) {
    warns.push(`Steps section links ${stepLinks} distinct .md files (soft budget ≤2 — check hard fail #6)`);
  }

  return { kind, id, path: relPath, lines, fails, warns };
}

/**
 * Locate the user-facing skills catalog: engine repo keeps it at the project root; installs keep
 * it under `<paths.engine>/docs/skills.md` (see docs/skills.md header). Missing catalog → `null`
 * (product installs without a catalog are `n/a`, per skill-quality.md).
 * @param {string} root
 * @param {ReturnType<typeof resolvePaths>} paths
 */
export function readCatalogText(root, paths) {
  for (const candidate of [join(root, 'docs', 'skills.md'), join(root, paths.engine, 'docs', 'skills.md')]) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
  }
  return null;
}

/**
 * @param {string} root project root
 * @param {{ onlyArtifacts?: ArtifactRef[] }} [opts]
 * @returns {ArtifactReport[]}
 */
export function collectReports(root, opts = {}) {
  const paths = resolvePaths(root);
  const skillsDir = join(root, paths.engine, 'skills');
  const agentsDir = join(root, paths.engine, 'agents');
  const reports = [];
  const only = opts.onlyArtifacts?.length
    ? new Set(opts.onlyArtifacts.map((a) => `${a.kind}:${a.id}`))
    : null;

  const include = (kind, id) => !only || only.has(`${kind}:${id}`);

  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      if (!include('skill', name)) continue;
      const rel = join(paths.engine, 'skills', name, 'SKILL.md');
      const abs = join(root, rel);
      if (!existsSync(abs)) {
        reports.push({
          kind: 'skill',
          id: name,
          path: rel,
          lines: 0,
          fails: ['missing SKILL.md'],
          warns: [],
        });
        continue;
      }
      reports.push(inspectArtifact({
        kind: 'skill',
        id: name,
        relPath: rel.replace(/\\/g, '/'),
        text: readFileSync(abs, 'utf8'),
      }));
    }
  }

  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort()) {
      const id = basename(file, '.md');
      if (!include('agent', id)) continue;
      const rel = join(paths.engine, 'agents', file).replace(/\\/g, '/');
      const abs = join(root, rel);
      reports.push(inspectArtifact({
        kind: 'agent',
        id,
        relPath: rel,
        text: readFileSync(abs, 'utf8'),
      }));
    }
  }

  const catalog = readCatalogText(root, paths);
  if (catalog) {
    for (const r of reports) {
      if (r.kind !== 'skill') continue;
      const mentioned = new RegExp(`/${r.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(catalog);
      if (!mentioned) r.warns.push(`not referenced in the skills catalog (docs/skills.md) as \`/${r.id}\``);
    }
  }

  return reports;
}

/**
 * @param {ArtifactReport[]} reports
 * @param {{ strictWarns?: boolean }} [opts]
 */
export function summarizeReports(reports, opts = {}) {
  const scoped = opts.strictWarns ? applyStrictWarns(reports.map((r) => ({ ...r, fails: [...r.fails], warns: [...r.warns] })), opts) : reports;
  const skills = scoped.filter((r) => r.kind === 'skill').length;
  const agents = scoped.filter((r) => r.kind === 'agent').length;
  const fails = scoped.reduce((n, r) => n + r.fails.length, 0);
  const warns = scoped.reduce((n, r) => n + r.warns.length, 0);
  const blocked = scoped.filter((r) => r.fails.length > 0).map((r) => r.id);
  return { skills, agents, fails, warns, blocked, reports: scoped, scope: opts.scope || 'all' };
}

/**
 * @param {string} root
 * @param {{ json?: boolean, staged?: boolean, changed?: boolean, strictWarns?: boolean }} [opts]
 */
export function runSkillQualityCheck(root, opts = {}) {
  const staged = !!opts.staged;
  const changed = !!opts.changed;
  const strictWarns = opts.strictWarns ?? staged;
  let scope = 'all';
  /** @type {ArtifactRef[] | undefined} */
  let onlyArtifacts;

  if (staged) {
    onlyArtifacts = listTouchedArtifacts(root, 'staged');
    scope = 'staged';
  } else if (changed) {
    onlyArtifacts = listTouchedArtifacts(root, 'changed');
    scope = 'changed';
  }

  if (onlyArtifacts && onlyArtifacts.length === 0) {
    const empty = { skills: 0, agents: 0, fails: 0, warns: 0, blocked: [], reports: [], scope, skipped: true };
    if (opts.json) {
      console.log(JSON.stringify(empty, null, 2));
    } else {
      console.log(`skill-quality-check — ${scope}: n/a (no canonical harness/skills or harness/agents in diff)`);
      console.log('MIDAS_SKILL_QUALITY_RESULT: skills=0 agents=0 fails=0 warns=0 scope=n/a');
    }
    return empty;
  }

  const reports = collectReports(root, { onlyArtifacts });
  applyStrictWarns(reports, { strictWarns });
  const summary = summarizeReports(reports, { scope });

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    const label = scope === 'all' ? `${summary.skills} skills, ${summary.agents} agents` : `${scope}: ${summary.skills + summary.agents} artifact(s)`;
    console.log(`skill-quality-check — ${label}`);
    console.log(`Hard fails: ${summary.fails}`);
    console.log(`Warnings: ${summary.warns}`);
    for (const r of summary.reports) {
      for (const f of r.fails) console.log(`  FAIL ${r.kind}:${r.id}: ${f}`);
      for (const w of r.warns) console.log(`  WARN ${r.kind}:${r.id}: ${w}`);
    }
    console.log(
      `MIDAS_SKILL_QUALITY_RESULT: skills=${summary.skills} agents=${summary.agents} fails=${summary.fails} warns=${summary.warns} scope=${scope}`,
    );
  }

  return summary;
}

function isMain() {
  const selfPath = fileURLToPath(import.meta.url);
  const argvPath = process.argv[1] ? resolve(process.argv[1]) : '';
  return selfPath === argvPath;
}

if (isMain()) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const json = process.argv.includes('--json');
  const staged = process.argv.includes('--staged');
  const changed = process.argv.includes('--changed');
  const strictWarns = process.argv.includes('--strict-warns') || staged;
  const rootArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const root = rootArg ? resolve(process.cwd(), rootArg) : resolveProjectRootFromScript(import.meta.url);
  const summary = runSkillQualityCheck(root, { json, staged, changed, strictWarns });
  process.exit(summary.fails > 0 ? 1 : 0);
}
