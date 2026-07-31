#!/usr/bin/env node
// skill-quality-check.mjs — report-only mechanical checks for skill-quality hard fails.
//
//   node scripts/skill-quality-check.mjs [dir]     scan canonical skills + agents (exit 1 on hard fail)
//   node scripts/skill-quality-check.mjs --json     machine-readable report
//   node scripts/skill-quality-check.mjs --help
//
// Covers hard fails #1–#3 from docs/skill-quality-gate.md (frontmatter, description length, line cap)
// plus ritual-guard for disable-model-invocation skills. Semantic dims still require manual scoring.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths, resolveProjectRootFromScript } from './paths.mjs';

const MAX_LINES = 500;
const MAX_DESCRIPTION = 1024;
const TIERS = new Set(['orchestrate', 'build', 'scout']);
const RITUAL_GUARD = 'Run only when the user explicitly invokes';

const HELP = `skill-quality-check — mechanical skill quality report (report-only)

Usage:
  node scripts/skill-quality-check.mjs [dir]   scan skills + agents (default: engine repo)
  node scripts/skill-quality-check.mjs --json  JSON output
  node scripts/skill-quality-check.mjs --help  show this help`;

/** @typedef {{ kind: 'skill' | 'agent', id: string, path: string, lines: number, fails: string[], warns: string[] }} ArtifactReport */

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
    if (fm['disable-model-invocation'] === 'true' && !text.includes(RITUAL_GUARD)) {
      fails.push('disable-model-invocation skill missing ritual guard in body');
    }
  }

  const stepLinks = stepsMarkdownLinkCount(body);
  if (stepLinks > 2) {
    warns.push(`Steps section links ${stepLinks} distinct .md files (soft budget ≤2 — check hard fail #6)`);
  }

  return { kind, id, path: relPath, lines, fails, warns };
}

/**
 * @param {string} root project root
 * @returns {ArtifactReport[]}
 */
export function collectReports(root) {
  const paths = resolvePaths(root);
  const skillsDir = join(root, paths.engine, 'skills');
  const agentsDir = join(root, paths.engine, 'agents');
  const reports = [];

  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
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

  return reports;
}

/**
 * @param {ArtifactReport[]} reports
 */
export function summarizeReports(reports) {
  const skills = reports.filter((r) => r.kind === 'skill').length;
  const agents = reports.filter((r) => r.kind === 'agent').length;
  const fails = reports.reduce((n, r) => n + r.fails.length, 0);
  const warns = reports.reduce((n, r) => r.warns.length, 0);
  const blocked = reports.filter((r) => r.fails.length > 0).map((r) => r.id);
  return { skills, agents, fails, warns, blocked, reports };
}

/**
 * @param {string} root
 * @param {{ json?: boolean }} [opts]
 */
export function runSkillQualityCheck(root, opts = {}) {
  const reports = collectReports(root);
  const summary = summarizeReports(reports);

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`skill-quality-check — ${summary.skills} skills, ${summary.agents} agents`);
    console.log(`Hard fails: ${summary.fails}`);
    console.log(`Warnings: ${summary.warns}`);
    for (const r of reports) {
      for (const f of r.fails) console.log(`  FAIL ${r.kind}:${r.id}: ${f}`);
      for (const w of r.warns) console.log(`  WARN ${r.kind}:${r.id}: ${w}`);
    }
    console.log(
      `MIDAS_SKILL_QUALITY_RESULT: skills=${summary.skills} agents=${summary.agents} fails=${summary.fails} warns=${summary.warns}`,
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
  const rootArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const root = rootArg ? resolve(process.cwd(), rootArg) : resolveProjectRootFromScript(import.meta.url);
  const summary = runSkillQualityCheck(root, { json });
  process.exit(summary.fails > 0 ? 1 : 0);
}
