#!/usr/bin/env node
// doctor.mjs — Midas adapter drift checker + install health check (dependency-free, Node ESM).
//
//   node scripts/doctor.mjs          → check generated adapters (exit 1 on drift) + report health warnings
//   node scripts/doctor.mjs --fix    → re-render the adapters from source, then exit 0
//   node scripts/doctor.mjs <dir>    → check THAT project (its adapters, state.yaml, gate records), not the engine
//   node scripts/doctor.mjs --strict → ALSO exit 1 when a frozen gate record is inconsistent with state.yaml
//   node scripts/doctor.mjs --gates-only → skip adapter drift (for partial examples like taskpilot)
//
// Adapter drift is AUTHORITATIVE (it fails CI). The other health checks are advisory warnings that never
// change the exit code (skip gracefully when a file isn't applicable) — EXCEPT under --strict, where a
// `gate:*` inconsistency also exits 1. Shares its render logic with render-adapters.mjs (no duplication).

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAdapters, computeChecksIndex, computeGatesIndex, renderAdapters } from './render-adapters.mjs';
import { evaluateMcpDeclaredVsWired, evaluateSkillMcpRequired, collectSkillMcpRequired } from './mcp-drift.mjs';
import { parseSprints, parseEnforcement, parseRouting, parseToolsFromStateYaml } from './yaml-lite.mjs';
import { syncCursorMcp, wrapMcpServersForWindows } from './mcp-cursor-sync.mjs';
import { ensureMidasGitignore } from './gitignore-merge.mjs';
import { resolvePaths, detectLayout, resolveProjectRootFromScript } from './paths.mjs';
import { computeStageCommandTableYaml, renderStageCommandTable } from './stage-command-table.mjs';
import { computeDesignSystemCss, renderDesignSystemTokens } from './design-system.mjs';
import { computePluginManifest, computePluginReadme, computeMarketplaceJson } from './build-plugin.mjs';

const HELP = `midas doctor — adapter drift checker + install health check

Usage:
  node scripts/doctor.mjs [dir]     check adapters + health (exit 1 on drift)
  node scripts/doctor.mjs --fix     re-render adapters from source
  node scripts/doctor.mjs --strict  exit 1 on gate record inconsistencies
  node scripts/doctor.mjs --gates-only  skip adapter drift check
  node scripts/doctor.mjs --help    show this help`;

const FIX = process.argv.includes('--fix');
const STRICT = process.argv.includes('--strict');
const GATES_ONLY = process.argv.includes('--gates-only');
const SHOW_HELP = process.argv.includes('--help') || process.argv.includes('-h');
// Optional positional project root: check THAT project instead of the engine repo. Lets `--strict` run
// against a real install (or examples/taskpilot) so the gate-records check is provably exercised.
const rootArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
const ROOT = rootArg ? resolve(process.cwd(), rootArg) : resolveProjectRootFromScript(import.meta.url);
const paths = resolvePaths(ROOT);
const doctorCmd = `node ${paths.scripts}/doctor.mjs`;

if (SHOW_HELP) {
  console.log(HELP);
  process.exit(0);
}

