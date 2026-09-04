#!/usr/bin/env node
// render-adapters.mjs — Midas adapter renderer (dependency-free, Node ESM).
//
// Single source of truth: harness/conventions.md (+ harness/rules/context7-usage.md).
// This script (re)writes the four generated tool adapters from that source:
//   - CLAUDE.md                 -> keeps content outside markers; managed block holds the Midas note.
//                                  Guarantees an `@AGENTS.md` import sits above the managed block.
//   - .cursor/rules/00-midas.mdc -> always-on conventions (alwaysApply: true).
//   - .cursor/rules/01-midas-checks.mdc -> on-demand CHECK digest (alwaysApply: false; ADR-014).
//   - harness/.windsurf/rules/00-midas.md (classic) / .harness/.windsurf/… (v2) — always_on conventions.
//   - …/01-midas-checks.md — model_decision digest (docs: https://docs.devin.ai/desktop/cascade/memories 2026-08-27).
//   - GEMINI.md                  -> conventions + pointer to checks.json (no inline digest; ADR-014).
//
// Frontmatter must be at the very top of .mdc / windsurf rule files or the tool won't parse it,
// so for those two the managed markers wrap only the BODY, never the frontmatter.
//
// Also writes `.harness/adapters.hash` as a content fingerprint. doctor.mjs detects drift by
// recomputing adapters via computeAdapters() and comparing full file content (not the hash file).
// No npm dependencies: only node:fs and node:path. Runs on Windows: `node scripts/render-adapters.mjs`.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToolsFromStateYaml } from './yaml-lite.mjs';
import { resolvePaths } from './paths.mjs';
import { writeSkillRegistry } from './skill-registry.mjs';
import { maybeHelp } from './lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

export { parseToolsFromStateYaml };

// Repo root = parent of this script's directory (scripts/..). Resolved from the script URL so the
// script works regardless of the current working directory.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');

// Managed-marker fences. Anything between BEGIN and END is owned by this renderer.
const BEGIN = '<!-- midas:begin GENERATED — edit harness/conventions.md, run midas-doctor -->';
const END = '<!-- midas:end -->';

// Tools that ship a generated adapter file. codex/copilot read AGENTS.md only (no adapter path).
export const DEFAULT_ADAPTER_TOOLS = ['claude-code', 'cursor', 'windsurf', 'gemini'];

/** Base (always-on / project-memory) adapter path per tool. Layout-aware windsurf uses adapterPathForTool. */
export const TOOL_ADAPTER_MAP = {
  'claude-code': 'CLAUDE.md',
  cursor: '.cursor/rules/00-midas.mdc',
  windsurf: '.windsurf/rules/00-midas.md', // legacy root — use adapterPathForTool('windsurf', layout)
  gemini: 'GEMINI.md',
};

export const CURSOR_CHECKS_ADAPTER_REL = '.cursor/rules/01-midas-checks.mdc';

const CHECKS_RULE_DESCRIPTION =
  'Midas CHECK digest for Phase-8 conformance audits and rule reviews. Full always-on rule CHECKs (base + project overlays). Attach when auditing, closing a sprint, or verifying rule compliance.';

/** Windsurf adapter path nested under the Midas layout root (not project root). */
export function windsurfAdapterRel(layout = 'classic') {
  switch (layout) {
    case 'harness':
      return '.harness/.windsurf/rules/00-midas.md';
    case 'classic':
      return 'harness/.windsurf/rules/00-midas.md';
    case 'compact':
    case 'hub':
      return '.midas/.windsurf/rules/00-midas.md';
    default:
      return '.harness/.windsurf/rules/00-midas.md';
  }
}

/** On-demand CHECK digest sibling of the Windsurf always-on adapter (ADR-014). */
export function windsurfChecksRel(layout = 'classic') {
  return windsurfAdapterRel(layout).replace(/00-midas\.md$/, '01-midas-checks.md');
}

