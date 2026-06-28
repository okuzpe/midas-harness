#!/usr/bin/env node
// test.mjs — Midas structural test suite (dependency-free, Node ESM).
//
// Validates the invariants that keep the harness coherent: JSON parses, skill/agent frontmatter is
// well-formed and names match their paths, ritual skills carry the safety guard, the generated tool
// adapters are in sync with source, the plugin tree matches `.claude/`, the example state has the
// required shape, and no stale brand token leaked back in.
//
// Run: `node scripts/test.mjs`  (exit 0 = all pass, 1 = at least one failure). No npm dependencies.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, extname, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { computeAdapters } from './render-adapters.mjs';

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
  for (const f of ['AGENTS.md', '.mcp.json', 'harness/methodology.md', 'harness/conventions.md', 'scripts/render-adapters.mjs', 'docs/agents-and-models.md']) {
    check(`create-template:has:${f}`, existsSync(join(tplRoot, f)));
  }
  // The template must NOT carry repo-internal trees into a user project.
  for (const d of ['examples', 'plugins', '.github', 'create-midas']) {
    check(`create-template:excludes:${d}`, !existsSync(join(tplRoot, d)));
  }
}

// --- F. example state.yaml has the required shape ----------------------------------------------
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
check('mcp:installer-wraps-npx-on-windows', /function fixMcpForWindows\(\)[\s\S]*server\.command = 'cmd'/.test(installer));
check('mcp:installer-preserves-user-config', /rel === '\.mcp\.json'/.test(installer), '.mcp.json must remain user-owned on update');

console.log(`midas test: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('All structural invariants hold.');
process.exit(0);
