#!/usr/bin/env node
// test.mjs — Midas structural test suite (dependency-free, Node ESM).
//
// Validates the invariants that keep the harness coherent: JSON parses, skill/agent frontmatter is
// well-formed and names match their paths, ritual skills carry the safety guard, the generated tool
// adapters are in sync with source, the plugin tree matches `.claude/`, the example state has the
// required shape, and no stale brand token leaked back in.
//
// Run: `node scripts/test.mjs`  (exit 0 = all pass, 1 = at least one failure). No npm dependencies.

import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, extname, basename } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { computeAdapters, computeChecksIndex, computeGatesIndex, DEFAULT_ADAPTER_TOOLS, resolveAdapterTools } from './render-adapters.mjs';
import { evaluateMcpDeclaredVsWired, evaluateSkillMcpRequired, OPTIONAL_MCP_IDS } from './mcp-drift.mjs';
import { ensureMidasGitignore, GITIGNORE_BEGIN, GITIGNORE_END, auditGitignore } from './gitignore-merge.mjs';
import { detectLayout, resolvePaths, MIGRATION_MAP, MIGRATION_MAP_HUB, RUNS_SUBDIRS, hubPathsYaml, resolveProjectRootFromScript } from './paths.mjs';
import { pathToFileURL } from 'node:url';
import { exportBundle, applyImport, checkMcpSecrets, ENGINE_BASE_RULES, toCanonical, fromCanonical, planImport } from './bundle.mjs';
import { loadStageCommandTable, stageRecallPaths, loadEngineBaseRules, computeStageCommandTableYaml } from './stage-command-table.mjs';
import { computeDesignSystemCss } from './design-system.mjs';
import { computePluginManifest, computePluginReadme, computeMarketplaceJson } from './build-plugin.mjs';
import { createHash } from 'node:crypto';
import {
  applyV2Migration,
  extractLegacyRuleOverrides,
  planV2Migration,
} from '../create-midas/migrate-v2.mjs';
import {
  isKnownRoutingProfile,
  normalizeRoutingProfile,
  resolveRoutingModels,
} from './model-profiles.mjs';
import { collectReports, inspectArtifact, parseFrontmatter, stepsMarkdownLinkCount, summarizeReports } from './skill-quality-check.mjs';

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = resolve(SCRIPT_DIR, '..');

const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'inherit'];
const RITUAL_GUARD = 'Run only when the user explicitly invokes';
const RITUAL_CITE = 'skill-state-ritual.md';

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; }
  else { failures.push(detail ? `${name} — ${detail}` : name); }
}

// --- helpers -----------------------------------------------------------------------------------
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function walkRelativeFiles(root, base = root, out = []) {
  if (!existsSync(root)) return out;
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) walkRelativeFiles(p, base, out);
    else if (e.isFile()) out.push(p.slice(base.length + 1));
  }
  return out.sort();
}