export const LEGACY_WINDSURF_ADAPTER_REL = '.windsurf/rules/00-midas.md';
export const LEGACY_WINDSURF_CHECKS_REL = '.windsurf/rules/01-midas-checks.md';

export function adapterPathForTool(tool, layout = 'classic') {
  if (tool === 'claude-code' && layout === 'harness') return '.claude/CLAUDE.md';
  if (tool === 'windsurf') return windsurfAdapterRel(layout);
  return TOOL_ADAPTER_MAP[tool];
}

/**
 * All generated adapter paths for a tool, including on-demand CHECK files (ADR-014).
 * @returns {string[]}
 */
export function adapterPathsForTool(tool, layout = 'classic') {
  const base = adapterPathForTool(tool, layout);
  if (!base) return [];
  if (tool === 'cursor') return [base, CURSOR_CHECKS_ADAPTER_REL];
  if (tool === 'windsurf') return [base, windsurfChecksRel(layout)];
  return [base];
}

/**
 * @returns {Array<{ path: string, role: 'base' | 'checks' }>}
 */
export function adapterSpecsForTool(tool, layout = 'classic') {
  return adapterPathsForTool(tool, layout).map((path, i) => ({
    path,
    role: i === 0 ? 'base' : 'checks',
  }));
}

/**
 * Resolve which adapter files to emit for `root`. When the resolved state file is missing or has no `tools:`,
 * returns all four adapter tools (engine repo / CI). Otherwise filters to tools that have adapters.
 */
export function resolveAdapterTools(root) {
  const p = resolvePaths(root);
  const statePath = join(root, p.state);
  if (!existsSync(statePath)) return [...DEFAULT_ADAPTER_TOOLS];
  const tools = parseToolsFromStateYaml(readFileSync(statePath, 'utf8'));
  if (!tools) return [...DEFAULT_ADAPTER_TOOLS];
  return tools.filter((t) => t in TOOL_ADAPTER_MAP);
}

// --- small helpers -----------------------------------------------------------------------------

/** Read a repo-relative file under `root`, or return '' if it is missing (robustness for partial repos). */
function readMaybe(root, relPath) {
  const abs = join(root, relPath);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : '';
}

/** Read an absolute file or '' (used so we only rewrite when content actually changes). */
function readExisting(absFile) {
  return existsSync(absFile) ? readFileSync(absFile, 'utf8') : '';
}

/** djb2 string hash -> 8-char hex. Cheap, stable, dependency-free content fingerprint. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; // h * 33 + c, kept unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0');
}

/** SHA-256 helper for stable source digests. */
function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

/** Ensure the parent directory of an absolute file path exists. */
function ensureDir(absFile) {
  const dir = dirname(absFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Replace the managed block in `existing`. If markers are present, swap their contents in place
 * (preserving everything outside). If absent, append a fresh managed block. `existing` may be ''.
 */
function spliceManaged(existing, innerBody) {
  const block = `${BEGIN}\n${innerBody}\n${END}`;
  const b = existing.indexOf(BEGIN);
  const e = existing.indexOf(END);
  if (b !== -1 && e !== -1 && e > b) {
    const before = existing.slice(0, b);
    const after = existing.slice(e + END.length);
    return `${before}${block}${after}`;
  }
  if (existing.trim() === '') return `${block}\n`;
  // Markers missing but file has content: append the block, leaving prior content untouched.
  return `${existing.replace(/\s*$/, '')}\n\n${block}\n`;
}

/**
 * Extract **CHECK:** items from a rule file body. Skips blockquote boilerplate; merges indented
 * continuation lines into one digest entry per CHECK.
 */
function extractCheckLines(text) {
  return extractCheckItems(text).map((item) => `**CHECK:** ${item.body}`);
}

function ruleOwnerForSlug(slug) {
  return ['testing', 'verification', 'acceptance-criteria', 'visual-design'].includes(slug)
    ? 'build'
    : 'orchestrate';
}

function checkSeverityFor(item) {
  return isManualCheckBody(item.body) ? 'medium' : 'high';
}

export function isManualCheckBody(body) {
  const text = String(body || '').trim();
  return (
    /^`?manual:`?\s*/i.test(text) ||
    /^\*\(manual(?:[:.)][^)]*)?\)\*?\s*/i.test(text) ||
    /\*\(manual(?:[:.)][^)]*)?\)\*?\s*$/i.test(text)
  );
}

