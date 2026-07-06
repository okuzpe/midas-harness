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
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { computeAdapters, DEFAULT_ADAPTER_TOOLS, resolveAdapterTools } from './render-adapters.mjs';
import { evaluateMcpDeclaredVsWired, evaluateSkillMcpRequired } from './mcp-drift.mjs';
import { ensureMidasGitignore, GITIGNORE_BEGIN, GITIGNORE_END } from './gitignore-merge.mjs';
import { detectLayout, resolvePaths, MIGRATION_MAP, MIGRATION_MAP_HUB, RUNS_SUBDIRS, hubPathsYaml } from './paths.mjs';
import { exportBundle, applyImport, checkMcpSecrets, ENGINE_BASE_RULES, toCanonical, fromCanonical, planImport } from './bundle.mjs';
import { loadStageCommandTable, stageRecallPaths, loadEngineBaseRules } from './stage-command-table.mjs';
import { createHash } from 'node:crypto';

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = resolve(SCRIPT_DIR, '..');

const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'inherit'];
const RITUAL_GUARD = 'Run only when the user explicitly invokes';

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
const skillsDir = join(ROOT, '.claude', 'skills');
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
    check(`skill:${name}:ritual-guard`, text.includes(RITUAL_GUARD), 'missing body guard');
  }
}

// --- C. agent frontmatter ----------------------------------------------------------------------
const agentsDir = join(ROOT, '.claude', 'agents');
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
}

// --- E2. create-midas bundled template matches source -----------------------------------------
const tplRoot = join(ROOT, 'create-midas', 'template');
if (existsSync(tplRoot)) {
  check(
    'create-template:skills-match',
    JSON.stringify(dirNames(join(tplRoot, '.claude', 'skills'))) === JSON.stringify(dirNames(skillsDir)),
    're-run build-create.mjs',
  );
  for (const f of ['AGENTS.md', '.mcp.json', 'harness/methodology.md', 'harness/conventions.md', 'harness/stage-command-table.yaml', 'scripts/render-adapters.mjs', 'scripts/yaml-lite.mjs', 'scripts/mcp-drift.mjs', 'scripts/mcp-cursor-sync.mjs', 'scripts/tool-profiles.mjs', 'scripts/gitignore-merge.mjs', 'scripts/paths.mjs', 'scripts/migrate-layout.mjs', 'scripts/stage-command-table.mjs', 'scripts/doctor.mjs', 'scripts/status-page.mjs', 'scripts/bundle.mjs', 'gemini-extension.json', 'docs/agents-and-models.md']) {
    check(`create-template:has:${f}`, existsSync(join(tplRoot, f)));
  }
  // The template must NOT carry repo-internal trees into a user project.
  for (const d of ['examples', 'plugins', '.github', 'create-midas']) {
    check(`create-template:excludes:${d}`, !existsSync(join(tplRoot, d)));
  }
  // Engine dev state must never ship in the distributable bundle (create-midas/index.mjs writes fresh state).
  check('create-template:excludes:harness/state.yaml', !existsSync(join(tplRoot, 'harness', 'state.yaml')));
}

// --- E2b. build-create strips engine-only harness files (dynamic, not static tree check) -------
const buildCreate = join(ROOT, 'scripts', 'build-create.mjs');
if (existsSync(buildCreate)) {
  execSync(`node "${buildCreate}"`, { cwd: ROOT, stdio: 'pipe' });
  check(
    'build-create:excludes-harness-state-yaml',
    !existsSync(join(ROOT, 'create-midas', 'template', 'harness', 'state.yaml')),
    'harness/state.yaml leaked into create-midas/template — add to HARNESS_EXCLUDE',
  );
  const srcConv = join(ROOT, 'harness', 'conventions.md');
  const tplConv = join(ROOT, 'create-midas', 'template', 'harness', 'conventions.md');
  if (existsSync(srcConv) && existsSync(tplConv)) {
    check(
      'build-create:conventions-match',
      readFileSync(srcConv, 'utf8') === readFileSync(tplConv, 'utf8'),
      'template harness/conventions.md drifted from source',
    );
  }
}

// --- F3. TaskPilot verify/audit cited test paths exist on disk -------------------------------
const taskpilotProduct = join(ROOT, 'examples', 'taskpilot', 'product');
const citedTestPaths = [
  'src/app/api/tasks/route.test.ts',
  'src/app/api/tasks/[id]/route.test.ts',
];
for (const rel of citedTestPaths) {
  check(`taskpilot:cited-test:${rel}`, existsSync(join(taskpilotProduct, rel)));
}