function treeDigest(root) {
  const hash = createHash('sha256');
  for (const rel of walkRelativeFiles(root)) {
    hash.update(rel.replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(readFileSync(join(root, rel)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

check('routing-profile:claude', resolveRoutingModels('claude').orchestrate === 'claude-opus-4-8');
check('routing-profile:openai-mini', Object.values(resolveRoutingModels('openai-mini')).every((id) => id === 'gpt-5.4-mini'));
check('routing-profile:local-hybrid', resolveRoutingModels('local-hybrid', { localModelId: 'ollama/qwen' }).build === 'ollama/qwen');
check('routing-profile:legacy-alias', normalizeRoutingProfile('openai') === 'openai-mini');
check('routing-profile:unknown-rejected', !isKnownRoutingProfile('invented'));

function scriptBundleFiles() {
  return [
    'bundle.mjs',
    'design-system.mjs',
    'doctor.mjs',
    'gitignore-merge.mjs',
    'mcp-cursor-sync.mjs',
    'mcp-drift.mjs',
    'migrate-layout.mjs',
    'model-profiles.mjs',
    'ownership-manifest.mjs',
    'portable-skills.mjs',
    'paths.mjs',
    'render-adapters.mjs',
    'skill-quality-check.mjs',
    'stage-command-table.mjs',
    'status-page.mjs',
    'tool-profiles.mjs',
    'yaml-lite.mjs',
  ].sort();
}

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0 && !line.startsWith(' ')) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { frontmatter: m[1], body: m[2] };
}

function parsePortableSkill(text) {
  const parts = splitFrontmatter(text);
  if (!parts) return null;
  const out = { metadata: {} };
  let inMetadata = false;
  for (const line of parts.frontmatter.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    const meta = inMetadata && line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (meta) {
      out.metadata[meta[1]] = normalizePortableScalar(meta[2]);
      continue;
    }
    inMetadata = false;
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (top) out[top[1]] = normalizePortableScalar(top[2]);
  }
  return out;
}

function normalizePortableScalar(value) {
  const text = String(value ?? '').trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\\\\/g, '\\').replace(/\\"/g, '"');
  }
  if (text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

function dirNames(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

// --- A. all .json files parse ------------------------------------------------------------------
for (const f of walk(ROOT).filter((p) => extname(p) === '.json')) {
  let ok = true, msg = '';
  try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { ok = false; msg = e.message; }
  check(`json:${f.slice(ROOT.length + 1)}`, ok, msg);
}

// --- B. skill frontmatter + ritual guard -------------------------------------------------------
const skillsDir = join(ROOT, 'harness', 'skills');
for (const name of dirNames(skillsDir)) {
  const file = join(skillsDir, name, 'SKILL.md');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const fm = frontmatter(text);
  check(`skill:${name}:has-frontmatter`, !!fm);
  if (!fm) continue;
  check(`skill:${name}:name-matches-dir`, fm.name === name, `name=${fm.name}`);
  check(`skill:${name}:has-description`, !!fm.description && fm.description.length > 10);
  check(`skill:${name}:tier`, ['orchestrate', 'build', 'scout'].includes(fm['harness-tier']), `tier=${fm['harness-tier']}`);
  if (fm['disable-model-invocation'] === 'true') {
    const hasGuard = text.includes(RITUAL_GUARD) || text.includes(RITUAL_CITE);
    check(`skill:${name}:ritual-guard`, hasGuard, 'missing body guard or skill-state-ritual.md cite');
  }
}

// --- B2. skill-quality-check (mechanical hard fails) -------------------------------------------
{
  const sample = inspectArtifact({
    kind: 'skill',
    id: 'demo',
    relPath: 'harness/skills/demo/SKILL.md',
    text: `---
name: demo
description: Short demo skill for unit tests only.
harness-tier: scout
---
# demo
`,
  });
  check('skill-quality:parse-frontmatter', !!parseFrontmatter('---\nname: x\ndescription: y\n---\n'));
  check('skill-quality:steps-link-count', stepsMarkdownLinkCount('## Steps\n1. [a](one.md)\n2. [b](two.md)\n3. [c](three.md)\n') === 3);
  check('skill-quality:sample-no-fails', sample.fails.length === 0, sample.fails.join('; '));
  const engineSummary = summarizeReports(collectReports(ROOT));
  check('skill-quality:engine-zero-fails', engineSummary.fails === 0, `fails=${engineSummary.fails}`);
  check('skill-quality:engine-skill-count', engineSummary.skills >= 28, `skills=${engineSummary.skills}`);
}

// --- C. agent frontmatter ----------------------------------------------------------------------
const agentsDir = join(ROOT, 'harness', 'agents');
for (const f of walk(agentsDir).filter((p) => extname(p) === '.md')) {
  const fm = frontmatter(readFileSync(f, 'utf8'));
  const base = basename(f, '.md');
  check(`agent:${base}:has-frontmatter`, !!fm);
  if (!fm) continue;
  check(`agent:${base}:name-matches-file`, fm.name === base, `name=${fm.name}`);
  check(`agent:${base}:valid-model`, MODELS.includes(fm.model), `model=${fm.model}`);
}

// --- D. generated adapters in sync with source -------------------------------------------------
for (const f of computeAdapters(ROOT).files) {
  const onDisk = existsSync(f.abs) ? readFileSync(f.abs, 'utf8') : null;
  check(`adapter-sync:${f.path}`, onDisk === f.content, onDisk === null ? 'missing' : 'drift');
}

// --- E. plugin tree matches .claude/ -----------------------------------------------------------
const pluginSkills = join(ROOT, 'plugins', 'midas', 'skills');
const pluginAgents = join(ROOT, 'plugins', 'midas', 'agents');
if (existsSync(join(ROOT, 'plugins', 'midas'))) {
  check('plugin:skills-match', JSON.stringify(dirNames(pluginSkills)) === JSON.stringify(dirNames(skillsDir)), 're-run build-plugin.mjs');
  const srcAgents = walk(agentsDir).map((p) => basename(p)).sort();
  const plgAgents = walk(pluginAgents).map((p) => basename(p)).sort();
  check('plugin:agents-match', JSON.stringify(srcAgents) === JSON.stringify(plgAgents), 're-run build-plugin.mjs');
  const pluginJson = join(ROOT, 'plugins', 'midas', '.claude-plugin', 'plugin.json');
  if (existsSync(pluginJson)) {
    check(
      'plugin:manifest-json',
      readFileSync(pluginJson, 'utf8') === JSON.stringify(computePluginManifest(), null, 2) + '\n',
      're-run build-plugin.mjs',
    );
  }
  const pluginReadme = join(ROOT, 'plugins', 'midas', 'README.md');
  if (existsSync(pluginReadme)) {
    check(
      'plugin:readme',
      readFileSync(pluginReadme, 'utf8') === computePluginReadme(),
      're-run build-plugin.mjs',
    );
  }
  const marketplaceJson = join(ROOT, '.claude-plugin', 'marketplace.json');
  if (existsSync(marketplaceJson)) {
    check(
      'plugin:marketplace-json',
      readFileSync(marketplaceJson, 'utf8') === JSON.stringify(computeMarketplaceJson(), null, 2) + '\n',
      're-run build-plugin.mjs',
    );
  }
  const sourceClaude = join(ROOT, '.claude');
  const pluginClaude = join(ROOT, 'plugins', 'midas', '.claude');
  if (existsSync(sourceClaude) && existsSync(pluginClaude)) {
    const sourceFiles = walkRelativeFiles(sourceClaude);
    const pluginFiles = walkRelativeFiles(pluginClaude);
    const sameShape = JSON.stringify(sourceFiles) === JSON.stringify(pluginFiles);
    const sameContent = sameShape && sourceFiles.every(
      (rel) => readFileSync(join(sourceClaude, rel), 'utf8') === readFileSync(join(pluginClaude, rel), 'utf8'),
    );
    check(
      'plugin:claude-tree-match',
      sameShape && sameContent,
      'plugins/midas/.claude drifts from source .claude',
    );
  }
}

// --- E2. create-midas bundled template matches source -----------------------------------------
const tplRoot = join(ROOT, 'create-midas', 'template');
if (existsSync(tplRoot)) {
  check(
    'create-template:skills-match',
    JSON.stringify(dirNames(join(tplRoot, '.claude', 'skills'))) === JSON.stringify(dirNames(skillsDir)),
    're-run build-create.mjs',
  );
  for (const f of ['AGENTS.md', '.mcp.json', '.harness/engine/methodology.md', '.harness/engine/conventions.md', '.harness/engine/gates.json', '.harness/engine/checks.json', '.harness/engine/stage-command-table.yaml', '.harness/scripts/render-adapters.mjs', '.harness/scripts/yaml-lite.mjs', '.harness/scripts/mcp-drift.mjs', '.harness/scripts/mcp-cursor-sync.mjs', '.harness/scripts/tool-profiles.mjs', '.harness/scripts/model-profiles.mjs', '.harness/scripts/portable-skills.mjs', '.harness/scripts/gitignore-merge.mjs', '.harness/scripts/paths.mjs', '.harness/scripts/migrate-layout.mjs', '.harness/scripts/stage-command-table.mjs', '.harness/scripts/design-system.mjs', '.harness/scripts/doctor.mjs', '.harness/scripts/status-page.mjs', '.harness/scripts/skill-quality-check.mjs', '.harness/scripts/bundle.mjs', '.harness/scripts/ownership-manifest.mjs', '.harness/engine/docs/agents-and-models.md', '.harness/engine/docs/skill-quality-gate.md']) {
    check(`create-template:has:${f}`, existsSync(join(tplRoot, f)));
  }
  // The template must NOT carry repo-internal trees into a user project.
  for (const d of ['examples', 'plugins', '.github', 'create-midas']) {
    check(`create-template:excludes:${d}`, !existsSync(join(tplRoot, d)));
  }
  // Engine dev state must never ship in the distributable bundle (create-midas/index.mjs writes fresh state).
  check('create-template:excludes:harness/state.yaml', !existsSync(join(tplRoot, '.harness', 'engine', 'state.yaml')));
}

// --- E2b. build-create strips engine-only harness files (dynamic, not static tree check) -------
const buildCreate = join(ROOT, 'scripts', 'build-create.mjs');
if (existsSync(buildCreate)) {
  execSync(`node "${buildCreate}"`, { cwd: ROOT, stdio: 'pipe' });
  check(
    'build-create:excludes-harness-state-yaml',
    !existsSync(join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'state.yaml')),
    'harness/state.yaml leaked into create-midas/template — add to HARNESS_EXCLUDE',
  );
  const srcConv = join(ROOT, 'harness', 'conventions.md');
  const tplConv = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'conventions.md');
  if (existsSync(srcConv) && existsSync(tplConv)) {
    check(
      'build-create:conventions-match',
      readFileSync(srcConv, 'utf8') === readFileSync(tplConv, 'utf8'),
      'template harness/conventions.md drifted from source',
    );
  }
  const sourceHarness = join(ROOT, 'harness');
  const templateHarness = join(ROOT, 'create-midas', 'template', '.harness', 'engine');
  if (existsSync(sourceHarness) && existsSync(templateHarness)) {
    const sourceFiles = walkRelativeFiles(sourceHarness).filter((rel) => rel !== 'state.yaml');
    const templateFiles = walkRelativeFiles(templateHarness)
      .filter((rel) => {
        const n = rel.replace(/\\/g, '/');
        return n !== 'docs/agents-and-models.md' && n !== 'docs/skill-quality-gate.md' && n !== 'docs/skills.md';
      });
    const sameShape = JSON.stringify(sourceFiles) === JSON.stringify(templateFiles);
    const sameContent = sameShape && sourceFiles.every(
      (rel) => readFileSync(join(sourceHarness, rel), 'utf8') === readFileSync(join(templateHarness, rel), 'utf8'),
    );
    check(
      'build-create:harness-tree-match',
      sameShape && sameContent,
      'create-midas/template/harness drifts from harness source (excluding state.yaml)',
    );
  }
  {
    const sourceClaude = join(ROOT, 'harness');
    const templateClaude = join(ROOT, 'create-midas', 'template', '.claude');
    if (existsSync(sourceClaude) && existsSync(templateClaude)) {
      const sourceFiles = [
        ...walkRelativeFiles(join(sourceClaude, 'skills')).map((rel) => `skills/${rel.replace(/\\/g, '/')}`),
        ...walkRelativeFiles(join(sourceClaude, 'agents')).map((rel) => `agents/${rel.replace(/\\/g, '/')}`),
      ].sort();
      const templateFiles = walkRelativeFiles(templateClaude).map((rel) => rel.replace(/\\/g, '/'));
      const sameShape = JSON.stringify(sourceFiles) === JSON.stringify(templateFiles);
      const sameContent = sameShape && sourceFiles.every(
        (rel) => readFileSync(join(sourceClaude, rel), 'utf8') === readFileSync(join(templateClaude, rel), 'utf8'),
      );
      check(
        'create-template:claude-tree-match',
        sameShape && sameContent,
        'create-midas/template/.claude drifts from source .claude',
      );
    }
  }
  {
    const sourcePortableSkills = join(ROOT, 'harness', 'skills');
    const templatePortableSkills = join(ROOT, 'create-midas', 'template', '.agents', 'skills');
    if (existsSync(sourcePortableSkills) && existsSync(templatePortableSkills)) {
      const sourceNames = dirNames(sourcePortableSkills);
      const templateNames = dirNames(templatePortableSkills);
      const sameShape = JSON.stringify(sourceNames) === JSON.stringify(templateNames);
      let sameContent = sameShape;
      if (sameShape) {
        for (const name of sourceNames) {
          const sourceText = readFileSync(join(sourcePortableSkills, name, 'SKILL.md'), 'utf8');
          const templateText = readFileSync(join(templatePortableSkills, name, 'SKILL.md'), 'utf8');
          const sourceParts = splitFrontmatter(sourceText);
          const templateParts = parsePortableSkill(templateText);
          sameContent = sameContent &&
            !!sourceParts &&
            !!templateParts &&
            templateParts.name === name &&
            templateParts.description === normalizePortableScalar((frontmatter(sourceText) || {}).description) &&
            Object.keys(templateParts).every((k) => ['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata'].includes(k)) &&
            templateParts.metadata['midas-harness-tier'] &&
            sourceParts.body.trim() === (templateText.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/) || [])[1].trim();
          if (!sameContent) break;
        }
      }
      check(
        'build-create:portable-skills-match',
        sameShape && sameContent,
        'create-midas/template/.agents/skills drifts from .claude/skills',
      );
    }
  }
  {
    const sourceAgentsTemplate = join(ROOT, 'harness', 'templates', 'AGENTS.md.tmpl');
    const bundledAgents = join(ROOT, 'create-midas', 'template', 'AGENTS.md');
    if (existsSync(sourceAgentsTemplate) && existsSync(bundledAgents)) {
      const tmpl = readFileSync(sourceAgentsTemplate, 'utf8');
      const rendered = tmpl.replace(/^[\s\S]*?\}\}\s*(?=# AGENTS\.md)/, '');
      check(
        'create-template:agents-md:match',
        readFileSync(bundledAgents, 'utf8') === rendered,
        'create-midas/template/AGENTS.md drifted from harness/templates/AGENTS.md.tmpl render',
      );
    }
  }
  {
    const sourcePortableSkills = join(ROOT, 'harness', 'skills');
    const bundledPortableSkills = join(ROOT, 'create-midas', 'template', '.agents', 'skills');
    if (existsSync(sourcePortableSkills) && existsSync(bundledPortableSkills)) {
      const sourceNames = dirNames(sourcePortableSkills);
      const portableNames = dirNames(bundledPortableSkills);
      const sameShape = JSON.stringify(sourceNames) === JSON.stringify(portableNames);
      let sameContent = sameShape;
      if (sameShape) {
        for (const name of sourceNames) {
          const src = readFileSync(join(sourcePortableSkills, name, 'SKILL.md'), 'utf8');
          const dst = readFileSync(join(bundledPortableSkills, name, 'SKILL.md'), 'utf8');
          const srcParts = splitFrontmatter(src);
          const dstParts = parsePortableSkill(dst);
          sameContent = sameContent && !!srcParts && !!dstParts &&
            dstParts.name === name &&
            dstParts.description === normalizePortableScalar((frontmatter(src) || {}).description) &&
            Object.keys(dstParts).every((k) => ['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata'].includes(k)) &&
            dstParts.metadata['midas-harness-tier'] &&
            srcParts.body.trim() === (dst.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/) || [])[1].trim();
          if (!sameContent) break;
        }
      }
      check(
        'create-template:portable-skills:match',
        sameShape && sameContent,
        'create-midas/template/.agents/skills drifts from .claude/skills',
      );
    }
  }
  const templateScripts = join(ROOT, 'create-midas', 'template', '.harness', 'scripts');
  const expectedScripts = scriptBundleFiles();
  if (existsSync(templateScripts)) {
    const templateScriptFiles = walkRelativeFiles(templateScripts).sort();
    const sameShape = JSON.stringify(templateScriptFiles) === JSON.stringify([...expectedScripts, 'install-diagnose.mjs'].sort());
    const sameContent = sameShape && expectedScripts.every(
      (rel) => readFileSync(join(ROOT, 'scripts', rel), 'utf8') === readFileSync(join(templateScripts, rel), 'utf8'),
    ) && readFileSync(join(ROOT, 'create-midas', 'install-diagnose.mjs'), 'utf8') === readFileSync(join(templateScripts, 'install-diagnose.mjs'), 'utf8');
    check(
      'build-create:scripts-tree-match',
      sameShape && sameContent,
      'create-midas/template/.harness/scripts drifts from source scripts bundle',
    );
  }
}

// --- F3. TaskPilot verify/audit cited test paths exist on disk -------------------------------
const taskpilotProduct = join(ROOT, 'examples', 'taskpilot', '.midas', 'product');
const citedTestPaths = [
  'src/app/api/tasks/route.test.ts',
  'src/app/api/tasks/[id]/route.test.ts',
];
for (const rel of citedTestPaths) {
  check(`taskpilot:cited-test:${rel}`, existsSync(join(taskpilotProduct, rel)));
}

const stateFile = join(ROOT, 'examples', 'taskpilot', '.midas', 'state.yaml');
if (existsSync(stateFile)) {
  const s = readFileSync(stateFile, 'utf8');
  for (const key of ['midas_version', 'stage', 'cost_profile', 'routing', 'phases', 'sprints']) {
    check(`state:${key}`, new RegExp(`(^|\\n)${key}:`).test(s));
  }
}

// --- F2. routing map (balanced) reconciles with the first-party agent pins ---------------------
// The agent `model:` frontmatter is the only real runtime binding; under cost_profile: balanced the
// resolved routing ids MUST equal the pins, or selecting a model is silently a no-op. Enforced here
// for the engine; doctor.mjs runs the same reconciliation against a live project.
function agentModelT(name) {
  const p = join(agentsDir, name + '.md');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/^model:\s*([^\s#]+)/m);
  return m ? m[1] : null;
}
const pins = { orchestrate: agentModelT('midas-orchestrator'), build: agentModelT('midas-builder'), scout: agentModelT('midas-scout') };
if (existsSync(stateFile)) {
  const s = readFileSync(stateFile, 'utf8');
  const profile = (s.match(/^cost_profile:\s*([^\s#]+)/m) || [])[1];
  const lines = s.split(/\r?\n/);
  const ri = lines.findIndex((l) => /^routing:/.test(l));
  const routing = {};
  if (ri !== -1) for (let j = ri + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) {
    const m = lines[j].match(/^\s+(orchestrate|build|scout):\s*([^\s#]+)/);
    if (m) routing[m[1]] = m[2];
  }
  if (profile === 'balanced') for (const t of ['orchestrate', 'build', 'scout']) {
    check(`routing:example-matches-agent:${t}`, !!routing[t] && routing[t] === pins[t], `state ${routing[t]} != agent ${pins[t]}`);
  }
}

// --- G. no stale brand token leaked back in (built without the literal so it can't self-match) --
const STALE = 'ke' + 'el';
const staleRe = new RegExp(STALE, 'i');
const TEXT_EXT = new Set(['.md', '.mjs', '.json', '.yaml', '.yml', '.css', '.ts', '.tmpl', '.mdc', '.tsx', '.js']);
for (const f of walk(ROOT)) {
  const ext = extname(f);
  if (!TEXT_EXT.has(ext) && basename(f) !== '.gitignore' && basename(f) !== '.gitattributes') continue;
  let text = '';
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  if (staleRe.test(text)) check(`no-stale-token:${f.slice(ROOT.length + 1)}`, false, `contains '${STALE}'`);
}

// --- report ------------------------------------------------------------------------------------
// --- H. root package.json bin target exists (the `npx github:` entry point) -------------------
const rootPkg = join(ROOT, 'package.json');
if (existsSync(rootPkg)) {
  let pkg = {};
  try { pkg = JSON.parse(readFileSync(rootPkg, 'utf8')); } catch { check('root-pkg:parses', false); }
  const bins = pkg.bin ? Object.values(pkg.bin) : [];
  check('root-pkg:has-bin', bins.length > 0, 'no bin → `npx github:` install would not work');
  for (const b of bins) check(`root-bin-exists:${b}`, existsSync(join(ROOT, b)));
}

// --- report ------------------------------------------------------------------------------------
// --- I. engine version single-sourced at harness/VERSION, mirrored everywhere ------------------
function ver(rel, json) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, 'utf8');
  return json ? JSON.parse(raw).version || null : raw.trim();
}
const engineVersion = ver('harness/VERSION', false);
check('version:harness/VERSION-present', !!engineVersion, 'missing harness/VERSION');
if (engineVersion) {
  for (const f of ['package.json', 'create-midas/package.json', 'gemini-extension.json']) {
    const v = ver(f, true);
    check(`version:${f}`, v === engineVersion, `${v} != ${engineVersion}`);
  }
}
{
  const createMidasPkg = join(ROOT, 'create-midas', 'package.json');
  if (existsSync(createMidasPkg)) {
    try {
      const pkg = JSON.parse(readFileSync(createMidasPkg, 'utf8'));
      check('create-midas:pkg:bin', pkg.bin?.['create-midas'] === 'index.mjs', `bin=${pkg.bin?.['create-midas']}`);
      check('create-midas:pkg:type', pkg.type === 'module', `type=${pkg.type}`);
      check(
        'create-midas:pkg:files',
        JSON.stringify(pkg.files || []) === JSON.stringify(['index.mjs', 'install-diagnose.mjs', 'migrate-v2.mjs', 'template']),
        `files=${JSON.stringify(pkg.files || [])}`,
      );
      check('create-midas:pkg:engine-floor', pkg.engines?.node === '>=22', `node=${pkg.engines?.node}`);
      check('create-midas:pkg:homepage', pkg.homepage === 'https://github.com/okuzpe/midas-harness#readme', `homepage=${pkg.homepage}`);
      check('create-midas:pkg:repository-url', pkg.repository?.url === 'git+https://github.com/okuzpe/midas-harness.git', `repository.url=${pkg.repository?.url}`);
      check('create-midas:pkg:repository-dir', pkg.repository?.directory === 'create-midas', `repository.directory=${pkg.repository?.directory}`);
      check('create-midas:pkg:bugs', pkg.bugs?.url === 'https://github.com/okuzpe/midas-harness/issues', `bugs.url=${pkg.bugs?.url}`);
      const keywords = JSON.stringify(pkg.keywords || []);
      check(
        'create-midas:pkg:keywords',
        ['claude', 'claude-code', 'ai', 'agents', 'agents.md', 'harness', 'scaffold', 'initializer', 'context7'].every((k) => (pkg.keywords || []).includes(k)),
        `keywords=${keywords}`,
      );
    } catch (e) {
      check('create-midas:pkg:json', false, e.message);
    }
  }
}

// also assert the YAML/MD version stamps match the engine version
if (engineVersion) {
  for (const [f, re] of [
    ['harness/state.schema.md', /midas_version:\s*([0-9][^\s#]*)/],
    ['examples/taskpilot/harness/state.yaml', /^midas_version:\s*([0-9][^\s#]*)/m],
  ]) {
    const p = join(ROOT, f);
    if (existsSync(p)) {
      const m = readFileSync(p, 'utf8').match(re);
      check(`version:${f}`, !!m && m[1] === engineVersion, m ? `${m[1]} != ${engineVersion}` : 'no midas_version');
    }
  }
}

// --- J. referenced pipeline playbooks resolve (regression guard for the 00- vs 0- bug) ----------
const refSources = [join(ROOT, 'harness', 'methodology.md'), ...walk(skillsDir).filter((p) => p.endsWith('SKILL.md'))];
const pipeRe = /harness\/pipeline\/([0-9a-z][a-z0-9-]*\.md)/g;
for (const f of refSources) {
  if (!existsSync(f)) continue;
  const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');
  const text = readFileSync(f, 'utf8');
  let m;
  while ((m = pipeRe.exec(text))) {
    check(`pipeline-ref:${m[1]} (in ${rel})`, existsSync(join(ROOT, 'harness', 'pipeline', m[1])));
  }
}

// --- K. BEHAVIORAL: the out-of-model gate check actually FIRES (and doesn't cry wolf) -----------
// Runs the real doctor against two planted fixtures: one where a `done` sprint carries unresolved CRITs
// (must warn) and one that is clean (must stay quiet). This is the first test that proves a guardrail
// *works*, not just that files parse.
function doctorOutput(fixtureRel) {
  const dr = join(ROOT, 'scripts', 'doctor.mjs');
  try { return execSync(`node "${dr}" "${join(ROOT, fixtureRel)}"`, { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } // doctor exits 1; we read its output
}
if (existsSync(join(ROOT, 'scripts', 'fixtures', 'inconsistent-audit'))) {
  const bad = doctorOutput('scripts/fixtures/inconsistent-audit');
  check('behavioral:gate-fires', /warn\s+gate:audit-01/.test(bad), 'doctor did not warn gate:audit-01 on a closed sprint with an unresolved/blocked record');
  const good = doctorOutput('scripts/fixtures/consistent-audit');
  check('behavioral:gate-no-false-positive', !/warn\s+gate:audit/.test(good), 'doctor warned gate:audit on a CONSISTENT record (false positive)');
}

function doctorExit(fixtureRel, flags = '') {
  const dr = join(ROOT, 'scripts', 'doctor.mjs');
  try {
    execSync(`node "${dr}" ${flags} "${join(ROOT, fixtureRel)}"`, { cwd: ROOT, stdio: 'pipe' });
    return 0;
  } catch (e) {
    return typeof e.status === 'number' ? e.status : 1;
  }
}
if (existsSync(join(ROOT, 'scripts', 'fixtures', 'inconsistent-audit'))) {
  check(
    'behavioral:strict-exits-1-on-inconsistent',
    doctorExit('scripts/fixtures/inconsistent-audit', '--strict --gates-only') === 1,
    '--strict --gates-only must exit 1 when gate record disagrees with state',
  );
  check(
    'behavioral:strict-exits-0-on-consistent',
    doctorExit('scripts/fixtures/consistent-audit', '--strict --gates-only') === 0,
    '--strict --gates-only must exit 0 when gate records match state',
  );
}
if (existsSync(join(ROOT, 'scripts', 'fixtures', 'inconsistent-phase-evidence'))) {
  const badPhase = doctorOutput('scripts/fixtures/inconsistent-phase-evidence');
  check(
    'behavioral:gate-phase-fires',
    /warn\s+gate:phase-idea_intake/.test(badPhase),
    'doctor did not warn gate:phase-idea_intake when artifacts are missing',
  );
  const goodPhase = doctorOutput('scripts/fixtures/consistent-phase-evidence');
  check(
    'behavioral:gate-phase-no-false-positive',
    !/warn\s+gate:phase-/.test(goodPhase),
    'doctor warned gate:phase-* on a consistent phase fixture',
  );
  check(
    'behavioral:strict-exits-1-on-inconsistent-phase',
    doctorExit('scripts/fixtures/inconsistent-phase-evidence', '--strict --gates-only') === 1,
  );
  check(
    'behavioral:strict-exits-0-on-consistent-phase',
    doctorExit('scripts/fixtures/consistent-phase-evidence', '--strict --gates-only') === 0,
  );
}
if (existsSync(join(ROOT, 'scripts', 'fixtures', 'inconsistent-sprint-continuity'))) {
  const badSprint = doctorOutput('scripts/fixtures/inconsistent-sprint-continuity');
  check(
    'behavioral:gate-sprint-continuity-fires',
    /warn\s+gate:sprint-continuity/.test(badSprint),
    'doctor did not warn gate:sprint-continuity on stale active sprint without progress',
  );
  const goodSprint = doctorOutput('scripts/fixtures/consistent-sprint-continuity');
  check(
    'behavioral:gate-sprint-continuity-no-false-positive',
    !/warn\s+gate:sprint-continuity/.test(goodSprint),
    'doctor warned gate:sprint-continuity when progress file exists',
  );
  check(
    'behavioral:strict-exits-1-on-inconsistent-sprint',
    doctorExit('scripts/fixtures/inconsistent-sprint-continuity', '--strict --gates-only') === 1,
  );
  check(
    'behavioral:strict-exits-0-on-consistent-sprint',
    doctorExit('scripts/fixtures/consistent-sprint-continuity', '--strict --gates-only') === 0,
  );
}
if (existsSync(join(ROOT, 'examples', 'taskpilot'))) {
  check(
    'behavioral:taskpilot-strict-gates',
    doctorExit('examples/taskpilot', '--strict --gates-only') === 0,
    'taskpilot gate records must be consistent with state.yaml',
  );
}

// --- L0. installer --update must pass paths into readToolsFromState ---------------------------
{
  const installer = readFileSync(join(ROOT, 'create-midas', 'index.mjs'), 'utf8');
  check('installer:fillAgents-paths-arg', /function fillAgents\(tools, paths\)/.test(installer));
  check('installer:no-bare-readToolsFromState', !/readToolsFromState\(\)/.test(installer));
}

// --- L. INSTALL.md is the only user-facing #vX.Y.Z pin surface (must match harness/VERSION) -------
// Skills / installer help / SECURITY / FAQ use #v{VERSION} placeholders or read VERSION at runtime.
if (engineVersion) {
  const install = join(ROOT, 'INSTALL.md');
  if (existsSync(install)) {
    const pins = readFileSync(install, 'utf8').match(/#v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/g) || [];
    check('version-pin:INSTALL.md:has-pins', pins.length > 0, 'expected at least one #v… pin');
    for (const pin of pins) {
      check(`version-pin:INSTALL.md:${pin}`, pin.slice(2) === engineVersion, `${pin} != ${engineVersion}`);
    }
  }
  for (const f of [
    'harness/skills/midas-update/SKILL.md',
    'harness/skills/midas-reconcile/SKILL.md',
    'SECURITY.md',
    'README.md',
    'create-midas/index.mjs',
  ]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    const hardcoded = (readFileSync(p, 'utf8').match(/#v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g) || [])
      .filter((pin) => pin.slice(2) !== '{VERSION}');
    check(
      `version-pin:${f}:no-hardcoded`,
      hardcoded.length === 0,
      `unexpected literal pins: ${hardcoded.join(', ')} — use #v{VERSION} or read harness/VERSION`,
    );
  }
}

// --- M. CI workflows carry the hardened supply-chain policy -------------------------------
const workflowDir = join(ROOT, '.github', 'workflows');
for (const f of walk(workflowDir).filter((p) => ['.yml', '.yaml'].includes(extname(p)))) {
  const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');
  const text = readFileSync(f, 'utf8');
  check(`workflow:${rel}:permissions`, /^permissions:/m.test(text), 'missing top-level permissions block');
  let actionPins = 0;
  for (const m of text.matchAll(/uses:\s*(actions\/[^@\s]+)@([^\s#]+)/g)) {
    actionPins++;
    check(
      `workflow:${rel}:actions-pinned:${m[1]}`,
      /^[a-f0-9]{40}$/i.test(m[2]),
      'official actions must be pinned to commit SHA, with the major tag kept in a comment',
    );
  }
  check(`workflow:${rel}:has-action-pins`, actionPins > 0, 'workflow has no official action pins to verify');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/\bpip install\s+(.+)/);
    if (!m) continue;
    const args = m[1].split(/\s+/).filter(Boolean);
    for (let i = 0; i < args.length; i++) {
      const a = args[i].replace(/#.*/, '');
      if (!a || a.startsWith('-')) {
        if (a === '-r' || a === '--requirement') i++;
        continue;
      }
      check(`workflow:${rel}:pip-pin:${a}`, /==|@/.test(a), 'pip installs in CI must be exact-pinned');
    }
  }
}
const docsWorkflow = join(ROOT, '.github', 'workflows', 'docs.yml');
if (existsSync(docsWorkflow)) {
  const docs = readFileSync(docsWorkflow, 'utf8');
  check('workflow:docs:build-read-only', /build:\s*[\s\S]*?permissions:\s*\n\s+contents:\s*read/.test(docs));
  check('workflow:docs:deploy-pages-only', /deploy:\s*[\s\S]*?permissions:\s*\n\s+pages:\s*write\s*\n\s+id-token:\s*write/.test(docs));
}

// --- N. MCP defaults stay secret-free, portable, and Windows-safe when installed --------------
for (const f of ['.mcp.json', 'create-midas/template/.mcp.json', 'plugins/midas/.mcp.json']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, 'utf8');
  let json = null;
  try { json = JSON.parse(text); } catch (e) { check(`mcp:${f}:json`, false, e.message); continue; }
  const servers = Object.values(json.mcpServers || {});
  for (const s of servers) {
    check(`mcp:${f}:no-literal-secret`, !JSON.stringify(s).match(/(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,})/));
    check(`mcp:${f}:no-active-latest`, !JSON.stringify(s.args || []).includes('@latest'), 'active MCP defaults must be pinned or documented exceptions');
  }
}
if (existsSync(join(ROOT, '.mcp.json')) && existsSync(join(ROOT, 'plugins', 'midas', '.mcp.json'))) {
  check(
    'mcp:plugin-matches-root',
    readFileSync(join(ROOT, '.mcp.json'), 'utf8') === readFileSync(join(ROOT, 'plugins', 'midas', '.mcp.json'), 'utf8'),
    're-run build-plugin.mjs',
  );
}
const installer = readFileSync(join(ROOT, 'create-midas', 'index.mjs'), 'utf8');
check('mcp:installer-wraps-npx-on-windows', /mcp-cursor-sync\.mjs/.test(installer) && /syncCursorMcp/.test(installer));
check('mcp:installer-preserves-user-config', /rel === '\.mcp\.json'/.test(installer), '.mcp.json must remain user-owned on update');

// --- N. mcp:declared-vs-wired logic (unit + behavioral via doctor) ------------------------------
{
  const stateOptional = 'mcp: [context7, sequential-thinking]\n';
  const mcpSeq = JSON.stringify({ mcpServers: { 'sequential-thinking': { command: 'npx' } } });
  const r1 = evaluateMcpDeclaredVsWired(stateOptional, mcpSeq);
  check('mcp-drift:optional-context7-ok', r1.status === 'ok' && /context7/.test(r1.note));

  const stateSeqOnly = 'mcp: [sequential-thinking]\n';
  const r2 = evaluateMcpDeclaredVsWired(stateSeqOnly, null);
  check('mcp-drift:missing-json-warns', r2.status === 'warn' && /no \.mcp\.json/.test(r2.note));

  const stateBrowser = 'mcp: [playwright]\n';
  const r3 = evaluateMcpDeclaredVsWired(stateBrowser, mcpSeq);
  check('mcp-drift:browser-missing-warns', r3.status === 'warn' && /playwright/.test(r3.note) && /browser blocks/.test(r3.note));

  const r4 = evaluateMcpDeclaredVsWired('', null);
  check('mcp-drift:empty-state-skips', r4.status === 'skip');

  const r5 = evaluateSkillMcpRequired(['playwright'], mcpSeq);
  check('mcp-drift:skill-required-warns', r5.status === 'warn' && /playwright/.test(r5.note));

  const r6 = evaluateSkillMcpRequired(['sequential-thinking'], mcpSeq);
  check('mcp-drift:skill-required-ok', r6.status === 'ok');

  const stateMaestro = 'mcp: [maestro, sequential-thinking]\n';
  const r7 = evaluateMcpDeclaredVsWired(stateMaestro, mcpSeq);
  check('mcp-drift:optional-maestro-ok', r7.status === 'ok' && /maestro/.test(r7.note));
}

{
  const { diagnoseProject } = await import(pathToFileURL(join(ROOT, 'create-midas', 'install-diagnose.mjs')).href);
  const tmp = mkdtempSync(join(tmpdir(), 'midas-diag-'));
  const r1 = diagnoseProject(tmp);
  check('diagnose:not-installed', r1.status === 'not_installed' && r1.nextCli?.includes('npx'));
  mkdirSync(join(tmp, '.harness', 'engine'), { recursive: true });
  writeFileSync(join(tmp, '.harness', 'engine', 'VERSION'), '2.0.0-rc.1\n', 'utf8');
  writeFileSync(
    join(tmp, '.harness', 'state.yaml'),
    'midas_version: 2.0.0-rc.1\nlayout: harness\nsetup_complete: false\n',
    'utf8',
  );
  const r2 = diagnoseProject(tmp);
  check('diagnose:setup-pending', r2.status === 'setup_pending' && r2.nextSlash === '/midas-init');
  rmSync(tmp, { recursive: true, force: true });
}
{
  const tmp = mkdtempSync(join(tmpdir(), 'midas-diag-cli-'));
  const r = spawnSync('node', [join(ROOT, 'create-midas', 'index.mjs'), '--diagnose', tmp], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  check(
    'diagnose:cli:runs',
    r.status === 1 && /Midas diagnose/.test(r.stdout || '') && /Status:/.test(r.stdout || ''),
    r.stderr || r.stdout || `exit ${r.status}`,
  );
  rmSync(tmp, { recursive: true, force: true });
}
{
  const tmp = mkdtempSync(join(tmpdir(), 'midas-diag-missing-'));
  rmSync(tmp, { recursive: true, force: true });
  const r = spawnSync('node', [join(ROOT, 'create-midas', 'index.mjs'), '--diagnose', tmp], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  check(
    'diagnose:missing-path-is-read-only',
    r.status === 1 && /Status: not_installed/.test(r.stdout || '') && !existsSync(tmp),
    r.stderr || r.stdout || `exit ${r.status}`,
  );
}
if (existsSync(join(ROOT, 'examples', 'taskpilot'))) {
  const tpOut = doctorOutput('examples/taskpilot');
  check('behavioral:mcp-drift-taskpilot', /ok\s+mcp:declared-vs-wired/.test(tpOut), 'taskpilot .mcp.json should satisfy declared MCPs');
  const tpGi = auditGitignore(join(ROOT, 'examples', 'taskpilot'));
  check('taskpilot:gitignore-audit', tpGi.status === 'ok', tpGi.note);
}

// --- O. tool selection + tool-aware adapter render ----------------------------------------------
check('render:tool-aware-default', resolveAdapterTools(ROOT).join(',') === DEFAULT_ADAPTER_TOOLS.join(','));
const defaultAdapterPaths = computeAdapters(ROOT).files.map((f) => f.path).sort();
check('render:tool-aware-default:four-adapters', defaultAdapterPaths.length === 4, defaultAdapterPaths.join(', '));

const narrowRoot = mkdtempSync(join(tmpdir(), 'midas-test-'));
mkdirSync(join(narrowRoot, 'harness'), { recursive: true });
writeFileSync(join(narrowRoot, 'harness', 'state.yaml'), 'tools: [cursor]\n');
const narrowPaths = computeAdapters(narrowRoot).files.map((f) => f.path);
check('render:tool-aware-narrow', narrowPaths.length === 1 && narrowPaths[0] === '.cursor/rules/00-midas.mdc');
check('render:tool-aware-narrow:no-claude', !narrowPaths.includes('CLAUDE.md'));
rmSync(narrowRoot, { recursive: true, force: true });

check('installer:tools-flag', /--tools/.test(installer) && /KNOWN_TOOLS/.test(installer));
check('installer:tool-onboarding', /printToolOnboarding/.test(installer) && /tool-profiles\.mjs/.test(installer));
check('installer:no-root-gemini-extension', !/function ensureGeminiExtension/.test(installer));
check('installer:tools-presets', /parseToolsPreset/.test(readFileSync(join(ROOT, 'scripts', 'tool-profiles.mjs'), 'utf8')));
check('installer:tty-fallback', /stdin\.isTTY/.test(installer));
check('installer:update-honours-tools', /update && hasToolsFlag\(\)/.test(installer) && /rewriteStateTools/.test(installer));
check('installer:sync-skill-mirrors', /async function syncSkillMirrors/.test(installer) && /\.cursor\/skills/.test(installer));
check('installer:default-tools-cursor', /const DEFAULT_TOOLS = \['cursor'\]/.test(installer));
check('installer:prune-orphan-adapters', /function pruneOrphanAdapters/.test(installer));
check(
  'engine-state:classic-layout-declared',
  /^layout:\s*classic$/m.test(readFileSync(join(ROOT, 'harness', 'state.yaml'), 'utf8')),
  'engine harness/state.yaml must declare layout: classic (dogfood honesty)',
);
check(
  'ci:user-shape-cursor-smoke',
  /Installer smoke test \(user shape — cursor-only thin root\)/.test(
    readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8'),
  ),
);
const knownMatch = installer.match(/KNOWN_TOOLS\s*=\s*\[([^\]]+)\]/);
if (knownMatch) {
  const known = knownMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, ''));
  check('installer:tools-vocabulary', known.join(',') === 'claude-code,cursor,windsurf,gemini,codex,copilot');
}

const snippetPath = join(ROOT, 'harness', 'templates', 'gitignore-midas.snippet');
check('gitignore:snippet-exists', existsSync(snippetPath));
if (existsSync(snippetPath)) {
  const snippet = readFileSync(snippetPath, 'utf8');
  for (const pat of ['\\.env', '\\*\\.pem', 'secret', 'credential']) {
    check(`gitignore:snippet:${pat}`, new RegExp(pat).test(snippet), 'security.md CHECK patterns');
  }
  check('gitignore:snippet:volatile-hash', /\.harness\/\*\.hash/.test(snippet));
  check('gitignore:snippet:node-modules', /\bnode_modules\//.test(snippet));
  check('gitignore:snippet:coverage', /\bcoverage\//.test(snippet));
  check('gitignore:snippet:playwright-report', /playwright-report\//.test(snippet));
  check('gitignore:snippet:status-html', /\bstatus\.html\b/.test(snippet));
}
check('gitignore:merge-module', existsSync(join(ROOT, 'scripts', 'gitignore-merge.mjs')));
check('gitignore:audit-export', /export function auditGitignore/.test(readFileSync(join(ROOT, 'scripts', 'gitignore-merge.mjs'), 'utf8')));
check('doctor:gitignore-check', /gitignore:midas-block/.test(readFileSync(join(ROOT, 'scripts', 'doctor.mjs'), 'utf8')));
{
  const giRoot = mkdtempSync(join(tmpdir(), 'midas-gi-'));
  const tplDir = join(giRoot, 'harness', 'templates');
  mkdirSync(tplDir, { recursive: true });
  writeFileSync(
    join(tplDir, 'gitignore-midas.snippet'),
    '# test\nnode_modules/\n.harness/cache/\n',
    'utf8',
  );
  const r1 = ensureMidasGitignore(giRoot);
  check('gitignore:merge-writes-block', r1.wrote && !r1.upgraded);
  const r2 = ensureMidasGitignore(giRoot);
  check('gitignore:merge-idempotent', !r2.wrote);
  writeFileSync(
    join(giRoot, '.gitignore'),
    `${GITIGNORE_BEGIN}\n.env\n${GITIGNORE_END}\n`,
    'utf8',
  );
  const r3 = ensureMidasGitignore(giRoot);
  check('gitignore:merge-upgrades-missing', r3.wrote && r3.upgraded && readFileSync(join(giRoot, '.gitignore'), 'utf8').includes('node_modules/'));
  rmSync(giRoot, { recursive: true, force: true });
}
check('installer:ensure-gitignore', /async function ensureGitignore\(paths\)/.test(installer));
check('installer:gitignore-merge', /gitignore-merge\.mjs/.test(installer));
check('installer:gitignore-report-always', /reportGitignoreLine|gitignore: Midas block already up to date/.test(installer));
check('installer:gitignore-after-engine', /After engine copy so the latest gitignore/.test(installer));
check('installer:verify-after-update', /function verifyInstall\(paths\)/.test(installer) && /runDoctor\(TARGET, paths/.test(installer));
check('installer:layout-flag', /installLayoutFlag !== 'harness'/.test(installer) && /--migrate/.test(installer));
check('installer:hasMidasInstall-compact', /hasMidasInstall[\s\S]*\.midas/.test(installer));
{
  const rollbackRoot = mkdtempSync(join(tmpdir(), 'midas-install-rollback-'));
  try {
    writeFileSync(join(rollbackRoot, 'keep.txt'), 'keep\n', 'utf8');
    try {
      execSync(`node "${join(ROOT, 'create-midas', 'index.mjs')}" "${rollbackRoot}"`, {
        cwd: ROOT,
        stdio: 'pipe',
        env: { ...process.env, MIDAS_TEST_FAIL_STEP: 'after-layout' },
      });
      check('installer:rollback-restores', false, 'installer unexpectedly succeeded');
    } catch {
      check(
        'installer:rollback-restores',
        existsSync(join(rollbackRoot, 'keep.txt')) &&
          !existsSync(join(rollbackRoot, 'harness')) &&
          !existsSync(join(rollbackRoot, '.midas')) &&
          !existsSync(join(rollbackRoot, 'CLAUDE.md')) &&
          !existsSync(join(rollbackRoot, 'AGENTS.md')),
        'installer rollback left behind install artifacts',
      );
    }
  } finally {
    rmSync(rollbackRoot, { recursive: true, force: true });
  }
}
{
  const updateRoot = mkdtempSync(join(tmpdir(), 'midas-v2-update-conflict-'));
  try {
    const install = spawnSync(process.execPath, [join(ROOT, 'create-midas', 'index.mjs'), '--tools=cursor', updateRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check('installer:update-conflict-fixture-install', install.status === 0, install.stderr || install.stdout);
    const vendor = join(updateRoot, '.harness', 'engine', 'conventions.md');
    const modified = `${readFileSync(vendor, 'utf8')}\nproject edit outside overlay\n`;
    writeFileSync(vendor, modified, 'utf8');
    const before = treeDigest(updateRoot);
    const updateResult = spawnSync(process.execPath, [join(ROOT, 'create-midas', 'index.mjs'), '--update', updateRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check(
      'installer:update-vendor-conflict-prewrite',
      updateResult.status === 1 &&
        /vendor files were modified/.test(`${updateResult.stdout}${updateResult.stderr}`) &&
        treeDigest(updateRoot) === before &&
        readFileSync(vendor, 'utf8') === modified,
      updateResult.stderr || updateResult.stdout,
    );
  } finally {
    rmSync(updateRoot, { recursive: true, force: true });
  }
}
{
  const pruneRoot = mkdtempSync(join(tmpdir(), 'midas-v2-update-tools-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'create-midas', 'index.mjs'), '--tools=claude-code,cursor,windsurf,gemini', pruneRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:update-tools-fixture-install', install.status === 0, install.stderr || install.stdout);
    const updateResult = spawnSync(
      process.execPath,
      [join(ROOT, 'create-midas', 'index.mjs'), '--update', '--tools=cursor', pruneRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const state = existsSync(join(pruneRoot, '.harness', 'state.yaml'))
      ? readFileSync(join(pruneRoot, '.harness', 'state.yaml'), 'utf8')
      : '';
    check(
      'installer:update-tools-rewrites-and-prunes',
      updateResult.status === 0 &&
        /tools:\s*\[cursor\]/.test(state) &&
        existsSync(join(pruneRoot, '.cursor', 'skills')) &&
        existsSync(join(pruneRoot, '.cursor', 'rules', '00-midas.mdc')) &&
        !existsSync(join(pruneRoot, '.claude')) &&
        !existsSync(join(pruneRoot, '.agents')) &&
        !existsSync(join(pruneRoot, '.windsurf')) &&
        !existsSync(join(pruneRoot, 'GEMINI.md')),
      updateResult.stderr || updateResult.stdout,
    );
  } finally {
    rmSync(pruneRoot, { recursive: true, force: true });
  }
}
{
  const userMirrorRoot = mkdtempSync(join(tmpdir(), 'midas-v2-user-mirror-'));
  try {
    mkdirSync(join(userMirrorRoot, '.agents', 'skills', 'acme-local'), { recursive: true });
    writeFileSync(
      join(userMirrorRoot, '.agents', 'skills', 'acme-local', 'SKILL.md'),
      '---\nname: acme-local\ndescription: User-owned local skill.\n---\n\n# User skill\n',
      'utf8',
    );
    writeFileSync(join(userMirrorRoot, 'AGENTS.md'), '# Existing project law\n', 'utf8');
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'create-midas', 'index.mjs'), '--tools=codex', userMirrorRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const manifestPath = join(userMirrorRoot, '.harness', 'manifest.json');
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
    check(
      'installer:user-host-contributions-preserved',
      install.status === 0 &&
        existsSync(join(userMirrorRoot, '.agents', 'skills', 'acme-local', 'SKILL.md')) &&
        /Existing project law/.test(readFileSync(join(userMirrorRoot, 'AGENTS.md'), 'utf8')) &&
        /midas:begin AGENTS/.test(readFileSync(join(userMirrorRoot, 'AGENTS.md'), 'utf8')) &&
        !manifest?.files?.some((file) => file.path.includes('acme-local')),
      install.stderr || install.stdout,
    );
  } finally {
    rmSync(userMirrorRoot, { recursive: true, force: true });
  }
}
{
  const cursorMcpRoot = mkdtempSync(join(tmpdir(), 'midas-v2-cursor-mcp-conflict-'));
  try {
    mkdirSync(join(cursorMcpRoot, '.cursor'), { recursive: true });
    writeFileSync(
      join(cursorMcpRoot, '.cursor', 'mcp.json'),
      '{\n  "mcpServers": { "user-server": { "command": "user-command" } }\n}\n',
      'utf8',
    );
    const before = treeDigest(cursorMcpRoot);
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'create-midas', 'index.mjs'), '--tools=cursor', cursorMcpRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:cursor-mcp-conflict-rolls-back',
      install.status === 1 &&
        /Cursor config before installing/.test(`${install.stdout}${install.stderr}`) &&
        treeDigest(cursorMcpRoot) === before,
      install.stderr || install.stdout,
    );
  } finally {
    rmSync(cursorMcpRoot, { recursive: true, force: true });
  }
}
{
  const projectRulesRoot = mkdtempSync(join(tmpdir(), 'midas-v2-project-rules-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'create-midas', 'index.mjs'), '--tools=cursor', projectRulesRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:project-rules-fixture-install', install.status === 0, install.stderr || install.stdout);
    const engineBefore = treeDigest(join(projectRulesRoot, '.harness', 'engine'));
    mkdirSync(join(projectRulesRoot, '.harness', 'rules'), { recursive: true });
    writeFileSync(
      join(projectRulesRoot, '.harness', 'rules', 'local-policy.md'),
      '# Local policy\n\n**CHECK:** `manual:` local policy reviewed.\n',
      'utf8',
    );
    const doctorScript = join(projectRulesRoot, '.harness', 'scripts', 'doctor.mjs');
    const fix = spawnSync(process.execPath, [doctorScript, '--fix'], {
      cwd: projectRulesRoot,
      encoding: 'utf8',
    });
    const strict = spawnSync(process.execPath, [doctorScript, '--strict'], {
      cwd: projectRulesRoot,
      encoding: 'utf8',
    });
    check(
      'doctor:project-rule-overlay-keeps-vendor-immutable',
      fix.status === 0 &&
        strict.status === 0 &&
        treeDigest(join(projectRulesRoot, '.harness', 'engine')) === engineBefore &&
        /Local policy/.test(readFileSync(join(projectRulesRoot, '.cursor', 'rules', '00-midas.mdc'), 'utf8')) &&
        /rules:combined/.test(strict.stdout || ''),
      `${fix.stderr || fix.stdout}\n${strict.stderr || strict.stdout}`,
    );

    writeFileSync(
      join(projectRulesRoot, '.harness', 'rules', 'local-policy.md'),
      '# Local policy without a check\n',
      'utf8',
    );
    const invalid = spawnSync(process.execPath, [doctorScript, '--strict'], {
      cwd: projectRulesRoot,
      encoding: 'utf8',
    });
    check(
      'doctor:invalid-project-rule-blocks-strict',
      invalid.status === 1 && /rules:combined/.test(`${invalid.stdout}${invalid.stderr}`),
      invalid.stderr || invalid.stdout,
    );
  } finally {
    rmSync(projectRulesRoot, { recursive: true, force: true });
  }
}
{
  const uninstallRoot = mkdtempSync(join(tmpdir(), 'midas-v2-uninstall-'));
  try {
    mkdirSync(join(uninstallRoot, '.agents', 'skills', 'acme-local'), { recursive: true });
    writeFileSync(
      join(uninstallRoot, '.agents', 'skills', 'acme-local', 'SKILL.md'),
      '---\nname: acme-local\ndescription: User-owned local skill.\n---\n\n# User skill\n',
      'utf8',
    );
    writeFileSync(join(uninstallRoot, 'AGENTS.md'), '# Existing project law\n', 'utf8');
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'create-midas', 'index.mjs'), '--tools=codex', uninstallRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:uninstall-fixture-install', install.status === 0, install.stderr || install.stdout);

    const vendor = join(uninstallRoot, '.harness', 'engine', 'conventions.md');
    const modifiedVendor = `${readFileSync(vendor, 'utf8')}\nproject-local vendor edit\n`;
    writeFileSync(vendor, modifiedVendor, 'utf8');
    mkdirSync(join(uninstallRoot, '.harness', 'rules'), { recursive: true });
    writeFileSync(join(uninstallRoot, '.harness', 'rules', 'local.md'), '# Local rule\n', 'utf8');

    const uninstallResult = spawnSync(
      process.execPath,
      [join(ROOT, 'create-midas', 'index.mjs'), '--uninstall', uninstallRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const agents = readFileSync(join(uninstallRoot, 'AGENTS.md'), 'utf8');
    check(
      'installer:uninstall-respects-ownership',
      uninstallResult.status === 0 &&
        readFileSync(vendor, 'utf8') === modifiedVendor &&
        existsSync(join(uninstallRoot, '.harness', 'state.yaml')) &&
        existsSync(join(uninstallRoot, '.harness', 'rules', 'local.md')) &&
        existsSync(join(uninstallRoot, '.agents', 'skills', 'acme-local', 'SKILL.md')) &&
        !existsSync(join(uninstallRoot, '.harness', 'engine', 'VERSION')) &&
        !existsSync(join(uninstallRoot, '.harness', 'manifest.json')) &&
        /Existing project law/.test(agents) &&
        !/midas:begin AGENTS/.test(agents),
      uninstallResult.stderr || uninstallResult.stdout,
    );
  } finally {
    rmSync(uninstallRoot, { recursive: true, force: true });
  }
}
{
  const legacyUpdateRoot = mkdtempSync(join(tmpdir(), 'midas-v1-update-refusal-'));
  try {
    mkdirSync(join(legacyUpdateRoot, 'harness'), { recursive: true });
    writeFileSync(join(legacyUpdateRoot, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(join(legacyUpdateRoot, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\n', 'utf8');
    const before = treeDigest(legacyUpdateRoot);
    const updateResult = spawnSync(process.execPath, [join(ROOT, 'create-midas', 'index.mjs'), '--update', legacyUpdateRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check(
      'installer:update-refuses-v1-without-writing',
      updateResult.status === 1 &&
        /--migrate/.test(`${updateResult.stdout}${updateResult.stderr}`) &&
        treeDigest(legacyUpdateRoot) === before,
      updateResult.stderr || updateResult.stdout,
    );
  } finally {
    rmSync(legacyUpdateRoot, { recursive: true, force: true });
  }
}
{
  const migrationRollbackRoot = mkdtempSync(join(tmpdir(), 'midas-v2-cli-rollback-'));
  try {
    mkdirSync(join(migrationRollbackRoot, 'harness'), { recursive: true });
    mkdirSync(join(migrationRollbackRoot, 'scripts'), { recursive: true });
    mkdirSync(join(migrationRollbackRoot, 'product'), { recursive: true });
    writeFileSync(join(migrationRollbackRoot, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(join(migrationRollbackRoot, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\n', 'utf8');
    writeFileSync(join(migrationRollbackRoot, 'scripts', 'doctor.mjs'), '// Midas doctor\n', 'utf8');
    writeFileSync(join(migrationRollbackRoot, 'product', 'idea.md'), '# idea\n', 'utf8');
    const before = treeDigest(migrationRollbackRoot);
    const migration = spawnSync(
      process.execPath,
      [join(ROOT, 'create-midas', 'index.mjs'), '--migrate', '--apply', migrationRollbackRoot],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, MIDAS_TEST_FAIL_STEP: 'after-state' },
      },
    );
    check(
      'installer:migration-rollback-after-install-failure',
      migration.status === 1 &&
        /restored previous files/.test(`${migration.stdout}${migration.stderr}`) &&
        treeDigest(migrationRollbackRoot) === before,
      migration.stderr || migration.stdout,
    );
  } finally {
    rmSync(migrationRollbackRoot, { recursive: true, force: true });
  }
}

// --- M. layout resolver (ADR-001) --------------------------------------------------------------
check('paths:module-exists', existsSync(join(ROOT, 'scripts', 'paths.mjs')));
{
  const classic = resolvePaths(ROOT);
  check('paths:classic-engine', classic.engine === 'harness');
  check('paths:classic-state', classic.state === 'harness/state.yaml');
  check('paths:classic-runs', classic.runs === '.harness');
  check('paths:runs-subdirs', RUNS_SUBDIRS.includes('sprints') && RUNS_SUBDIRS.includes('sweeps'));
  check('paths:migration-map-sprints', MIGRATION_MAP.some((m) => m.from === '.harness/sprints'));
  check('paths:hub-product-move', MIGRATION_MAP_HUB.some((m) => m.from === 'product'));
  check('paths:hub-yaml-product', hubPathsYaml().product === '.midas/product');
}
{
  const compactRoot = mkdtempSync(join(tmpdir(), 'midas-compact-'));
  try {
    mkdirSync(join(compactRoot, '.midas', 'engine'), { recursive: true });
    mkdirSync(join(compactRoot, 'product'), { recursive: true });
    writeFileSync(join(compactRoot, '.midas', 'state.yaml'), 'midas_version: 0.0.0\nlayout: compact\n', 'utf8');
    check('paths:detect-compact', detectLayout(compactRoot) === 'compact');
    const cp = resolvePaths(compactRoot);
    check('paths:compact-engine', cp.engine === '.midas/engine');
    check('paths:compact-runs', cp.runs === '.midas');
    check('paths:compact-product', cp.product === 'product');
    check('paths:compact-runs-audits', cp.runsPath('audits') === '.midas/audits');
  } finally {
    rmSync(compactRoot, { recursive: true, force: true });
  }
}
{
  const hubRoot = mkdtempSync(join(tmpdir(), 'midas-hub-'));
  try {
    mkdirSync(join(hubRoot, '.midas', 'engine'), { recursive: true });
    mkdirSync(join(hubRoot, '.midas', 'product'), { recursive: true });
    writeFileSync(join(hubRoot, '.midas', 'state.yaml'), 'midas_version: 1.0.0\nlayout: hub\n', 'utf8');
    check('paths:detect-hub', detectLayout(hubRoot) === 'hub');
    const hp = resolvePaths(hubRoot);
    check('paths:hub-engine', hp.engine === '.midas/engine');
    check('paths:hub-product', hp.product === '.midas/product');
    check('paths:hub-runs', hp.runs === '.midas');
    const hubDoctor = join(hubRoot, '.midas', 'scripts', 'doctor.mjs');
    mkdirSync(dirname(hubDoctor), { recursive: true });
    writeFileSync(hubDoctor, '// stub\n', 'utf8');
    check(
      'paths:script-root-hub',
      resolveProjectRootFromScript(pathToFileURL(hubDoctor).href) === hubRoot,
    );
  } finally {
    rmSync(hubRoot, { recursive: true, force: true });
  }
}
check('migrate-layout:module-exists', existsSync(join(ROOT, 'scripts', 'migrate-layout.mjs')));
{
  const migRoot = mkdtempSync(join(tmpdir(), 'midas-migrate-hub-'));
  try {
    mkdirSync(join(migRoot, 'harness'), { recursive: true });
    mkdirSync(join(migRoot, 'product'), { recursive: true });
    writeFileSync(join(migRoot, 'harness', 'VERSION'), '1.0.0\n', 'utf8');
    writeFileSync(join(migRoot, 'harness', 'state.yaml'), 'midas_version: 1.0.0\nname: mig-fixture\n', 'utf8');
    writeFileSync(join(migRoot, 'product', 'idea.md'), '# idea\n', 'utf8');
    const dry = execSync(
      `node "${join(ROOT, 'scripts', 'migrate-layout.mjs')}" --target=hub "${migRoot}"`,
      { encoding: 'utf8' },
    );
    check('migrate:hub-dry-run-label', /classic → hub/i.test(dry));
    check('migrate:hub-dry-run-product-row', /product\s+→\s+\.midas\/product/.test(dry));
    check('migrate:hub-dry-run-no-move', existsSync(join(migRoot, 'product', 'idea.md')));
    execSync(`node "${join(ROOT, 'scripts', 'migrate-layout.mjs')}" --target=hub --apply "${migRoot}"`, {
      encoding: 'utf8',
    });
    check('migrate:hub-apply-product', existsSync(join(migRoot, '.midas', 'product', 'idea.md')));
    check('migrate:hub-apply-layout', /layout:\s*hub/.test(readFileSync(join(migRoot, '.midas', 'state.yaml'), 'utf8')));
    check('migrate:hub-apply-no-root-product', !existsSync(join(migRoot, 'product')));
  } finally {
    rmSync(migRoot, { recursive: true, force: true });
  }
}

// --- M2. v2 migration is previewable, transactional, selective, and idempotent ----------------
{
  const migrationRoot = mkdtempSync(join(tmpdir(), 'midas v2 migration '));
  try {
    mkdirSync(join(migrationRoot, 'harness', 'rules'), { recursive: true });
    mkdirSync(join(migrationRoot, 'scripts'), { recursive: true });
    mkdirSync(join(migrationRoot, 'product'), { recursive: true });
    mkdirSync(join(migrationRoot, '.harness', 'audits'), { recursive: true });
    mkdirSync(join(migrationRoot, '.agents', 'skills', 'acme-local'), { recursive: true });
    mkdirSync(join(migrationRoot, '.agents', 'skills', 'midas-known'), { recursive: true });
    writeFileSync(join(migrationRoot, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(
      join(migrationRoot, 'harness', 'state.yaml'),
      [
        'midas_version: 1.1.4',
        'layout: classic',
        'paths:',
        '  engine: harness',
        '  scripts: scripts',
        '  state: harness/state.yaml',
        '  product: product',
        'artifact: product/idea.md',
        'note: "leave product/custom.txt unchanged in prose"',
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      join(migrationRoot, 'harness', 'rules', 'testing.md'),
      '# Testing\n\n**CHECK:** baseline\n\n## Amendment — project\n\nKeep the custom runner.\n',
      'utf8',
    );
    writeFileSync(join(migrationRoot, 'scripts', 'doctor.mjs'), '// Midas doctor\n', 'utf8');
    writeFileSync(join(migrationRoot, 'scripts', 'app.mjs'), '// application script\n', 'utf8');
    writeFileSync(join(migrationRoot, 'product', 'idea.md'), '# Midas idea\n', 'utf8');
    writeFileSync(join(migrationRoot, 'product', 'custom.txt'), 'application data\n', 'utf8');
    writeFileSync(join(migrationRoot, '.harness', 'audits', 'audit-01.md'), '# evidence\n', 'utf8');
    writeFileSync(
      join(migrationRoot, '.agents', 'skills', 'acme-local', 'SKILL.md'),
      '---\nname: acme-local\ndescription: User skill.\n---\n',
      'utf8',
    );
    writeFileSync(
      join(migrationRoot, '.agents', 'skills', 'midas-known', 'SKILL.md'),
      '---\nname: midas-known\ndescription: Generated mirror.\nmetadata:\n  midas-harness-tier: build\n---\n',
      'utf8',
    );

    const beforePreview = treeDigest(migrationRoot);
    const plan = planV2Migration(migrationRoot);
    check('migrate-v2:preview-read-only', treeDigest(migrationRoot) === beforePreview);
    check('migrate-v2:detect-classic', plan.from_layout === 'classic');
    check('migrate-v2:preserves-unknown-script', plan.preserved.includes('scripts/app.mjs'));
    check('migrate-v2:preserves-unknown-product', plan.preserved.includes('product/custom.txt'));
    check('migrate-v2:preserves-user-skill', plan.preserved.includes('.agents/skills/acme-local/SKILL.md'));
    check(
      'migrate-v2:archives-known-mirror',
      plan.rows.some((row) =>
        row.from === '.agents/skills/midas-known/SKILL.md' &&
        row.to.includes('/host-mirrors/.agents/skills/midas-known/SKILL.md')
      ),
    );

    process.env.MIDAS_TEST_FAIL_STEP = 'after-delete';
    try {
      applyV2Migration(migrationRoot, plan);
      check('migrate-v2:rollback-injected', false, 'migration unexpectedly succeeded');
    } catch {
      check('migrate-v2:rollback-injected', treeDigest(migrationRoot) === beforePreview);
    } finally {
      delete process.env.MIDAS_TEST_FAIL_STEP;
    }

    applyV2Migration(migrationRoot, plan);
    const extracted = extractLegacyRuleOverrides(migrationRoot, plan, ['testing.md']);
    const migratedState = readFileSync(join(migrationRoot, '.harness', 'state.yaml'), 'utf8');
    check('migrate-v2:canonical-state', /^layout:\s*harness$/m.test(migratedState));
    check('migrate-v2:canonical-paths', /product:\s*\.harness\/product/.test(migratedState));
    check('migrate-v2:known-state-path-rewritten', /^artifact:\s*\.harness\/product\/idea\.md$/m.test(migratedState));
    check('migrate-v2:prose-not-rewritten', /note: "leave product\/custom\.txt unchanged in prose"/.test(migratedState));
    check('migrate-v2:product-moved', existsSync(join(migrationRoot, '.harness', 'product', 'idea.md')));
    check('migrate-v2:run-moved', existsSync(join(migrationRoot, '.harness', 'runs', 'audits', 'audit-01.md')));
    check('migrate-v2:unknowns-stay', existsSync(join(migrationRoot, 'scripts', 'app.mjs')) && existsSync(join(migrationRoot, 'product', 'custom.txt')));
    check('migrate-v2:user-skill-stays', existsSync(join(migrationRoot, '.agents', 'skills', 'acme-local', 'SKILL.md')));
    check('migrate-v2:amendment-extracted', extracted.includes('.harness/rules/legacy-testing-amendments.md'));
    check('migrate-v2:idempotent-plan', planV2Migration(migrationRoot).rows.length === 0);
  } finally {
    rmSync(migrationRoot, { recursive: true, force: true });
  }
}
for (const legacyLayout of ['compact', 'hub']) {
  const migrationRoot = mkdtempSync(join(tmpdir(), `midas-v2-${legacyLayout}-`));
  try {
    mkdirSync(join(migrationRoot, '.midas', 'engine'), { recursive: true });
    mkdirSync(join(migrationRoot, '.midas', 'scripts'), { recursive: true });
    const productRoot = legacyLayout === 'hub'
      ? join(migrationRoot, '.midas', 'product')
      : join(migrationRoot, 'product');
    mkdirSync(productRoot, { recursive: true });
    writeFileSync(join(migrationRoot, '.midas', 'engine', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(
      join(migrationRoot, '.midas', 'state.yaml'),
      `midas_version: 1.1.4\nlayout: ${legacyLayout}\n`,
      'utf8',
    );
    writeFileSync(join(migrationRoot, '.midas', 'scripts', 'doctor.mjs'), '// Midas doctor\n', 'utf8');
    writeFileSync(
      join(migrationRoot, '.midas', 'scripts', 'status-page.mjs'),
      '// status-page.mjs — generate a static status.html from state + runs artifacts\nconst title = "Midas harness status";\n',
      'utf8',
    );
    writeFileSync(join(productRoot, 'idea.md'), '# idea\n', 'utf8');
    const plan = planV2Migration(migrationRoot);
    check(`migrate-v2:${legacyLayout}:detected`, plan.from_layout === legacyLayout);
    check(`migrate-v2:${legacyLayout}:known-script-signature`, !plan.preserved.includes('.midas/scripts/status-page.mjs'));
    applyV2Migration(migrationRoot, plan);
    check(`migrate-v2:${legacyLayout}:product`, existsSync(join(migrationRoot, '.harness', 'product', 'idea.md')));
    check(`migrate-v2:${legacyLayout}:state`, /^layout:\s*harness$/m.test(readFileSync(join(migrationRoot, '.harness', 'state.yaml'), 'utf8')));
    check(`migrate-v2:${legacyLayout}:legacy-root-removed`, !existsSync(join(migrationRoot, '.midas')));
  } finally {
    rmSync(migrationRoot, { recursive: true, force: true });
  }
}
{
  const partialRoot = mkdtempSync(join(tmpdir(), 'midas-v2-partial-'));
  try {
    mkdirSync(join(partialRoot, '.midas', 'engine'), { recursive: true });
    writeFileSync(join(partialRoot, '.midas', 'engine', 'VERSION'), '1.1.4\n', 'utf8');
    const plan = planV2Migration(partialRoot);
    applyV2Migration(partialRoot, plan);
    check('migrate-v2:partial-no-state', plan.from_version === 'unknown' && !existsSync(join(partialRoot, '.harness', 'state.yaml')));
  } finally {
    rmSync(partialRoot, { recursive: true, force: true });
  }
}
{
  const conflictRoot = mkdtempSync(join(tmpdir(), 'midas-v2-conflict-'));
  try {
    mkdirSync(join(conflictRoot, 'harness'), { recursive: true });
    mkdirSync(join(conflictRoot, 'product'), { recursive: true });
    mkdirSync(join(conflictRoot, '.harness', 'product'), { recursive: true });
    writeFileSync(join(conflictRoot, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(join(conflictRoot, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\n', 'utf8');
    writeFileSync(join(conflictRoot, 'product', 'idea.md'), 'legacy\n', 'utf8');
    writeFileSync(join(conflictRoot, '.harness', 'product', 'IDEA.md'), 'different\n', 'utf8');
    const before = treeDigest(conflictRoot);
    let rejected = false;
    try { planV2Migration(conflictRoot); } catch { rejected = true; }
    check('migrate-v2:case-conflict-prewrite', rejected && treeDigest(conflictRoot) === before);
  } finally {
    rmSync(conflictRoot, { recursive: true, force: true });
  }
}
{
  const migRoot = mkdtempSync(join(tmpdir(), 'midas-migrate-rollback-'));
  try {
    mkdirSync(join(migRoot, 'harness'), { recursive: true });
    mkdirSync(join(migRoot, 'product'), { recursive: true });
    writeFileSync(join(migRoot, 'harness', 'VERSION'), '1.0.0\n', 'utf8');
    writeFileSync(join(migRoot, 'harness', 'state.yaml'), 'midas_version: 1.0.0\nname: mig-rollback\n', 'utf8');
    writeFileSync(join(migRoot, 'product', 'idea.md'), '# idea\n', 'utf8');
    writeFileSync(join(migRoot, 'keep.txt'), 'keep\n', 'utf8');
    try {
      execSync(`node "${join(ROOT, 'scripts', 'migrate-layout.mjs')}" --target=hub --apply "${migRoot}"`, {
        encoding: 'utf8',
        env: { ...process.env, MIDAS_TEST_FAIL_STEP: 'after-first-move' },
      });
      check('migrate:rollback-restores', false, 'migration unexpectedly succeeded');
    } catch {
      check(
        'migrate:rollback-restores',
        existsSync(join(migRoot, 'keep.txt')) &&
          existsSync(join(migRoot, 'harness', 'state.yaml')) &&
          existsSync(join(migRoot, 'product', 'idea.md')) &&
          !existsSync(join(migRoot, '.midas', 'state.yaml')) &&
          !existsSync(join(migRoot, '.midas', 'product', 'idea.md')),
        'migration rollback left behind partial layout changes',
      );
    }
  } finally {
    rmSync(migRoot, { recursive: true, force: true });
  }
}
check('schema:layout-field', /layout:\s*harness/.test(readFileSync(join(ROOT, 'harness', 'state.schema.md'), 'utf8')));
check('schema:paths-product', /product:\s*\.harness\/product/.test(readFileSync(join(ROOT, 'harness', 'state.schema.md'), 'utf8')));
check('pipeline:runs-token', readFileSync(join(ROOT, 'harness', 'pipeline', '7-sprint-execution.md'), 'utf8').includes('{runs}/sprints'));
check('agents:path-resolution', /Path resolution/.test(readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')));
check('gitignore:snippet:midas-cache', /\.harness\/cache\//.test(readFileSync(snippetPath, 'utf8')));

const visualRule = join(ROOT, 'harness', 'rules', 'visual-design.md');
check('rule:visual-design:exists', existsSync(visualRule));
if (existsSync(visualRule)) {
  const vr = readFileSync(visualRule, 'utf8');
  check('rule:visual-design:has-checks', (vr.match(/\*\*CHECK:\*\*/g) || []).length >= 5);
  check('rule:visual-design:headless-escape', /N\/A \(no UI\)/.test(vr));
  check('rule:visual-design:delegates-a11y', /accessibility\.md/.test(vr) && /do not duplicate/i.test(vr));
}

// --- L. native memory model (ADR-003 / midas-recall / session continuity) -----------------------
check('skill:midas-recall:exists', existsSync(join(skillsDir, 'midas-recall', 'SKILL.md')));
const progressTpl = join(ROOT, 'harness', 'templates', 'sprint-progress.md');
check('template:sprint-progress:exists', existsSync(progressTpl));
if (existsSync(progressTpl)) {
  const pt = readFileSync(progressTpl, 'utf8');
  for (const sec of ['What', 'Why', 'Where', 'Learned']) {
    check(`template:sprint-progress:${sec}`, pt.includes(sec));
  }
}
const memoryModel = join(ROOT, 'harness', 'research', 'memory-model.md');
check('research:memory-model:exists', existsSync(memoryModel));
if (existsSync(memoryModel)) {
  check(
    'research:memory-model:refs-adr-003',
    /ADR-003/.test(readFileSync(memoryModel, 'utf8')),
  );
}
check('adr:003:exists', existsSync(join(ROOT, 'docs', 'adr', 'ADR-003-project-memory-model.md')));
check('rule:session-continuity:exists', existsSync(join(ROOT, 'harness', 'rules', 'session-continuity.md')));
check('skill:midas-bundle:exists', existsSync(join(skillsDir, 'midas-bundle', 'SKILL.md')));
check('script:bundle:exists', existsSync(join(ROOT, 'scripts', 'bundle.mjs')));
check('template:audit-checklists:exists', existsSync(join(ROOT, 'harness', 'templates', 'audit-checklists.md')));
check('pipeline:monorepo-wiring:exists', existsSync(join(ROOT, 'harness', 'pipeline', 'monorepo-wiring.md')));
{
  const sourceAuditChecklists = join(ROOT, 'harness', 'templates', 'audit-checklists.md');
  const templateAuditChecklists = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'templates', 'audit-checklists.md');
  if (existsSync(sourceAuditChecklists) && existsSync(templateAuditChecklists)) {
    check(
      'template:audit-checklists:match',
      readFileSync(sourceAuditChecklists, 'utf8') === readFileSync(templateAuditChecklists, 'utf8'),
      'create-midas/template/harness/templates/audit-checklists.md drifted from source',
    );
  }
}
{
  const sourceMonorepoWiring = join(ROOT, 'harness', 'pipeline', 'monorepo-wiring.md');
  const templateMonorepoWiring = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'pipeline', 'monorepo-wiring.md');
  if (existsSync(sourceMonorepoWiring) && existsSync(templateMonorepoWiring)) {
    check(
      'pipeline:monorepo-wiring:match',
      readFileSync(sourceMonorepoWiring, 'utf8') === readFileSync(templateMonorepoWiring, 'utf8'),
      'create-midas/template/harness/pipeline/monorepo-wiring.md drifted from source',
    );
  }
}
const initSkill = join(skillsDir, 'midas-init', 'SKILL.md');
if (existsSync(initSkill)) {
  const initBody = readFileSync(initSkill, 'utf8');
  check('skill:midas-init:monorepo-flag', /--monorepo/.test(initBody));
  check('skill:midas-init:monorepo-only-path', /setup_complete: true.*--monorepo/s.test(initBody.replace(/\s+/g, ' ')));
}
const statusSkill = join(skillsDir, 'midas-status', 'SKILL.md');
if (existsSync(statusSkill)) {
  const statusBody = readFileSync(statusSkill, 'utf8');
  check(
    'skill:midas-status:router',
    statusBody.includes('docs/skills.md') || statusBody.includes('Command router'),
    'status must cite docs/skills.md (or legacy Command router)',
  );
}

// --- M. midas-bundle export/import (examples/taskpilot) ---------------------------------------
{
  const taskpilot = join(ROOT, 'examples', 'taskpilot');
  if (existsSync(taskpilot)) {
    const mem = exportBundle(taskpilot, { profile: 'memory' });
    const memPaths = mem.files.map((f) => f.path);
    check('bundle:memory:idea', memPaths.includes('product/idea.md'));
    check('bundle:memory:state_yaml', Boolean(mem.state_yaml));
    check('bundle:memory:stack-rules', ['folder-structure.md', 'tenant-isolation.md', 'session-cookies.md'].every((r) =>
      memPaths.includes(`harness/rules/${r}`)));
    check('bundle:memory:no-base-rule', !memPaths.includes('harness/rules/code-quality.md'));
    const full = exportBundle(taskpilot, { profile: 'full' });
    check('bundle:full:biome', full.files.some((f) => f.path === 'product/biome.json'));
    const playOnly = exportBundle(taskpilot, { only: ['product/playbooks'] });
    check('bundle:only:no-src', !playOnly.files.some((f) => f.path.startsWith('product/src/')));
    const withTests = exportBundle(taskpilot, { includeTests: true, profile: 'memory' });
    check('bundle:tests:route-test', withTests.files.some((f) => f.path.endsWith('route.test.ts')));
    check('bundle:mcp-secret-detect', checkMcpSecrets('{"token":"sk-live-abc"}'));
    check('bundle:mcp-env-ok', !checkMcpSecrets('{"token":"${MY_TOKEN}"}'));
    const tmp = mkdtempSync(join(tmpdir(), 'midas-bundle-'));
    try {
      applyImport(tmp, mem, { merge: true });
      check('bundle:import:idea', existsSync(join(tmp, 'product', 'idea.md')));
      check('bundle:import:state-skipped', !existsSync(join(tmp, 'harness', 'state.yaml')));
      applyImport(tmp, mem, { merge: true, replaceState: true });
      check('bundle:import:replace-state', existsSync(join(tmp, 'harness', 'state.yaml')));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    check('bundle:engine-base-rules-count', ENGINE_BASE_RULES.size >= 15);
    check('bundle:unknown-profile', (() => {
      try { exportBundle(taskpilot, { profile: 'bogus' }); return false; } catch { return true; }
    })());
    check('bundle:canonical-compact', fromCanonical('harness/state.yaml', 'compact') === '.midas/state.yaml');
    check('bundle:canonical-hub-product', fromCanonical('product/idea.md', 'hub') === '.midas/product/idea.md');
    check('bundle:canonical-hub-engine', fromCanonical('harness/state.yaml', 'hub') === '.midas/state.yaml');
    check('bundle:canonical-roundtrip', toCanonical(fromCanonical('harness/rules/x.md', 'compact'), 'compact') === 'harness/rules/x.md');
    check('bundle:canonical-v2-state', fromCanonical('harness/state.yaml', 'harness') === '.harness/state.yaml');
    check('bundle:canonical-v2-product', fromCanonical('product/idea.md', 'harness') === '.harness/product/idea.md');
    check('bundle:canonical-v2-rules', fromCanonical('harness/rules/x.md', 'harness') === '.harness/rules/x.md');
    check('bundle:canonical-v2-runs', fromCanonical('.harness/audits/a.md', 'harness') === '.harness/runs/audits/a.md');
    check('bundle:canonical-v2-roundtrip', toCanonical(fromCanonical('harness/rules/x.md', 'harness'), 'harness') === 'harness/rules/x.md');
    let checksumFail = false;
    try {
      const tampered = { ...mem, files: [{ ...mem.files[0], sha256: 'deadbeef', content: mem.files[0].content }] };
      const badDir = mkdtempSync(join(tmpdir(), 'midas-bundle-bad-'));
      applyImport(badDir, tampered, { replace: true });
      rmSync(badDir, { recursive: true, force: true });
    } catch (e) {
      checksumFail = /checksum mismatch/.test(e.message);
    }
    check('bundle:import:checksum', checksumFail);
    const tmp2 = mkdtempSync(join(tmpdir(), 'midas-bundle-state-'));
    try {
      mkdirSync(join(tmp2, 'harness'), { recursive: true });
      writeFileSync(join(tmp2, 'harness', 'state.yaml'), 'marker: old');
      const plan = planImport(tmp2, mem, { replaceState: true });
      const st = plan.actions.find((a) => a.kind === 'state');
      check('bundle:replace-state-action', st?.action === 'replace');
      applyImport(tmp2, mem, { replaceState: true });
      check('bundle:replace-state-writes', readFileSync(join(tmp2, 'harness', 'state.yaml'), 'utf8').includes('taskpilot'));
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
    const playDir = exportBundle(taskpilot, { only: ['product/playbooks'] });
    check('bundle:only-playbooks-count', playDir.files.length === 3);
  }
}

// --- N. stage-command-table + rules-match + migrate-layout smoke ----------------------------
{
  const { stages } = loadStageCommandTable();
  check('stage-table:sprint-execution-verify', stages.sprint_execution?.verifyUi === '/midas-verify');
  check('stage-table:recall-paths', stageRecallPaths('contextualize').includes('product/open-questions.md'));
  const derived = loadEngineBaseRules();
  check('engine-base-rules:has-acceptance', derived.has('acceptance-criteria.md'));
  check('engine-base-rules:matches-template', (() => {
    const tplRules = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'rules');
    const srcRules = join(ROOT, 'harness', 'rules');
    if (!existsSync(tplRules)) return false;
    const hashDir = (dir) => {
      const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
      return createHash('sha256').update(files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')).digest('hex');
    };
    return hashDir(srcRules) === hashDir(tplRules);
  })(), 're-run build-create.mjs');
}

if (existsSync(join(ROOT, 'scripts', 'migrate-layout.mjs'))) {
  try {
    const out = execSync(`node "${join(ROOT, 'scripts', 'migrate-layout.mjs')}" "${ROOT}"`, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    check('behavioral:migrate-layout-dry-run', /dry run|nothing to move/i.test(out));
  } catch (e) {
    check('behavioral:migrate-layout-dry-run', false, String(e.stderr || e.message));
  }
}

if (existsSync(join(ROOT, 'scripts', 'bundle.mjs'))) {
  try {
    const help = execSync(`node "${join(ROOT, 'scripts', 'bundle.mjs')}"`, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    check('behavioral:bundle-cli-usage', /export|import|profile/i.test(help));
  } catch (e) {
    const msg = String(e.stdout || e.stderr || e.message);
    check('behavioral:bundle-cli-usage', /export|import|profile/i.test(msg));
  }
}

const taskpilotRoot = join(ROOT, 'examples', 'taskpilot');
if (existsSync(join(taskpilotRoot, 'harness', 'state.yaml'))) {
  const st = readFileSync(join(taskpilotRoot, 'harness', 'state.yaml'), 'utf8');
  const artifactPaths = [];
  let inArtifacts = false;
  for (const line of st.split('\n')) {
    const inline = line.match(/artifacts:\s*\[([^\]]+)\]/);
    if (inline) {
      for (const raw of inline[1].split(',')) artifactPaths.push(raw.trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }
    if (/^\s+artifacts:\s*$/.test(line)) { inArtifacts = true; continue; }
    const item = line.match(/^\s+-\s+(.+)$/);
    if (inArtifacts && item) {
      artifactPaths.push(item[1].trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }
    if (inArtifacts && line.trim() && !/^\s+-/.test(line)) inArtifacts = false;
  }
  for (const p of artifactPaths) {
    if (!p || p.includes('*')) continue;
    check(`taskpilot:artifact:${p}`, existsSync(join(taskpilotRoot, p)));
  }
  check('taskpilot:features-json', existsSync(join(taskpilotRoot, 'product', 'features.json')));
  check('taskpilot:sprint-progress', existsSync(join(taskpilotRoot, '.harness', 'sprints', '01-progress.md')));
}

check('skill:midas-progress', existsSync(join(ROOT, '.claude', 'skills', 'midas-progress', 'SKILL.md')));
check('skill:midas-qa', existsSync(join(ROOT, '.claude', 'skills', 'midas-qa', 'SKILL.md')));
check('skill:midas-design', existsSync(join(ROOT, 'harness', 'skills', 'midas-design', 'SKILL.md')));
check('skill:midas-design-claude-mirror', existsSync(join(ROOT, '.claude', 'skills', 'midas-design', 'SKILL.md')));
check('skill:midas-reconcile', existsSync(join(ROOT, '.claude', 'skills', 'midas-reconcile', 'SKILL.md')));
check('installer:diagnose-flag', /--diagnose/.test(installer) && /install-diagnose\.mjs/.test(installer));
check('build-create:install-diagnose', existsSync(join(ROOT, 'create-midas', 'install-diagnose.mjs')));
check('create-midas:files-install-diagnose', /install-diagnose\.mjs/.test(readFileSync(join(ROOT, 'create-midas', 'package.json'), 'utf8')));
{
  const sourceDiagnose = join(ROOT, 'create-midas', 'install-diagnose.mjs');
  const templateDiagnose = join(ROOT, 'create-midas', 'template', '.harness', 'scripts', 'install-diagnose.mjs');
  if (existsSync(sourceDiagnose) && existsSync(templateDiagnose)) {
    check(
      'create-template:install-diagnose:match',
      readFileSync(sourceDiagnose, 'utf8') === readFileSync(templateDiagnose, 'utf8'),
      'create-midas/template/.harness/scripts/install-diagnose.mjs drifted from create-midas/install-diagnose.mjs',
    );
  }
}
  {
    const sourceDesignSystem = join(ROOT, 'scripts', 'design-system.mjs');
    const templateDesignSystem = join(ROOT, 'create-midas', 'template', '.harness', 'scripts', 'design-system.mjs');
    if (existsSync(sourceDesignSystem) && existsSync(templateDesignSystem)) {
      check(
      'create-template:design-system-script:match',
      readFileSync(sourceDesignSystem, 'utf8') === readFileSync(templateDesignSystem, 'utf8'),
      'create-midas/template/.harness/scripts/design-system.mjs drifted from scripts/design-system.mjs',
      );
    }
  }
  {
    const sourceGemini = join(ROOT, 'gemini-extension.json');
    const templateGemini = join(ROOT, 'create-midas', 'template', 'gemini-extension.json');
    if (existsSync(sourceGemini) && existsSync(templateGemini)) {
      check(
        'create-template:gemini-extension:match',
        readFileSync(sourceGemini, 'utf8') === readFileSync(templateGemini, 'utf8'),
        'create-midas/template/gemini-extension.json drifted from gemini-extension.json',
      );
    }
  }
  {
    const sourceAgentsModels = join(ROOT, 'docs', 'agents-and-models.md');
    const templateAgentsModels = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'docs', 'agents-and-models.md');
    if (existsSync(sourceAgentsModels) && existsSync(templateAgentsModels)) {
      check(
        'create-template:agents-and-models:match',
        readFileSync(sourceAgentsModels, 'utf8') === readFileSync(templateAgentsModels, 'utf8'),
        'create-midas/template/.harness/engine/docs/agents-and-models.md drifted from docs/agents-and-models.md',
      );
    }
  }
  {
    const sourceSkillQuality = join(ROOT, 'docs', 'skill-quality-gate.md');
    const templateSkillQuality = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'docs', 'skill-quality-gate.md');
    if (existsSync(sourceSkillQuality) && existsSync(templateSkillQuality)) {
      check(
        'create-template:skill-quality-gate:match',
        readFileSync(sourceSkillQuality, 'utf8') === readFileSync(templateSkillQuality, 'utf8'),
        'create-midas/template/.harness/engine/docs/skill-quality-gate.md drifted from docs/skill-quality-gate.md',
      );
    }
  }
check('verify-record:device-profiles', /## Device profiles/.test(readFileSync(join(ROOT, 'harness', 'templates', 'verify-record.md'), 'utf8')));
check('mcp-drift:maestro-optional', OPTIONAL_MCP_IDS.includes('maestro'));
check('harness:stage-command-table', existsSync(join(ROOT, 'harness', 'stage-command-table.yaml')));
if (existsSync(join(ROOT, 'harness', 'stage-command-table.yaml'))) {
  const stageTableText = readFileSync(join(ROOT, 'harness', 'stage-command-table.yaml'), 'utf8');
  check(
    'harness:stage-command-table:generator-sync',
    stageTableText === computeStageCommandTableYaml(),
    'harness/stage-command-table.yaml drifted from the generated table',
  );
  const templateStageTable = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'stage-command-table.yaml');
  if (existsSync(templateStageTable)) {
    check(
      'create-template:stage-command-table:match',
      readFileSync(templateStageTable, 'utf8') === stageTableText,
      'template harness/stage-command-table.yaml drifted from source',
    );
  }
}
check('mcp:template-root-match', existsSync(join(ROOT, 'create-midas', 'template', '.mcp.json')) && existsSync(join(ROOT, '.mcp.json')));
if (existsSync(join(ROOT, 'create-midas', 'template', '.mcp.json')) && existsSync(join(ROOT, '.mcp.json'))) {
  check(
    'mcp:template-root-exact',
    readFileSync(join(ROOT, 'create-midas', 'template', '.mcp.json'), 'utf8') === readFileSync(join(ROOT, '.mcp.json'), 'utf8'),
    'template .mcp.json drifted from root .mcp.json',
  );
}
{
  const rootMcp = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8'));
  const seq = rootMcp.mcpServers?.['sequential-thinking'];
  check('mcp:root-sequential-thinking-command', seq?.command === 'npm', `command=${seq?.command}`);
  check(
    'mcp:root-sequential-thinking-args',
    JSON.stringify(seq?.args || []) === JSON.stringify(['exec', '--yes', '@modelcontextprotocol/server-sequential-thinking']),
    `args=${JSON.stringify(seq?.args || [])}`,
  );
  const templateMcp = JSON.parse(readFileSync(join(ROOT, 'create-midas', 'template', '.mcp.json'), 'utf8'));
  const templateSeq = templateMcp.mcpServers?.['sequential-thinking'];
  check('mcp:template-sequential-thinking-command', templateSeq?.command === 'npm', `command=${templateSeq?.command}`);
  check(
    'mcp:template-sequential-thinking-args',
    JSON.stringify(templateSeq?.args || []) === JSON.stringify(['exec', '--yes', '@modelcontextprotocol/server-sequential-thinking']),
    `args=${JSON.stringify(templateSeq?.args || [])}`,
  );
}
check('harness:design-system:tokens-css', existsSync(join(ROOT, 'harness', 'design-system', 'tokens.css')));
if (existsSync(join(ROOT, 'harness', 'design-system', 'tokens.css'))) {
  const tokensCss = readFileSync(join(ROOT, 'harness', 'design-system', 'tokens.css'), 'utf8');
  check(
    'harness:design-system:generator-sync',
    tokensCss === computeDesignSystemCss(ROOT),
    'harness/design-system/tokens.css drifted from tokens.json',
  );
  const templateTokensCss = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'design-system', 'tokens.css');
  if (existsSync(templateTokensCss)) {
    check(
      'create-template:design-system:tokens-css:match',
      readFileSync(templateTokensCss, 'utf8') === tokensCss,
      'template harness/design-system/tokens.css drifted from source',
    );
  }
}

check('mkdocs:adr-003', /ADR-003/.test(readFileSync(join(ROOT, 'mkdocs.yml'), 'utf8')));

// --- status-page + yaml-lite smoke ----------------------------------------
check('script:status-page:exists', existsSync(join(ROOT, 'scripts', 'status-page.mjs')));
check('script:skill-quality-check:exists', existsSync(join(ROOT, 'scripts', 'skill-quality-check.mjs')));
check('script:bump-version:exists', existsSync(join(ROOT, 'scripts', 'bump-version.mjs')));
check('template:skill-state-ritual:exists', existsSync(join(ROOT, 'harness', 'templates', 'skill-state-ritual.md')));
if (existsSync(join(ROOT, 'scripts', 'bump-version.mjs'))) {
  try {
    const out = execSync(`node "${join(ROOT, 'scripts', 'bump-version.mjs')}" 9.9.9 --dry-run`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    check(
      'behavioral:bump-version-dry-run',
      /bump-version: .+ → 9\.9\.9 \(dry-run\)/.test(out) && /INSTALL\.md/.test(out),
      'dry-run should list INSTALL.md and not write',
    );
  } catch (e) {
    check('behavioral:bump-version-dry-run', false, String(e.stderr || e.message));
  }
}
check('script:yaml-lite:exists', existsSync(join(ROOT, 'scripts', 'yaml-lite.mjs')));
if (existsSync(join(ROOT, 'scripts', 'status-page.mjs'))) {
  const statusTmp = mkdtempSync(join(tmpdir(), 'midas-status-'));
  const statusOut = join(statusTmp, 'status.html');
  try {
    execSync(`node "${join(ROOT, 'scripts', 'status-page.mjs')}" --out "${statusOut}"`, { cwd: ROOT, stdio: 'pipe' });
    check('behavioral:status-page-runs', existsSync(statusOut));
  } catch (e) {
    check('behavioral:status-page-runs', false, String(e.stderr || e.message));
  } finally {
    rmSync(statusTmp, { recursive: true, force: true });
  }
}
check('template:gate-record', existsSync(join(ROOT, 'harness', 'templates', 'gate-record.md')));
check('template:audit-record', existsSync(join(ROOT, 'harness', 'templates', 'audit-record.md')));
check('template:verify-record', existsSync(join(ROOT, 'harness', 'templates', 'verify-record.md')));
check('harness:gates-registry', existsSync(join(ROOT, 'harness', 'gates.json')));
if (existsSync(join(ROOT, 'harness', 'gates.json'))) {
  let gates = null;
  try {
    gates = JSON.parse(readFileSync(join(ROOT, 'harness', 'gates.json'), 'utf8'));
  } catch (e) {
    check('harness:gates-registry:json', false, e.message);
  }
  if (gates) {
    const phases = Array.isArray(gates.gates) ? gates.gates : [];
    const phaseNames = phases.map((g) => g.phase).filter(Boolean);
    for (const phase of ['idea_intake', 'contextualize', 'market_research', 'business_case', 'tech_architecture', 'architecture_rules', 'sprint_planning', 'sprint_execution', 'audit']) {
      check(`harness:gates-registry:phase:${phase}`, phaseNames.includes(phase), 'missing gate entry');
    }
    check('harness:gates-registry:shape', phases.length >= 9 && phases.every((g) => g.id && g.phase && g.owner && g.evidence_required), 'registry entries need id, phase, owner, and evidence_required');
    check(
      'harness:gates-registry:generator-sync',
      JSON.stringify(gates) === JSON.stringify(computeGatesIndex(ROOT, 'harness')),
      'harness/gates.json drifted from the generated registry',
    );
  }
}
const templateGatesIndex = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'gates.json');
if (existsSync(templateGatesIndex) && existsSync(join(ROOT, 'harness', 'gates.json'))) {
  check(
    'create-template:gates-index:match',
    readFileSync(templateGatesIndex, 'utf8') === readFileSync(join(ROOT, 'harness', 'gates.json'), 'utf8'),
    'template harness/gates.json drifted from source',
  );
}
check('harness:checks-index', existsSync(join(ROOT, 'harness', 'checks.json')));
if (existsSync(join(ROOT, 'harness', 'checks.json'))) {
  let checksIndex = null;
  try {
    checksIndex = JSON.parse(readFileSync(join(ROOT, 'harness', 'checks.json'), 'utf8'));
  } catch (e) {
    check('harness:checks-index:json', false, e.message);
  }
  if (checksIndex) {
    const rules = Array.isArray(checksIndex.rules) ? checksIndex.rules : [];
    const ruleDir = join(ROOT, 'harness', 'rules');
    const ruleFiles = existsSync(ruleDir) ? readdirSync(ruleDir).filter((f) => f.endsWith('.md')).length : 0;
    check('harness:checks-index:rules-count', rules.length === ruleFiles, `${rules.length} != ${ruleFiles}`);
    check(
      'harness:checks-index:structured',
      rules.every((r) =>
        r &&
        typeof r.slug === 'string' &&
        typeof r.title === 'string' &&
        typeof r.path === 'string' &&
        r.phase === 8 &&
        typeof r.owner === 'string' &&
        typeof r.check_count === 'number' &&
        Array.isArray(r.checks) &&
        r.checks.length > 0 &&
        r.checks.length === r.check_count &&
        r.checks.every((c) =>
          c &&
          typeof c.kind === 'string' &&
          typeof c.body === 'string' &&
          c.phase === 8 &&
          c.owner === r.owner &&
          ['command', 'manual'].includes(c.kind) &&
          ['high', 'medium'].includes(c.severity) &&
          (c.kind === 'manual' ? c.severity === 'medium' : c.severity === 'high') &&
          (c.section === null || typeof c.section === 'string')
        )
      ),
      'structured checks need phase/owner/severity/section metadata',
    );
    check(
      'harness:checks-index:generator-sync',
      JSON.stringify(checksIndex) === JSON.stringify(computeChecksIndex(ROOT, 'harness')),
      'harness/checks.json drifted from the generated index',
    );
    const modelRouting = rules.find((r) => r && r.slug === 'model-routing');
    if (modelRouting) {
      check(
        'harness:checks-index:model-routing-continuations',
        modelRouting.checks.filter((c) => c.kind === 'manual').length === 2 &&
          modelRouting.checks.some((c) => /scout delegation/.test(c.body)),
        'model-routing manual markers or wrapped lines were not captured correctly',
      );
    }
  }
}
const templateChecksIndex = join(ROOT, 'create-midas', 'template', '.harness', 'engine', 'checks.json');
if (existsSync(templateChecksIndex) && existsSync(join(ROOT, 'harness', 'checks.json'))) {
  let checksIndex = null;
  let templateIndex = null;
  try {
    checksIndex = JSON.parse(readFileSync(join(ROOT, 'harness', 'checks.json'), 'utf8'));
    templateIndex = JSON.parse(readFileSync(templateChecksIndex, 'utf8'));
  } catch (e) {
    check('create-template:checks-index:json', false, e.message);
  }
  if (checksIndex && templateIndex) {
    check(
      'create-template:checks-index:match',
      JSON.stringify(templateIndex) === JSON.stringify(checksIndex),
      'template harness/checks.json drifted from source',
    );
  }
}
check('pipeline:lite', existsSync(join(ROOT, 'harness', 'pipeline', 'lite.md')));
check('migrations:readme', existsSync(join(ROOT, 'harness', 'migrations', 'README.md')));

console.log(`midas test: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('All structural invariants hold.');
process.exit(0);