const GATE_ROWS = [
  {
    id: 'gate-00',
    phase: 'idea_intake',
    stage: 0,
    severity: 'high',
    state: 'active',
    owner: 'orchestrate',
    recorded_at: null,
    summary: 'Preserve the raw idea, one-line pitch, and project mode.',
    evidence_required: ['{product}/idea.md', '.harness/state.yaml'],
  },
  {
    id: 'gate-01',
    phase: 'contextualize',
    stage: 1,
    severity: 'high',
    state: 'active',
    owner: 'orchestrate',
    recorded_at: null,
    summary: 'Close blocking questions and capture the project context.',
    evidence_required: ['{product}/idea.md', '{product}/open-questions.md', '.harness/state.yaml'],
  },
  {
    id: 'gate-02',
    phase: 'market_research',
    stage: 2,
    severity: 'high',
    state: 'active',
    owner: 'orchestrate',
    recorded_at: null,
    summary: 'Collect cited competitor evidence and define the market shape.',
    evidence_required: ['{product}/market.md', '.harness/state.yaml'],
  },
  {
    id: 'gate-03',
    phase: 'business_case',
    stage: 3,
    severity: 'high',
    state: 'active',
    owner: 'orchestrate',
    recorded_at: null,
    summary: 'Lock the MVP scope, metrics, and go/no-go decision.',
    evidence_required: ['{product}/business-plan.md', '.harness/state.yaml'],
  },
  {
    id: 'gate-04',
    phase: 'tech_architecture',
    stage: 4,
    severity: 'high',
    state: 'active',
    owner: 'orchestrate',
    recorded_at: null,
    summary: 'Pin the stack, record ADRs, and freeze the technical shape.',
    evidence_required: ['{product}/architecture.md', '{product}/adr/ADR-*.md', '.harness/state.yaml'],
  },
  {
    id: 'gate-05',
    phase: 'architecture_rules',
    stage: 5,
    severity: 'high',
    state: 'active',
    owner: 'orchestrate',
    recorded_at: null,
    summary: 'Render rules, design tokens, and explicit CHECK coverage.',
    evidence_required: [
      '.harness/engine/rules/*.md',
      '.harness/rules/*.md',
      '{product}/conventions.md',
      '{product}/design-system.md',
      '{product}/playbooks/*.md',
      '.claude/CLAUDE.md',
      '.cursor/rules/00-midas.mdc',
      '.cursor/rules/01-midas-checks.mdc',
      'GEMINI.md',
    ],
  },
  {
    id: 'gate-06',
    phase: 'sprint_planning',
    stage: 6,
    severity: 'high',
    state: 'active',
    owner: 'orchestrate',
    recorded_at: null,
    summary: 'Plan the roadmap and give every sprint a clear definition of done.',
    evidence_required: ['{product}/sprints/*.md', '{product}/roadmap.md', '{product}/features.json', '.harness/state.yaml'],
  },
  {
    id: 'gate-07',
    phase: 'sprint_execution',
    stage: 7,
    severity: 'high',
    state: 'active',
    owner: 'build',
    recorded_at: null,
    summary: 'Keep the active sprint green with tests, evidence, and audit trails. `{runs}/verifications/*.md` is required for UI sprints only.',
    evidence_required: ['{runs}/sprints/*.md', '{runs}/verifications/*.md', '.harness/state.yaml'],
  },
  {
    id: 'gate-08',
    phase: 'audit',
    stage: 8,
    severity: 'high',
    state: 'active',
    owner: 'orchestrate',
    recorded_at: null,
    summary: 'Freeze the conformance audit and resolve drift before advancing. `{runs}/verifications/*.md` is required for UI sprints only.',
    evidence_required: ['{runs}/audits/*.md', '{runs}/verifications/*.md', '.harness/state.yaml'],
  },
];