const stateFile = join(ROOT, 'examples', 'taskpilot', 'harness', 'state.yaml');
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

// --- L. prose version pins (#vX.Y.Z) match harness/VERSION (CHANGELOG history excluded) ---------
if (engineVersion) {
  for (const f of ['INSTALL.md', 'SECURITY.md', 'README.md', 'create-midas/index.mjs']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const pin of readFileSync(p, 'utf8').match(/#v(\d+\.\d+\.\d+)/g) || []) {
      check(`version-pin:${f}:${pin}`, pin.slice(2) === engineVersion, `${pin} != ${engineVersion}`);
    }
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
}
if (existsSync(join(ROOT, 'examples', 'taskpilot'))) {
  const tpOut = doctorOutput('examples/taskpilot');
  check('behavioral:mcp-drift-taskpilot', /ok\s+mcp:declared-vs-wired/.test(tpOut), 'taskpilot .mcp.json should satisfy declared MCPs');
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
check('installer:gemini-extension', /function ensureGeminiExtension/.test(installer));
check('installer:tools-presets', /parseToolsPreset/.test(readFileSync(join(ROOT, 'scripts', 'tool-profiles.mjs'), 'utf8')));
check('installer:tty-fallback', /stdin\.isTTY/.test(installer));
check('installer:update-ignores-tools', /update \? null : await resolveSelectedTools/.test(installer));
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
}
check('gitignore:merge-module', existsSync(join(ROOT, 'scripts', 'gitignore-merge.mjs')));
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
check('installer:verify-after-update', /function verifyInstall\(paths\)/.test(installer) && /runDoctor\(TARGET, paths/.test(installer));
check('installer:layout-flag', /--layout=hub/.test(installer) && /applyHubLayout/.test(installer) && /applyCompactLayout/.test(installer));
check('installer:hasMidasInstall-compact', /hasMidasInstall[\s\S]*\.midas/.test(installer));

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
  } finally {
    rmSync(hubRoot, { recursive: true, force: true });
  }
}
check('migrate-layout:module-exists', existsSync(join(ROOT, 'scripts', 'migrate-layout.mjs')));
check('schema:layout-field', /layout:\s*hub/.test(readFileSync(join(ROOT, 'harness', 'state.schema.md'), 'utf8')));
check('schema:paths-product', /product:\s*\.midas\/product/.test(readFileSync(join(ROOT, 'harness', 'state.schema.md'), 'utf8')));
check('pipeline:runs-token', readFileSync(join(ROOT, 'harness', 'pipeline', '7-sprint-execution.md'), 'utf8').includes('{runs}/sprints'));
check('agents:path-resolution', /Path resolution/.test(readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')));
check('gitignore:snippet:midas-cache', /\.midas\/cache\//.test(readFileSync(snippetPath, 'utf8')));

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
    const tplRules = join(ROOT, 'create-midas', 'template', 'harness', 'rules');
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
check('harness:stage-command-table', existsSync(join(ROOT, 'harness', 'stage-command-table.yaml')));

check('mkdocs:adr-003', /ADR-003/.test(readFileSync(join(ROOT, 'mkdocs.yml'), 'utf8')));

// --- status-page + yaml-lite smoke ----------------------------------------
check('script:status-page:exists', existsSync(join(ROOT, 'scripts', 'status-page.mjs')));
check('script:yaml-lite:exists', existsSync(join(ROOT, 'scripts', 'yaml-lite.mjs')));
if (existsSync(join(ROOT, 'scripts', 'status-page.mjs'))) {
  try {
    execSync(`node "${join(ROOT, 'scripts', 'status-page.mjs')}"`, { cwd: ROOT, stdio: 'pipe' });
    check('behavioral:status-page-runs', existsSync(join(ROOT, 'status.html')));
    try { rmSync(join(ROOT, 'status.html')); } catch { /* ignore */ }
  } catch (e) {
    check('behavioral:status-page-runs', false, String(e.stderr || e.message));
  }
}
check('template:gate-record', existsSync(join(ROOT, 'harness', 'templates', 'gate-record.md')));
check('template:audit-record', existsSync(join(ROOT, 'harness', 'templates', 'audit-record.md')));
check('template:verify-record', existsSync(join(ROOT, 'harness', 'templates', 'verify-record.md')));
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