/** Read a repo-relative file or null if missing. */
function read(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Pull `key=<int>` out of a frozen tally line (default 0). */
function tallyNum(line, key) {
  const m = line.match(new RegExp(key + '=(\\d+)'));
  return m ? Number(m[1]) : 0;
}

/** Read the pinned `model:` of a first-party agent (the real runtime binding), or null. */
function agentModel(name) {
  const t = read(join('.claude', 'agents', name + '.md'));
  const m = t && t.match(/^model:\s*([^\s#]+)/m);
  return m ? m[1] : null;
}

// --- --fix: rewrite adapters via the shared render path ----------------------------------------
if (FIX) {
  if (!existsSync(join(ROOT, paths.engine, 'conventions.md'))) {
    console.error(`midas doctor --fix: ${paths.engine}/conventions.md missing — cannot render adapters.`);
    process.exit(1);
  }
  const { hash, results } = renderAdapters(ROOT);
  const stageTable = renderStageCommandTable(ROOT);
  const designSystem = renderDesignSystemTokens(ROOT);
  console.log(`midas doctor --fix: re-rendered adapters from ${paths.engine}/conventions.md`);
  for (const r of results) console.log(`  ${r.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${r.path}`);
  console.log(`  ${stageTable.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${stageTable.path}`);
  console.log(`  ${designSystem.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${designSystem.path}`);
  console.log(`  source hash: ${hash}`);
  const stateForMcp = read(paths.state) || '';
  const sync = syncCursorMcp(ROOT, stateForMcp);
  if (sync.synced) console.log('  wrote    .cursor/mcp.json (synced from .mcp.json for Cursor)');
  const gi = ensureMidasGitignore(ROOT);
  if (gi.wrote) {
    console.log(gi.upgraded ? '  upgraded .gitignore (missing Midas patterns)' : '  wrote    .gitignore (Midas block)');
  }
  // Re-check drift after fix
  let stillDrift = false;
  for (const f of computeAdapters(ROOT).files) {
    const onDisk = read(f.path);
    if (onDisk === null || onDisk !== f.content) stillDrift = true;
  }
  process.exit(stillDrift ? 1 : 0);
}

// --- 1. adapter drift (authoritative; affects the exit code) -----------------------------------
let drift = false;
if (!GATES_ONLY) {
  console.log('midas doctor — adapters');
  for (const f of computeAdapters(ROOT).files) {
    const onDisk = read(f.path);
    if (onDisk === null) { drift = true; console.log(`  MISSING  ${f.path}`); }
    else if (onDisk !== f.content) { drift = true; console.log(`  DRIFT    ${f.path}`); }
    else console.log(`  ok       ${f.path}`);
  }
} else {
  console.log('midas doctor — adapters (skipped: --gates-only)');
}

// --- 2. health checks (advisory; warn/skip, never change the exit code) ------------------------
const health = [];
const check = (name, status, note) => health.push({ name, status, note: note || '' });

// version: state midas_version vs engine VERSION
const VERSION = (read(paths.version) || '').trim();
const stateRaw = read(paths.state);
if (!stateRaw) {
  check('version', 'skip', `no ${paths.state} (engine repo or pre-init)`);
} else {
  const m = stateRaw.match(/^midas_version:\s*([0-9][^\s#]*)/m);
  const sv = m ? m[1] : null;
  if (!sv) check('version', 'warn', 'state.yaml has no midas_version');
  else if (VERSION && sv !== VERSION) check('version', 'warn', `state ${sv} != engine ${VERSION} — run /midas-update`);
  else check('version', 'ok', sv || '');
  for (const k of ['stage', 'cost_profile', 'routing']) {
    if (!new RegExp(`(^|\\n)${k}:`).test(stateRaw)) check(`state:${k}`, 'warn', 'missing required key');
  }

  // routing: turn the cost_profile/routing block from inert data into a checked invariant. The only
  // real runtime binding is the three agents' pinned `model:`, so validate the resolved ids against
  // them and — under the executor-backed `balanced` profile — require an exact reconciliation.
  const pinned = {
    orchestrate: agentModel('midas-orchestrator'),
    build: agentModel('midas-builder'),
    scout: agentModel('midas-scout'),
  };
  const allow = new Set([
    ...Object.values(pinned).filter(Boolean),
    'gpt-5.3-codex', 'gpt-5-mini', // openai routing_profile presets (advisory)
  ]);
  if (allow.size === 0) {
    check('routing', 'skip', 'no .claude/agents to reconcile against');
  } else {
    const tiers = ['orchestrate', 'build', 'scout'];
    const { profile, routing } = parseRouting(stateRaw);
    const unknown = tiers.filter((t) => routing[t] && !allow.has(routing[t]));
    if (unknown.length) {
      check('routing', 'warn', `${unknown.map((t) => `${t}=${routing[t]}`).join(', ')} not a known model id — see docs/agents-and-models.md`);
    } else if (profile === 'balanced') {
      const mism = tiers.filter((t) => routing[t] && pinned[t] && routing[t] !== pinned[t]);
      check('routing', mism.length ? 'warn' : 'ok',
        mism.length ? mism.map((t) => `${t}: state ${routing[t]} != agent ${pinned[t]}`).join('; ') : 'matches agent pins');
    } else {
      check('routing', 'ok', `profile ${profile || '(unset)'} — ids valid (non-balanced profiles are advisory intent)`);
    }
  }

  // enforcement: the recommend-don't-wall scaffolding decision must be recorded and honest. A named
  // config file absent on disk is drift; installed:false is allowed but surfaced so the gap is visible.
  const enf = parseEnforcement(stateRaw);
  if (enf.length === 0) {
    check('enforcement', 'skip', 'no enforcement: block (pre-Phase-5 or none scaffolded)');
  } else {
    const missing = enf.filter((e) => e.config && !existsSync(join(ROOT, e.config)));
    if (missing.length) {
      check('enforcement', 'warn', `config named but missing on disk: ${missing.map((e) => `${e.tool}→${e.config}`).join(', ')}`);
    } else {
      const off = enf.filter((e) => !e.installed).map((e) => e.tool);
      check('enforcement', 'ok', off.length
        ? `${enf.length} configured; NOT installed: ${off.join(', ')} (recommend-don't-wall → graded at Phase 8)`
        : `${enf.length} configured + installed`);
    }
  }
}

// layout: state.layout vs disk markers
const declaredLayout = (stateRaw?.match(/^layout:\s*(\S+)/m) || [])[1];
const detected = detectLayout(ROOT);
if (paths.layoutConflict) {
  check('layout:consistent', 'warn', 'both classic and compact markers on disk — run migrate or remove duplicate tree');
} else if (!stateRaw) {
  check('layout:consistent', 'skip', 'no state file');
} else if (declaredLayout && detected && declaredLayout !== detected) {
  check('layout:consistent', 'warn', `state layout=${declaredLayout} but disk=${detected}`);
} else {
  check('layout:consistent', 'ok', declaredLayout || detected || paths.layout);
}

// critical files
for (const f of ['AGENTS.md', join(paths.engine, 'conventions.md'), join(paths.engine, 'methodology.md')]) {
  check(`file:${f}`, existsSync(join(ROOT, f)) ? 'ok' : 'warn', existsSync(join(ROOT, f)) ? '' : 'missing');
}

// .mcp.json must be secret-free (only ${ENV_VAR} placeholders)
const mcp = read('.mcp.json');
if (mcp === null) {
  check('mcp:secret-free', 'skip', 'no .mcp.json');
} else {
  let leak = false;
  const re = /(authorization|token|api[_-]?key|secret|password)"\s*:\s*"([^"]+)"/gi;
  let mm;
  while ((mm = re.exec(mcp))) if (!mm[2].includes('${')) leak = true;
  if (/\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,})\b/.test(mcp)) leak = true;
  check('mcp:secret-free', leak ? 'warn' : 'ok', leak ? 'a literal secret may be present — use ${ENV_VAR}' : '');
  // Windows: an MCP server launched with bare `npx` cannot be spawned (npx is a .cmd) and fails with
  // "Connection closed". It must be wrapped in `cmd /c`. Fresh installs are fixed by the installer.
  if (process.platform === 'win32') {
    try {
      const j = JSON.parse(mcp);
      const bare = Object.entries(j.mcpServers || {}).filter(([, s]) => s && s.command === 'npx').map(([k]) => k);
      check('mcp:win-npx', bare.length ? 'warn' : 'ok',
        bare.length ? `${bare.join(', ')}: bare npx won't spawn on Windows — wrap in \`cmd /c\` (re-run the installer with --force)` : '');
    } catch { /* invalid JSON is surfaced elsewhere */ }
  }
}

{
  const tools = stateRaw ? parseToolsFromStateYaml(stateRaw) : null;
  if (tools?.includes('cursor')) {
    const cursorMcp = read('.cursor/mcp.json');
    if (cursorMcp === null) {
      check('mcp:cursor-sync', 'warn', `\`.cursor/mcp.json\` missing — Cursor does not read root \`.mcp.json\`; run \`${doctorCmd} --fix\` or re-run the installer`);
    } else if (mcp !== null) {
      let drifted = false;
      try {
        const rootJson = JSON.parse(mcp);
        const cursorJson = JSON.parse(cursorMcp);
        const expected = JSON.parse(JSON.stringify(rootJson));
        wrapMcpServersForWindows(expected);
        drifted = JSON.stringify(cursorJson) !== JSON.stringify(expected);
      } catch {
        drifted = cursorMcp.replace(/\r\n/g, '\n').trim() !== mcp.replace(/\r\n/g, '\n').trim();
      }
      check('mcp:cursor-sync', drifted ? 'warn' : 'ok',
        drifted ? '`.cursor/mcp.json` drifted from `.mcp.json` — run `' + doctorCmd + ' --fix` to sync' : '');
    } else {
      check('mcp:cursor-sync', 'ok', '');
    }
  }
}
{
  const templateMcp = read(join('create-midas', 'template', '.mcp.json'));
  if (templateMcp !== null && mcp !== null) {
    check(
      'mcp:template-sync',
      templateMcp === mcp ? 'ok' : 'warn',
      templateMcp === mcp ? '' : 'create-midas/template/.mcp.json drifted from root .mcp.json',
    );
  }
}
{
  const pluginRoot = join(ROOT, 'plugins', 'midas');
  if (existsSync(pluginRoot)) {
    const pluginJson = read(join('plugins', 'midas', '.claude-plugin', 'plugin.json'));
    if (pluginJson !== null) {
      check(
        'plugin:manifest-json',
        pluginJson === JSON.stringify(computePluginManifest(), null, 2) + '\n' ? 'ok' : 'warn',
        pluginJson === JSON.stringify(computePluginManifest(), null, 2) + '\n'
          ? ''
          : 'plugins/midas/.claude-plugin/plugin.json drifted from the generated manifest',
      );
    }
    const pluginReadme = read(join('plugins', 'midas', 'README.md'));
    if (pluginReadme !== null) {
      check(
        'plugin:readme',
        pluginReadme === computePluginReadme() ? 'ok' : 'warn',
        pluginReadme === computePluginReadme() ? '' : 'plugins/midas/README.md drifted from the generated README',
      );
    }
    const marketplaceJson = read(join('.claude-plugin', 'marketplace.json'));
    if (marketplaceJson !== null) {
      check(
        'plugin:marketplace-json',
        marketplaceJson === JSON.stringify(computeMarketplaceJson(), null, 2) + '\n' ? 'ok' : 'warn',
        marketplaceJson === JSON.stringify(computeMarketplaceJson(), null, 2) + '\n'
          ? ''
          : '.claude-plugin/marketplace.json drifted from the generated marketplace',
      );
    }
  }
}

{
  const mcpDrift = evaluateMcpDeclaredVsWired(stateRaw, mcp);
  check('mcp:declared-vs-wired', mcpDrift.status, mcpDrift.note);
}
{
  const required = collectSkillMcpRequired(join(ROOT, '.claude', 'skills'));
  const skillMcp = evaluateSkillMcpRequired(required, mcp);
  check('mcp:skill-required', skillMcp.status, skillMcp.note);
}

// skills carry valid frontmatter with a name
const skillsDir = join(ROOT, '.claude', 'skills');
if (!existsSync(skillsDir)) {
  check('skills:frontmatter', 'skip', 'no .claude/skills');
} else {
  let bad = 0, total = 0;
  for (const d of readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    total++;
    const s = read(join('.claude', 'skills', d.name, 'SKILL.md'));
    if (!s || !/^---\r?\n[\s\S]*?\bname:\s*\S/m.test(s)) bad++;
  }
  check('skills:frontmatter', bad ? 'warn' : 'ok', `${total - bad}/${total} valid`);
}

// frozen gate records vs state: the first check OUTSIDE the model that validates a verdict.
// A producing model can write "PASS" into an audit/verify record and advance the sprint; this
// catches the mismatch — a record whose tally shows unresolved CRITs while state marks the sprint
// done. Per-sprint records only (audit/verify); the tribunal is advisory by design and not gated.
const harnessDir = join(ROOT, paths.runs);
if (!stateRaw) {
  check('gate:records', 'skip', 'no state.yaml');
} else if (!existsSync(harnessDir)) {
  check('gate:records', 'skip', `no ${paths.runs} records yet`);
} else {
  const sprintStatus = parseSprints(stateRaw);
  const shipped = /^stage:\s*shipped\b/m.test(stateRaw);
  const isClosed = (nn) => shipped || sprintStatus.get(nn) === 'done';
  let scanned = 0, flagged = 0;

  const audits = join(harnessDir, 'audits');
  if (existsSync(audits)) for (const f of readdirSync(audits)) {
    const nn = (f.match(/^audit-([\w.-]+)\.md$/) || [])[1];
    if (!nn) continue;
    const line = (read(join(paths.runsPath('audits'), f)) || '').match(/MIDAS_AUDIT_RESULT:[^\n\r]*/);
    if (!line) continue;
    scanned++;
    const unresolved = tallyNum(line[0], 'unresolved');
    const blocked = /verdict=blocked/.test(line[0]);
    const passClaimed = /verdict=pass/.test(line[0]);
    if (passClaimed && unresolved > 0) {
      // self-inconsistent: the record grades itself pass while carrying unresolved fails
      flagged++;
      check(`gate:audit-${nn}`, 'warn', `record claims verdict=pass but unresolved=${unresolved} — self-inconsistent`);
    } else if (isClosed(nn) && (unresolved > 0 || blocked)) {
      flagged++;
      check(`gate:audit-${nn}`, 'warn', `record has unresolved=${unresolved}${blocked ? ' verdict=blocked' : ''} but sprint ${nn} is closed in state.yaml`);
    }
  }

  const verifs = join(harnessDir, 'verifications');
  if (existsSync(verifs)) for (const f of readdirSync(verifs)) {
    const nn = (f.match(/^verify-([\w.-]+)\.md$/) || [])[1];
    if (!nn) continue;
    const line = (read(join(paths.runsPath('verifications'), f)) || '').match(/MIDAS_VERIFY_RESULT:[^\n\r]*/);
    if (!line) continue;
    scanned++;
    const criticals = tallyNum(line[0], 'criticals');
    const fails = tallyNum(line[0], 'fails');
    const passClaimed = /verdict=pass/.test(line[0]);
    if (passClaimed && (criticals > 0 || fails > 0)) {
      flagged++;
      check(`gate:verify-${nn}`, 'warn', `record claims verdict=pass but fails=${fails} criticals=${criticals} — self-inconsistent`);
    } else if (isClosed(nn) && criticals > 0) {
      flagged++;
      check(`gate:verify-${nn}`, 'warn', `verify criticals=${criticals} but sprint ${nn} is closed in state.yaml`);
    }
  }

  if (scanned === 0) check('gate:records', 'skip', 'no parseable MIDAS_*_RESULT tally lines');
  else if (flagged === 0) check('gate:records', 'ok', `${scanned} record(s) consistent with state`);
}

// Structured gate registry: machine-readable phase gate index that mirrors the methodology table.
const gatesRegistryRaw = read(join(paths.engine, 'gates.json'));
if (gatesRegistryRaw === null) {
  check('gates:registry', 'skip', `no ${paths.engine}/gates.json`);
} else {
  try {
    const generatedGatesRegistry = computeGatesIndex(ROOT, paths.engine);
    const gatesRegistry = JSON.parse(gatesRegistryRaw);
    const gates = Array.isArray(gatesRegistry.gates) ? gatesRegistry.gates : [];
    const phases = gates.map((g) => g?.phase).filter(Boolean);
    const expected = ['idea_intake', 'contextualize', 'market_research', 'business_case', 'tech_architecture', 'architecture_rules', 'sprint_planning', 'sprint_execution', 'audit'];
    const missing = expected.filter((phase) => !phases.includes(phase));
    if (missing.length) {
      check('gates:registry', 'warn', `missing phase entries: ${missing.join(', ')}`);
    } else if (JSON.stringify(gatesRegistry) !== JSON.stringify(generatedGatesRegistry)) {
      check('gates:registry', 'warn', 'gates.json drifted from the generated registry — run `node scripts/doctor.mjs --fix`');
    } else {
      check('gates:registry', 'ok', `${gates.length} phase gate entries`);
    }
  } catch (err) {
    check('gates:registry', 'warn', err.message || 'invalid JSON');
  }
}

// Structured stage-command table: canonical phase -> ritual/recall map.
const stageTableRaw = read(join(paths.engine, 'stage-command-table.yaml'));
if (stageTableRaw === null) {
  check('stage-table', 'skip', `no ${paths.engine}/stage-command-table.yaml`);
} else {
  try {
    const generatedStageTable = computeStageCommandTableYaml();
    if (stageTableRaw !== generatedStageTable) {
      check('stage-table', 'warn', 'stage-command-table.yaml drifted from the generated table — run `node scripts/doctor.mjs --fix`');
    } else {
      check('stage-table', 'ok', 'canonical stage-command table');
    }
  } catch (err) {
    check('stage-table', 'warn', err.message || 'invalid stage-command table');
  }
}

// Structured design-system CSS: generated from harness/design-system/tokens.json.
const designSystemCssRaw = read(join(paths.engine, 'design-system/tokens.css'));
if (designSystemCssRaw === null) {
  check('design-system:tokens', 'skip', `no ${paths.engine}/design-system/tokens.css`);
} else {
  try {
    const generatedDesignSystemCss = computeDesignSystemCss(ROOT);
    if (designSystemCssRaw !== generatedDesignSystemCss) {
      check('design-system:tokens', 'warn', 'design-system/tokens.css drifted from the generated CSS — run `node scripts/doctor.mjs --fix`');
    } else {
      check('design-system:tokens', 'ok', 'design-system tokens are generated from tokens.json');
    }
  } catch (err) {
    check('design-system:tokens', 'warn', err.message || 'invalid design-system tokens');
  }
}

// Structured check index: machine-readable CHECK digest extracted from harness/rules/*.md.
const checksIndexRaw = read(join(paths.engine, 'checks.json'));
if (checksIndexRaw === null) {
  check('checks:index', 'skip', `no ${paths.engine}/checks.json`);
} else {
  try {
    const generatedChecksIndex = computeChecksIndex(ROOT, paths.engine);
    const checksIndex = JSON.parse(checksIndexRaw);
    const rules = Array.isArray(checksIndex.rules) ? checksIndex.rules : [];
    const ruleFiles = existsSync(join(ROOT, paths.engine, 'rules'))
      ? readdirSync(join(ROOT, paths.engine, 'rules')).filter((f) => f.endsWith('.md')).length
      : 0;
    const missingChecks = rules.filter((r) => !Array.isArray(r.checks) || r.checks.length === 0);
    const malformedRules = rules.filter((r) =>
      !r || typeof r !== 'object' ||
      typeof r.slug !== 'string' ||
      typeof r.title !== 'string' ||
      typeof r.path !== 'string' ||
      typeof r.owner !== 'string' ||
      r.phase !== 8 ||
      typeof r.check_count !== 'number' ||
      !Array.isArray(r.checks) ||
      r.checks.some((c) =>
        !c || typeof c !== 'object' ||
        typeof c.kind !== 'string' ||
        typeof c.body !== 'string' ||
        typeof c.owner !== 'string' ||
        c.owner !== r.owner ||
        c.phase !== 8 ||
        !['command', 'manual'].includes(c.kind) ||
        !['high', 'medium'].includes(c.severity) ||
        (c.kind === 'manual' ? c.severity !== 'medium' : c.severity !== 'high') ||
        !(c.section === null || typeof c.section === 'string')
      )
    );
    if (ruleFiles && rules.length !== ruleFiles) {
      check('checks:index', 'warn', `index has ${rules.length} rule rows but rules dir has ${ruleFiles} files`);
    } else if (malformedRules.length) {
      check('checks:index', 'warn', `malformed structured rows: ${malformedRules.map((r) => r.slug || r.path).join(', ')}`);
    } else if (missingChecks.length) {
      check('checks:index', 'warn', `rules with no structured checks: ${missingChecks.map((r) => r.slug || r.path).join(', ')}`);
    } else if (JSON.stringify(checksIndex) !== JSON.stringify(generatedChecksIndex)) {
      check('checks:index', 'warn', 'checks.json drifted from the generated index — run `node scripts/doctor.mjs --fix`');
    } else {
      check('checks:index', 'ok', `${rules.length} rule rows with structured CHECKs`);
    }
  } catch (err) {
    check('checks:index', 'warn', err.message || 'invalid JSON');
  }
}

console.log('\nmidas doctor — health');
for (const h of health) console.log(`  ${h.status.padEnd(4)} ${h.name}${h.note ? ' — ' + h.note : ''}`);

if (drift) {
  console.log('\nAdapters OUT OF SYNC. Run `' + doctorCmd + ' --fix` (or `/midas-doctor`).');
  process.exit(1);
}
const gateWarn = health.some((h) => h.name.startsWith('gate:') && h.status === 'warn');
if (STRICT && gateWarn) {
  console.log('\nSTRICT: a frozen gate record is inconsistent with state.yaml (see the gate:* warnings above).');
  process.exit(1);
}
const tail = GATES_ONLY ? 'Gate checks complete.' : 'Adapters in sync.';
console.log(`\n${tail}` + (health.some((h) => h.status === 'warn') ? ' (review health warnings above)' : ''));
process.exit(0);