/**
 * Extract structured CHECK items from a rule file body.
 * Returns a compact record per CHECK with a rough kind label.
 */
function extractCheckItems(text) {
  const lines = text.split(/\r?\n/);
  const checks = [];
  let headings = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      if (level === 2) headings = [title];
      else if (level === 3) headings = [headings[0] || '', title].filter(Boolean);
      else headings = [...headings.slice(0, 2), title].filter(Boolean);
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      i++;
      continue;
    }
    const m = line.match(/^\s*(?:-\s+(?:\[[ x]\]\s+)?)?\*\*CHECK:\*\*\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    let body = m[1].trim();
    i++;
    while (i < lines.length) {
      const cont = lines[i];
      if (/^\s*#/.test(cont)) break;
      if (/^\s*(?:-\s+(?:\[[ x]\]\s+)?)?\*\*CHECK:\*\*/.test(cont)) break;
      if (/^\s*-\s+\[/.test(cont)) break;
      if (/^\s{2,}\S/.test(cont) && !/^\s*>/.test(cont)) {
        body += ' ' + cont.trim();
        i++;
      } else break;
    }
    checks.push({
      kind: isManualCheckBody(body) ? 'manual' : 'command',
      body,
      section: headings.join(' > ') || null,
    });
  }
  return checks;
}

/**
 * Build a compact digest of every always-on rule in harness/rules/ (excluding context7-usage.md,
 * which already has its own adapter section): each rule's title + its CHECK lines. Inlining this into
 * the non-Claude adapters means generated stack rules reach Cursor/Windsurf/Gemini too (Claude Code
 * reads harness/rules/ natively); folding `raw` into the content hash makes a rule edit show as drift.
 */
function readRulesDigest(root, paths) {
  const baseDir = join(root, paths.engine, 'rules');
  const projectCandidate = paths.rules ? join(root, paths.rules) : null;
  const projectDir = projectCandidate && resolve(projectCandidate) !== resolve(baseDir)
    ? projectCandidate
    : null;
  const names = new Set();
  if (existsSync(baseDir)) {
    for (const f of readdirSync(baseDir)) if (f.endsWith('.md')) names.add(f);
  }
  if (projectDir && existsSync(projectDir)) {
    for (const f of readdirSync(projectDir)) if (f.endsWith('.md')) names.add(f);
  }
  const files = [...names].filter((f) => f !== 'context7-usage.md').sort();
  let raw = '';
  const out = [];
  for (const f of files) {
    const projectFile = projectDir ? join(projectDir, f) : null;
    const source = projectFile && existsSync(projectFile) ? projectFile : join(baseDir, f);
    const text = readFileSync(source, 'utf8');
    raw += text;
    const title = (text.match(/^#\s+(.+)$/m) || [, f.replace(/\.md$/, '')])[1];
    const origin = projectFile && existsSync(projectFile) ? 'project' : 'base';
    out.push(`- **${title}** (\`${f}\`, ${origin})`);
    for (const check of extractCheckLines(text)) {
      out.push(`  - ${check}`);
    }
  }
  return { raw, body: out.join('\n') };
}

/** Build the structured rule-check index mirrored into {engine}/checks.json. */
export function computeChecksIndex(root, engineRel = 'harness') {
  const dir = join(root, engineRel, 'rules');
  if (!existsSync(dir)) {
    return { schema_version: 1, updated: null, source: 'engine/rules', source_digest: sha256('engine/rules'), rules: [] };
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  let raw = '';
  const rules = files.map((f) => {
    const text = readFileSync(join(dir, f), 'utf8');
    raw += text;
    const title = (text.match(/^#\s+(.+)$/m) || [, f.replace(/\.md$/, '')])[1];
    const slug = f.replace(/\.md$/, '');
    const owner = ruleOwnerForSlug(slug);
    const checks = extractCheckItems(text).map((check) => ({
      ...check,
      phase: 8,
      owner,
      severity: checkSeverityFor(check),
    }));
    return {
      path: `engine/rules/${f}`,
      slug,
      title,
      owner,
      phase: 8,
      check_count: checks.length,
      checks,
    };
  });
  return {
    schema_version: 1,
    updated: null,
    source: 'engine/rules',
    source_digest: sha256(`engine/rules\n${raw}`),
    rules,
  };
}

/** Build the structured phase-gate registry mirrored into {engine}/gates.json. */
export function computeGatesIndex(root, engineRel = 'harness') {
  const methodology = readFileSync(join(root, engineRel, 'methodology.md'), 'utf8');
  return {
    schema_version: 1,
    updated: null,
    source: 'engine/methodology.md',
    source_digest: sha256(`engine/methodology.md\n${methodology}\n${JSON.stringify(GATE_ROWS)}`),
    gates: GATE_ROWS.map((gate) => ({
      ...gate,
      recorded_at: null,
    })),
  };
}

// --- render logic (exported so doctor.mjs can re-derive without duplication) --------------------

/**
 * Compute the full intended content for every adapter from the single source.
 * Returns { root, hash, files: [{ path, abs, content }] } — deterministic given the on-disk source
 * (CLAUDE.md also reads its own existing outside-marker content, which is preserved).
 */
export function computeAdapters(root = ROOT) {
  const p = resolvePaths(root);
  const conventions = readMaybe(root, join(p.engine, 'conventions.md'));
  const context7 = readMaybe(root, join(p.engine, 'rules/context7-usage.md'));
  const rules = readRulesDigest(root, p);
  const selectedTools = resolveAdapterTools(root);
  const selectedPaths = new Set(selectedTools.flatMap((t) => adapterPathsForTool(t, p.layout)));

  const hash = djb2(conventions + ' ' + context7 + ' ' + rules.raw);
  const conventionsBody = conventions.trim();
  const context7Body = context7.trim() || `See \`${p.engine}/rules/context7-usage.md\`.`;
  const sourceLabel = p.layout === 'harness' ? '.harness/' : `${p.engine}/`;

  // --- CLAUDE.md: managed block holds ONLY the Midas note (no @AGENTS.md — that import lives
  //     above the markers so it is never duplicated). Guarantee the import exists.
  const claudeInner = [
    `## Midas (generated — edit ${p.engine}/conventions.md or ${p.rules || `${p.engine}/rules`}, run midas-doctor)`,
    `- Canonical Midas source: \`${sourceLabel}\`. Tool discovery trees are generated mirrors.`,
    `- This block is rendered by \`${p.scripts}/render-adapters.mjs\`; do not hand-edit between the markers.`,
    `- Follow \`${p.engine}/conventions.md\`, base rules in \`${p.engine}/rules/\`, and project rules in \`${p.rules || `${p.engine}/rules`}/\`.`,
    '- Before any third-party code, fetch its current docs for the in-use version (Context7 recommended,',
    `  or your own doc tool); see \`${p.engine}/rules/context7-usage.md\`. Never code third-party APIs from memory.`,
  ].join('\n');
  const claudeRel = adapterPathForTool('claude-code', p.layout);
  const claudeAbs = join(root, claudeRel);
  let claudeContent = spliceManaged(readExisting(claudeAbs), claudeInner);
  const agentsImport = p.layout === 'harness' ? '@../AGENTS.md' : '@AGENTS.md';
  if (!claudeContent.includes(agentsImport)) {
    claudeContent = `# Project memory\n\n${agentsImport}\n\n${claudeContent}`;
  }

  const generatedBanner = [
    `> Generated by Midas from \`${p.engine}/conventions.md\`. Do not hand-edit — run \`/midas-doctor\``,
    `> (or \`node ${p.scripts}/render-adapters.mjs\`) to re-render.`,
  ].join('\n');

  const conventionsManaged = [
    BEGIN,
    generatedBanner,
    '',
    conventionsBody,
    '',
    '## Fetch current docs before third-party code (Context7 recommended)',
    context7Body,
    END,
    '',
  ].join('\n');

  const digestHeading = `## Always-on rules — CHECK digest (base: \`${p.engine}/rules/\`; project: \`${p.rules || `${p.engine}/rules`}/\`)`;
  const digestManaged = [
    BEGIN,
    generatedBanner,
    '',
    digestHeading,
    rules.body || '_No rule files found._',
    END,
    '',
  ].join('\n');

  const geminiPointer = [
    BEGIN,
    generatedBanner,
    '',
    conventionsBody,
    '',
    '## Fetch current docs before third-party code (Context7 recommended)',
    context7Body,
    '',
    digestHeading,
    `Do not inline the Phase-8 CHECK list here (ADR-014).`,
    `Load structured CHECKs from \`${p.engine}/checks.json\` and the rule files under \`${p.engine}/rules/\``,
    `(project overlays at \`${p.rules || `${p.engine}/rules`}/\` win by slug). Cursor and Windsurf attach \`01-midas-checks\` on demand.`,
    END,
    '',
  ].join('\n');

  // --- .cursor/rules/00-midas.mdc: always-on conventions (ADR-014) -----------------------------
  const cursorContent =
    '---\n' +
    `description: Midas base conventions (always-on project law). Generated from ${p.engine}/conventions.md.\n` +
    'globs:\n' +
    '  - "**/*"\n' +
    'alwaysApply: true\n' +
    '---\n\n' +
    conventionsManaged;
  const cursorAbs = join(root, '.cursor', 'rules', '00-midas.mdc');

  const cursorChecksContent =
    '---\n' +
    `description: ${CHECKS_RULE_DESCRIPTION}\n` +
    'alwaysApply: false\n' +
    '---\n\n' +
    digestManaged;
  const cursorChecksAbs = join(root, CURSOR_CHECKS_ADAPTER_REL);

  // --- Windsurf: always_on conventions + model_decision digest --------------------------------
  // docs: Windsurf/Devin Desktop rules activation (trigger: always_on | model_decision)
  // via https://docs.devin.ai/desktop/cascade/memories fetched 2026-08-27
  const windsurfContent =
    '---\n' +
    'trigger: always_on\n' +
    '---\n\n' +
    conventionsManaged;
  const windsurfRel = adapterPathForTool('windsurf', p.layout);
  const windsurfAbs = join(root, windsurfRel);

  const windsurfChecksRelPath = windsurfChecksRel(p.layout);
  const windsurfChecksContent =
    '---\n' +
    'trigger: model_decision\n' +
    `description: ${CHECKS_RULE_DESCRIPTION}\n` +
    '---\n\n' +
    digestManaged;
  const windsurfChecksAbs = join(root, windsurfChecksRelPath);

  // --- GEMINI.md: project memory without inline digest (ADR-014) -------------------------------
  const geminiContent = '# Project memory — Midas (Gemini CLI)\n\n' + geminiPointer;
  const geminiAbs = join(root, 'GEMINI.md');

  const allFiles = [
    { path: claudeRel, abs: claudeAbs, content: claudeContent },
    { path: '.cursor/rules/00-midas.mdc', abs: cursorAbs, content: cursorContent },
    { path: CURSOR_CHECKS_ADAPTER_REL, abs: cursorChecksAbs, content: cursorChecksContent },
    { path: windsurfRel, abs: windsurfAbs, content: windsurfContent },
    { path: windsurfChecksRelPath, abs: windsurfChecksAbs, content: windsurfChecksContent },
    { path: 'GEMINI.md', abs: geminiAbs, content: geminiContent },
  ];

  return {
    root,
    hash,
    files: allFiles.filter((f) => selectedPaths.has(f.path)),
  };
}

/**
 * Write all adapters + the hash file. Returns { hash, results } where each result is
 * { path, status: 'written' | 'unchanged' }. Pure side-effect wrapper around computeAdapters so
 * doctor.mjs --fix can reuse it.
 */
export function renderAdapters(root = ROOT) {
  const p = resolvePaths(root);
  const { hash, files } = computeAdapters(root);
  const gatesIndex = computeGatesIndex(root, p.engine);
  const checksIndex = computeChecksIndex(root, p.engine);
  const results = [];

  for (const f of files) {
    const before = readExisting(f.abs);
    if (before === f.content) {
      results.push({ path: f.path, status: 'unchanged' });
      continue;
    }
    ensureDir(f.abs);
    writeFileSync(f.abs, f.content, 'utf8');
    results.push({ path: f.path, status: 'written' });
  }

  const hashAbs = p.adaptersHash();
  ensureDir(hashAbs);
  writeFileSync(hashAbs, hash + '\n', 'utf8');
  const hashRel = hashAbs.slice(p.projectRoot.length + 1).replace(/\\/g, '/');
  results.push({ path: hashRel, status: 'written' });

  // Classic engine repo regenerates registries inline; harness-layout installs refresh via --update.
  // skill-registry.md is always regenerated (cheap; doctor compares it on both layouts).
  if (p.layout !== 'harness') {
    const reg = writeEngineRegistries(root, p.engine, { gatesIndex, checksIndex });
    results.push({ path: reg.gates, status: 'written' });
    results.push({ path: reg.checks, status: 'written' });
    results.push({ path: reg.skillRegistry, status: 'written' });
  } else {
    const skillRegistry = writeSkillRegistry(root, { engine: p.engine });
    results.push({ path: skillRegistry, status: 'written' });
  }

  return { hash, results };
}

/**
 * Write gates.json + checks.json + skill-registry.md under the engine tree. Used by classic
 * render and by --update on harness-layout installs so doctor strict passes without manual
 * registry fixes.
 */
export function writeEngineRegistries(root, engineRel, { gatesIndex = null, checksIndex = null } = {}) {
  const resolved = engineRel || resolvePaths(root).engine;
  gatesIndex ||= computeGatesIndex(root, resolved);
  checksIndex ||= computeChecksIndex(root, resolved);
  const gatesAbs = join(root, resolved, 'gates.json');
  const checksAbs = join(root, resolved, 'checks.json');
  ensureDir(gatesAbs);
  ensureDir(checksAbs);
  writeFileSync(gatesAbs, `${JSON.stringify(gatesIndex, null, 2)}\n`, 'utf8');
  writeFileSync(checksAbs, `${JSON.stringify(checksIndex, null, 2)}\n`, 'utf8');
  const skillRegistry = writeSkillRegistry(root, { engine: resolved });
  return {
    gates: gatesAbs.slice(root.length + 1).replace(/\\/g, '/'),
    checks: checksAbs.slice(root.length + 1).replace(/\\/g, '/'),
    skillRegistry,
  };
}

// --- CLI entry point ---------------------------------------------------------------------------
// Run only when executed directly (not when imported by doctor.mjs).
const invokedDirectly =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const { hash, results } = renderAdapters();
  console.log('midas render-adapters: rendered from harness/conventions.md');
  for (const r of results) {
    console.log(`  ${r.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${r.path}`);
  }
  console.log(`  source hash: ${hash}`);
}
