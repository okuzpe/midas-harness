#!/usr/bin/env node
// doctor.mjs — Midas adapter drift checker + install health check (dependency-free, Node ESM).
//
//   node scripts/doctor.mjs          → check generated adapters (exit 1 on drift) + report health warnings
//   node scripts/doctor.mjs --fix    → re-render the adapters from source, then exit 0
//   node scripts/doctor.mjs <dir>    → check THAT project (its adapters, state.yaml, gate records), not the engine
//   node scripts/doctor.mjs --strict → exit 1 on deterministic install/registry/gate drift
//   node scripts/doctor.mjs --gates-only → skip adapter drift (for partial examples like product-closed)
//
// Adapter drift is always authoritative. Under --strict, deterministic health invariants also block;
// project-dependent recommendations remain advisory. Shares render logic with render-adapters.mjs.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAdapters, computeChecksIndex, computeGatesIndex, renderAdapters } from './render-adapters.mjs';
import { checkSkillRegistry, isHostMirrorExcluded } from './skill-registry.mjs';
import { evaluateMcpDeclaredVsWired, evaluateMcpGovernance, evaluateSkillMcpRequired, collectSkillMcpRequired } from './mcp-drift.mjs';
import { parseSprints, parseSprintLastTouched, parsePhases, parseEnforcement, parseRouting, parseToolsFromStateYaml, rewriteRoutingMap } from './yaml-lite.mjs';
import { syncCursorMcp, wrapMcpServersForWindows } from './mcp-cursor-sync.mjs';
import { auditGitignore, ensureMidasGitignore } from './gitignore-merge.mjs';
import { resolvePaths, detectLayout, resolveProjectRootFromScript } from './paths.mjs';
import { formatUpdateCmd } from './lib/install-cmd.mjs';
import { computeStageCommandTableYaml, renderStageCommandTable } from './stage-command-table.mjs';
import { computeDesignSystemCss, renderDesignSystemTokens } from './design-system.mjs';
import {
  normalizeRoutingProfile,
  normalizeCostProfile,
  resolveRoutingModels,
  resolveCostAwareRouting,
  knownRoutingModelIds,
} from './model-profiles.mjs';
import { readOwnershipManifest, findVendorConflicts, sha256File } from './ownership-manifest.mjs';
import { renderPortableSkillText } from './portable-skills.mjs';
import { orphanRootMidasPaths, resolveSkillMirrorPlan } from './tool-profiles.mjs';

let pluginHelpers = null;
if (existsSync(join(dirname(fileURLToPath(import.meta.url)), 'build-plugin.mjs'))) {
  pluginHelpers = await import('./build-plugin.mjs');
}

const HELP = `midas doctor — adapter drift checker + install health check

Usage:
  node scripts/doctor.mjs [dir]     check adapters + health (exit 1 on drift)
  node scripts/doctor.mjs --fix     re-render adapters from source
  node scripts/doctor.mjs --strict  exit 1 on deterministic install, registry, routing, or gate drift
  node scripts/doctor.mjs --strict --profile=install-verify
      reduced blocking set for create-midas verify (omits rules:combined + mcp governance/sync)
  node scripts/doctor.mjs --gates-only  skip adapter drift check
  node scripts/doctor.mjs --help    show this help

Profiles (with --strict):
  full            default for humans / midas-doctor — all deterministic warns block
  install-verify  installer post-apply — layout/version/routing/manifest/mirrors/adapters/secrets;
                  rules:combined and mcp:governance|cursor-sync|template-sync|declared-vs-wired stay warn-only`;

const FIX = process.argv.includes('--fix');
const STRICT = process.argv.includes('--strict');
const GATES_ONLY = process.argv.includes('--gates-only');
const SHOW_HELP = process.argv.includes('--help') || process.argv.includes('-h');
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
const STRICT_PROFILE = (profileArg ? profileArg.slice('--profile='.length) : 'full').trim() || 'full';
// Optional positional project root: check THAT project instead of the engine repo. Lets `--strict` run
// against a real install (or scripts/fixtures/product-closed) so the gate-records check is provably exercised.
const rootArg = process.argv.slice(2).find((a) => !a.startsWith('-') && !a.startsWith('--'));
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

/** Prefer host discovery agents (`.claude/agents`) — that is the runtime binding — then engine source. */
function agentPath(name) {
  const host = join('.claude', 'agents', name + '.md');
  const engine = join(paths.engine, 'agents', name + '.md');
  if (existsSync(join(ROOT, host))) return host;
  if (existsSync(join(ROOT, engine))) return engine;
  return null;
}

/** Read the pinned `model:` of a first-party agent (the real runtime binding), or null. */
function agentModel(name) {
  const rel = agentPath(name);
  const t = rel && read(rel);
  const m = t && t.match(/^model:\s*([^\s#]+)/m);
  return m ? m[1] : null;
}

/**
 * Rewrite first-party agent `model:` pins to match a resolved routing map.
 * Product installs: `.claude/agents`. Engine repo: also updates `harness/agents` only when the
 * caller asks (engine dogfood stays on balanced pins by default).
 */
function syncAgentPins(expected, { alsoEngine = false } = {}) {
  const wrote = [];
  const targets = [
    ['orchestrate', 'midas-orchestrator'],
    ['build', 'midas-builder'],
    ['scout', 'midas-scout'],
  ];
  for (const [tier, name] of targets) {
    const want = expected[tier];
    if (!want) continue;
    const rels = [join('.claude', 'agents', name + '.md')];
    if (alsoEngine) rels.push(join(paths.engine, 'agents', name + '.md'));
    for (const rel of rels) {
      const abs = join(ROOT, rel);
      if (!existsSync(abs)) continue;
      const raw = readFileSync(abs, 'utf8');
      if (!/^model:\s*[^\s#]+/m.test(raw)) continue;
      const next = raw.replace(/^model:\s*[^\s#]+/m, `model: ${want}`);
      if (next === raw) continue;
      writeFileSync(abs, next, 'utf8');
      wrote.push(`${rel} → ${want}`);
    }
  }
  return wrote;
}

function walkRelativeFiles(base) {
  if (!existsSync(base)) return [];
  const out = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) visit(abs);
      else if (entry.isFile()) out.push(relative(base, abs).replace(/\\/g, '/'));
    }
  };
  visit(base);
  return out.sort();
}

function compareMirror(sourceRel, targetRel, transform = (_rel, raw) => raw, opts = {}) {
  const source = join(ROOT, sourceRel);
  const target = join(ROOT, targetRel);
  if (!existsSync(source)) return { status: 'skip', note: `no ${sourceRel}` };
  if (!existsSync(target)) return { status: 'warn', note: `${targetRel} missing` };
  const excludeTop = opts.excludeTopLevelDirs instanceof Set
    ? opts.excludeTopLevelDirs
    : new Set(opts.excludeTopLevelDirs || []);
  const sourceFiles = walkRelativeFiles(source).filter((file) => {
    const top = file.split('/')[0];
    return !excludeTop.has(top);
  });
  const targetFiles = walkRelativeFiles(target);
  const missing = sourceFiles.filter((file) => !targetFiles.includes(file));
  const extra = targetFiles.filter((file) => !sourceFiles.includes(file));
  const staleExcluded = extra.filter((file) => excludeTop.has(file.split('/')[0]));
  const drifted = sourceFiles.filter((file) => {
    const targetFile = join(target, file);
    return existsSync(targetFile) &&
      readFileSync(targetFile, 'utf8') !== transform(file, readFileSync(join(source, file), 'utf8'));
  });
  const failures = [
    missing.length ? `missing=${missing.length}` : '',
    drifted.length ? `drift=${drifted.length}` : '',
    staleExcluded.length ? `stale-excluded=${staleExcluded.length}` : '',
  ].filter(Boolean);
  const userExtra = extra.length - staleExcluded.length;
  return failures.length
    ? { status: 'warn', note: `${failures.join(', ')} — regenerate ${targetRel}` }
    : {
        status: 'ok',
        note: `${sourceFiles.length}/${sourceFiles.length} Midas files match` +
          (userExtra > 0 ? `; ${userExtra} user/host file(s) preserved` : ''),
      };
}

function hostMirrorSkillExcludeSet(engineSkillsRel) {
  const abs = join(ROOT, engineSkillsRel);
  if (!existsSync(abs)) return new Set();
  return new Set(
    readdirSync(abs, { withFileTypes: true })
      .filter((e) => e.isDirectory() && isHostMirrorExcluded(e.name))
      .map((e) => e.name),
  );
}

// --- --fix: rewrite adapters via the shared render path ----------------------------------------
const ENGINE_VERSION = (read(paths.version) || '').trim();
if (FIX) {
  if (!existsSync(join(ROOT, paths.engine, 'conventions.md'))) {
    console.error(`midas doctor --fix: ${paths.engine}/conventions.md missing — cannot render adapters.`);
    process.exit(1);
  }
  const { hash, results } = renderAdapters(ROOT);
  const stageTable = paths.layout === 'harness' ? null : renderStageCommandTable(ROOT);
  const designSystem = paths.layout === 'harness' ? null : renderDesignSystemTokens(ROOT);
  console.log(`midas doctor --fix: re-rendered adapters from ${paths.engine}/conventions.md`);
  for (const r of results) console.log(`  ${r.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${r.path}`);
  if (stageTable) console.log(`  ${stageTable.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${stageTable.path}`);
  if (designSystem) console.log(`  ${designSystem.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${designSystem.path}`);
  console.log(`  source hash: ${hash}`);
  const stateForMcp = read(paths.state) || '';
  const manifest = readOwnershipManifest(ROOT);
  const cursorEntry = manifest?.files?.find((file) => file.path === '.cursor/mcp.json');
  const cursorPath = join(ROOT, '.cursor', 'mcp.json');
  const ownedCursorMcp = cursorEntry && existsSync(cursorPath) && sha256File(cursorPath) === cursorEntry.sha256;
  const sync = syncCursorMcp(ROOT, stateForMcp, { preserveExisting: !ownedCursorMcp });
  if (sync.conflict) {
    console.error('midas doctor --fix: .cursor/mcp.json is user-modified; reconcile it with .mcp.json manually.');
    process.exit(1);
  }
  if (sync.synced) console.log('  wrote    .cursor/mcp.json (synced from .mcp.json for Cursor)');
  const gi = ensureMidasGitignore(ROOT);
  if (gi.wrote) {
    console.log(gi.upgraded ? '  upgraded .gitignore (missing Midas patterns)' : '  wrote    .gitignore (Midas block)');
  }
  // Sync state.routing + first-party agent pins to cost_profile-resolved map.
  // Product installs (layout: harness): rewrite `.claude/agents` and engine agent copies together.
  // Engine classic dogfood: rewrite state.routing when mismatched; never rewrite harness/agents
  // (balanced pins are the published defaults).
  {
    const stateForPins = read(paths.state) || '';
    if (stateForPins && ENGINE_VERSION) {
      const bumped = stateForPins.replace(/^midas_version:\s*[^\s#]+/m, `midas_version: ${ENGINE_VERSION}`);
      if (bumped !== stateForPins) {
        writeFileSync(join(ROOT, paths.state), bumped, 'utf8');
        console.log(`  wrote    ${paths.state} midas_version: ${ENGINE_VERSION}`);
      }
    }
    if (stateForPins) {
      const { costProfile, routingProfile } = parseRouting(stateForPins);
      const activeProfile = normalizeRoutingProfile(routingProfile) || 'claude';
      const localModel = (stateForPins.match(/^local_model:\s*\n(?:[^\n]*\n)*?\s*id:\s*([^\s#]+)/m) || [])[1] || 'local_model.id';
      const expectedPins = resolveCostAwareRouting(activeProfile, costProfile, {
        localModelId: localModel,
        defaultRoutingProfile: 'claude',
      });
      const normalizedCost = normalizeCostProfile(costProfile) || 'balanced';
      if (activeProfile === 'claude') {
        const nextState = rewriteRoutingMap(stateForPins, expectedPins);
        if (nextState) {
          writeFileSync(join(ROOT, paths.state), nextState, 'utf8');
          console.log(`  wrote    ${paths.state} routing: (cost_profile=${normalizedCost})`);
        }
        if (paths.layout === 'harness') {
          for (const line of syncAgentPins(expectedPins, { alsoEngine: true })) {
            console.log(`  wrote    ${line} (cost_profile=${normalizedCost})`);
          }
        }
      }
    }
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

// --- 2. health checks (strict mode promotes deterministic warnings to a failing exit) -----------
const health = [];
const check = (name, status, note) => health.push({ name, status, note: note || '' });

// version: state midas_version vs engine VERSION
const VERSION = ENGINE_VERSION;
const stateRaw = read(paths.state);
if (!stateRaw) {
  check('version', 'skip', `no ${paths.state} (engine repo or pre-init)`);
} else {
  const m = stateRaw.match(/^midas_version:\s*([0-9][^\s#]*)/m);
  const sv = m ? m[1] : null;
  if (!sv) check('version', 'warn', 'state.yaml has no midas_version');
  else if (VERSION && sv !== VERSION) {
    check(
      'version',
      'warn',
      `state ${sv} != engine ${VERSION} — run ${formatUpdateCmd({ version: VERSION })} (or /midas-init for the tip)`,
    );
  }
  else check('version', 'ok', sv || '');
  for (const k of ['stage', 'cost_profile', 'routing']) {
    if (!new RegExp(`(^|\\n)${k}:`).test(stateRaw)) check(`state:${k}`, 'warn', 'missing required key');
  }

  // routing: cost_profile + routing_profile resolve an expected map; agent `model:` pins are the
  // runtime binding. Under the Claude profile, state.routing AND pins must match the cost-aware map
  // (max_savings / max_quality are no longer advisory-only).
  const pinned = {
    orchestrate: agentModel('midas-orchestrator'),
    build: agentModel('midas-builder'),
    scout: agentModel('midas-scout'),
  };
  const allow = knownRoutingModelIds();
  if (allow.size === 0) {
    check('routing', 'skip', 'no .claude/agents to reconcile against');
  } else {
    const tiers = ['orchestrate', 'build', 'scout'];
    const { costProfile, routingProfile, routing } = parseRouting(stateRaw);
    const activeProfile = normalizeRoutingProfile(routingProfile) || 'claude';
    const normalizedCost = normalizeCostProfile(costProfile);
    const localModel = (stateRaw.match(/^local_model:\s*\n(?:[^\n]*\n)*?\s*id:\s*([^\s#]+)/m) || [])[1] || 'local_model.id';
    const unknown = tiers.filter((t) => routing[t] && !allow.has(routing[t]));
    if (costProfile && !normalizedCost) {
      check('routing', 'warn', `unknown cost_profile ${costProfile} — expected balanced|max_savings|max_quality`);
    } else if (unknown.length) {
      check('routing', 'warn', `${unknown.map((t) => `${t}=${routing[t]}`).join(', ')} not a known model id — see docs/agents-and-models.md`);
    } else if (activeProfile === 'claude') {
      const expected = resolveCostAwareRouting('claude', normalizedCost || 'balanced');
      const stateMism = tiers.filter((t) => routing[t] && routing[t] !== expected[t]);
      const pinMism = tiers.filter((t) => pinned[t] && pinned[t] !== expected[t]);
      if (stateMism.length) {
        check('routing', 'warn',
          `cost_profile ${normalizedCost || 'balanced'}: ${stateMism.map((t) => `${t}: state ${routing[t]} != expected ${expected[t]}`).join('; ')} — update routing: or run doctor --fix`);
      } else if (pinMism.length) {
        check('routing', 'warn',
          `cost_profile ${normalizedCost || 'balanced'}: ${pinMism.map((t) => `${t}: agent ${pinned[t]} != expected ${expected[t]}`).join('; ')} — run \`${doctorCmd} --fix\` to sync agent pins`);
      } else {
        check('routing', 'ok',
          `cost_profile ${normalizedCost || 'balanced'} matches state.routing + agent pins`);
      }
    } else if (activeProfile === 'openai-mini') {
      const expected = resolveRoutingModels('openai-mini');
      const mism = tiers.filter((t) => routing[t] && routing[t] !== expected[t]);
      check('routing', mism.length ? 'warn' : 'ok',
        mism.length ? mism.map((t) => `${t}: state ${routing[t]} != profile ${expected[t]}`).join('; ') : 'openai-mini profile resolves to gpt-5.4-mini');
    } else if (activeProfile === 'local-hybrid') {
      const expected = resolveRoutingModels('local-hybrid', { localModelId: localModel });
      const mism = tiers.filter((t) => routing[t] && routing[t] !== expected[t]);
      check('routing', mism.length ? 'warn' : 'ok',
        mism.length ? mism.map((t) => `${t}: state ${routing[t]} != profile ${expected[t]}`).join('; ') : `local-hybrid profile resolves to ${localModel}`);
    } else {
      check('routing', 'warn', `unknown routing_profile ${routingProfile || '(unset)'} - see docs/agents-and-models.md`);
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
  check('layout:consistent', 'warn', 'canonical and legacy install markers coexist — resolve the partial migration');
} else if (!stateRaw) {
  check('layout:consistent', 'skip', 'no state file');
} else if (declaredLayout && detected && declaredLayout !== detected) {
  check('layout:consistent', 'warn', `state layout=${declaredLayout} but disk=${detected}`);
} else if (detected !== 'harness' && existsSync(join(ROOT, '.harness', 'engine'))) {
  check('layout:consistent', 'warn', `installed engine must use layout=harness, found ${detected || 'unknown'}`);
} else {
  check('layout:consistent', 'ok', declaredLayout || detected || paths.layout);
}

if (paths.layout === 'harness') {
  const manifest = readOwnershipManifest(ROOT);
  if (!manifest) {
    check('manifest:integrity', 'warn', `${paths.manifest} missing or invalid`);
  } else {
    const vendorConflicts = findVendorConflicts(ROOT, manifest);
    const invalidRoles = manifest.files.filter((file) => !['vendor', 'generated', 'user'].includes(file.role));
    const missingGenerated = manifest.files
      .filter((file) => file.role === 'generated')
      .filter((file) => !existsSync(join(ROOT, file.path)));
    const problems = [
      vendorConflicts.length ? `vendor drift=${vendorConflicts.length}` : '',
      invalidRoles.length ? `invalid roles=${invalidRoles.length}` : '',
      missingGenerated.length ? `generated missing=${missingGenerated.length}` : '',
      manifest.layout !== 'harness' ? `layout=${manifest.layout || 'unset'}` : '',
      VERSION && manifest.midas_version !== VERSION
        ? `version=${manifest.midas_version || 'unset'} (engine ${VERSION})`
        : '',
    ].filter(Boolean);
    check(
      'manifest:integrity',
      problems.length ? 'warn' : 'ok',
      problems.length ? problems.join(', ') : `${manifest.files.length} owned file(s) classified`,
    );
  }

  const tools = stateRaw ? parseToolsFromStateYaml(stateRaw) || [] : [];
  const skillPlan = resolveSkillMirrorPlan(tools);
  const skillExclude = hostMirrorSkillExcludeSet(join(paths.engine, 'skills'));
  if (skillPlan.claude) {
    const skillsMirror = compareMirror(join(paths.engine, 'skills'), '.claude/skills', (_rel, raw) => raw, {
      excludeTopLevelDirs: skillExclude,
    });
    check('mirror:claude-skills', skillsMirror.status, skillsMirror.note);
    const agentsMirror = compareMirror(join(paths.engine, 'agents'), '.claude/agents');
    check('mirror:claude-agents', agentsMirror.status, agentsMirror.note);
  }
  if (skillPlan.agents) {
    const portableMirror = compareMirror(
      join(paths.engine, 'skills'),
      '.agents/skills',
      (file, raw) => file.endsWith('/SKILL.md') || file === 'SKILL.md'
        ? renderPortableSkillText(raw, file)
        : raw,
      { excludeTopLevelDirs: skillExclude },
    );
    check('mirror:agent-skills', portableMirror.status, portableMirror.note);
  }
  if (skillPlan.cursorSkills) {
    const cursorMirror = compareMirror(
      join(paths.engine, 'skills'),
      '.cursor/skills',
      (file, raw) => file.endsWith('/SKILL.md') || file === 'SKILL.md'
        ? renderPortableSkillText(raw, file)
        : raw,
      { excludeTopLevelDirs: skillExclude },
    );
    check('mirror:cursor-skills', cursorMirror.status, cursorMirror.note);
  }

  const orphans = orphanRootMidasPaths(tools, paths.layout).filter((rel) => {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) return false;
    if (statSync(abs).isFile()) return true;
    // Directories: only orphan if a Midas engine skill/agent name is still present (preserve user neighbors).
    if (rel.includes('skills')) {
      const engineSkills = join(ROOT, paths.engine, 'skills');
      if (!existsSync(engineSkills)) return false;
      return readdirSync(engineSkills).some((name) => existsSync(join(abs, name)));
    }
    if (rel.includes('agents')) {
      const engineAgents = join(ROOT, paths.engine, 'agents');
      if (!existsSync(engineAgents)) return false;
      return readdirSync(engineAgents).some((name) => existsSync(join(abs, name)));
    }
    return readdirSync(abs).length > 0;
  });
  check(
    'layout:root-allowlist',
    orphans.length ? 'warn' : 'ok',
    orphans.length
      ? `orphan Midas host paths (not justified by tools=[${tools.join(', ')}]): ${orphans.join(', ')} — run create-midas --update --tools=…`
      : `root host surfaces match tools=[${tools.join(', ') || 'none'}]`,
  );

  const legacyMarkers = [
    ['harness/state.yaml', null],
    ['harness/VERSION', null],
    ['.midas/state.yaml', null],
    ['.midas/engine/VERSION', null],
    ['scripts/doctor.mjs', /\bMidas\b/i],
    ['product/idea.md', /\bMidas\b/i],
  ].filter(([rel, signature]) => {
    const abs = join(ROOT, rel);
    return existsSync(abs) && statSync(abs).isFile() &&
      (!signature || signature.test(readFileSync(abs, 'utf8').slice(0, 1200)));
  }).map(([rel]) => rel);
  check(
    'layout:legacy-artifacts',
    legacyMarkers.length ? 'warn' : 'ok',
    legacyMarkers.length ? `identifiable Midas files remain: ${legacyMarkers.join(', ')}` : 'none',
  );
}

// critical files
for (const f of ['AGENTS.md', join(paths.engine, 'conventions.md'), join(paths.engine, 'methodology.md')]) {
  check(`file:${f}`, existsSync(join(ROOT, f)) ? 'ok' : 'warn', existsSync(join(ROOT, f)) ? '' : 'missing');
}

{
  const gi = auditGitignore(ROOT);
  check('gitignore:midas-block', gi.status, gi.note);
}

// .mcp.json must be secret-free (only ${ENV_VAR} placeholders)
const mcp = read('.mcp.json');
if (mcp === null) {
  check('mcp:secret-free', 'skip', 'no .mcp.json');
} else {
  let leak = false;
  const re = /(authorization|token|api[_-]?key|secret|password)"\s*:\s*"([^"]+)"/gi;
  let mm;
  while ((mm = re.exec(mcp))) if (!/^\$\{[A-Z0-9_]+\}$/.test(mm[2])) leak = true;
  if (/\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,})\b/.test(mcp)) leak = true;
  check('mcp:secret-free', leak ? 'warn' : 'ok', leak ? 'a literal secret may be present — use ${ENV_VAR}' : '');
  const governance = evaluateMcpGovernance(mcp);
  const mcpGovernance = (stateRaw?.match(/^mcp_governance:\s*(\S+)/m) || [])[1]?.replace(/['"]/g, '') || 'runlayer';
  let govStatus = governance.status;
  let govNote = governance.note;
  if (mcpGovernance === 'self_managed' && governance.status === 'warn' && governance.shadowServers?.length) {
    govStatus = 'ok';
    govNote = `self_managed — ${governance.note}`;
  }
  check('mcp:governance', govStatus, govNote);
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

    const carryoverScript = join(ROOT, paths.scripts, 'carryover-refresh.mjs');
    if (!existsSync(carryoverScript)) {
      check('gate:carryover-hook', 'skip', 'carryover-refresh.mjs not installed in paths.scripts');
    } else {
      const hooksRaw = read('.cursor/hooks.json');
      if (hooksRaw === null) {
        check(
          'gate:carryover-hook',
          'warn',
          '`.cursor/hooks.json` missing — re-run installer with `--tools=cursor` or merge carryover sessionStart hook',
        );
      } else {
        try {
          const hooks = JSON.parse(hooksRaw);
          const list = hooks?.hooks?.sessionStart;
          const hasCarryover = Array.isArray(list) && list.some(
            (h) => h && typeof h.command === 'string' && h.command.includes('carryover-refresh.mjs'),
          );
          check(
            'gate:carryover-hook',
            hasCarryover ? 'ok' : 'warn',
            hasCarryover
              ? ''
              : 'sessionStart missing carryover-refresh.mjs — re-run installer or merge carryover hook',
          );
        } catch {
          check('gate:carryover-hook', 'warn', '`.cursor/hooks.json` invalid JSON');
        }
      }
    }

    const contextCostScript = join(ROOT, paths.scripts, 'context-cost-refresh.mjs');
    if (!existsSync(contextCostScript)) {
      check('gate:context-cost-hook', 'skip', 'context-cost-refresh.mjs not installed in paths.scripts');
    } else {
      const hooksRawCost = read('.cursor/hooks.json');
      if (hooksRawCost === null) {
        check(
          'gate:context-cost-hook',
          'warn',
          '`.cursor/hooks.json` missing — re-run installer with `--tools=cursor` or merge context-cost sessionStart hook',
        );
      } else {
        try {
          const hooks = JSON.parse(hooksRawCost);
          const list = hooks?.hooks?.sessionStart;
          const hasContextCost = Array.isArray(list) && list.some(
            (h) => h && typeof h.command === 'string' && h.command.includes('context-cost-refresh.mjs'),
          );
          check(
            'gate:context-cost-hook',
            hasContextCost ? 'ok' : 'warn',
            hasContextCost
              ? ''
              : 'sessionStart missing context-cost-refresh.mjs — re-run installer or merge context-cost hook',
          );
        } catch {
          check('gate:context-cost-hook', 'warn', '`.cursor/hooks.json` invalid JSON');
        }
      }
    }

    const SAFETY_HOOK_SCRIPTS = ['secrets-prompt.mjs', 'gate-commits.mjs', 'destructive-shell.mjs'];
    const hooksRawSafety = read('.cursor/hooks.json');
    if (hooksRawSafety === null) {
      check('gate:safety-hooks', 'skip', 'no .cursor/hooks.json');
    } else {
      try {
        const hooksDoc = JSON.parse(hooksRawSafety);
        const hookCommands = [
          ...(hooksDoc?.hooks?.beforeSubmitPrompt || []),
          ...(hooksDoc?.hooks?.beforeShellExecution || []),
        ]
          .map((h) => (h && typeof h.command === 'string' ? h.command : ''))
          .filter(Boolean);
        const wantsSafety = hookCommands.some(
          (cmd) => cmd.includes('scripts/safety/') || cmd.includes('.harness/scripts/safety/'),
        );
        if (!wantsSafety) {
          check('gate:safety-hooks', 'skip', 'no safety hook commands in .cursor/hooks.json');
        } else {
          let missing = false;
          for (const script of SAFETY_HOOK_SCRIPTS) {
            const scriptPath = join(ROOT, paths.scripts, 'safety', script);
            const ok = existsSync(scriptPath);
            if (!ok) missing = true;
            check(
              `gate:safety-script:${script}`,
              ok ? 'ok' : 'warn',
              ok ? '' : `missing ${paths.scripts}/safety/${script} — run installer --update`,
            );
          }
          check(
            'gate:safety-hooks',
            missing ? 'warn' : 'ok',
            missing ? 'safety hooks wired but script(s) missing on disk' : '',
          );
        }
      } catch {
        check('gate:safety-hooks', 'warn', '`.cursor/hooks.json` invalid JSON');
      }
    }
  }
}
{
  const templateMcp = read(join('cli', 'template', '.mcp.json'));
  if (templateMcp !== null && mcp !== null) {
    check(
      'mcp:template-sync',
      templateMcp === mcp ? 'ok' : 'warn',
      templateMcp === mcp ? '' : 'cli/template/.mcp.json drifted from root .mcp.json',
    );
  }
}
{
  const pluginRoot = join(ROOT, 'harness', 'plugins', 'midas');
  if (existsSync(pluginRoot) && pluginHelpers) {
    const { computePluginManifest, computePluginReadme, computeMarketplaceJson } = pluginHelpers;
    const pluginJson = read(join('harness', 'plugins', 'midas', '.claude-plugin', 'plugin.json'));
    if (pluginJson !== null) {
      check(
        'plugin:manifest-json',
        pluginJson === JSON.stringify(computePluginManifest(), null, 2) + '\n' ? 'ok' : 'warn',
        pluginJson === JSON.stringify(computePluginManifest(), null, 2) + '\n'
          ? ''
          : 'harness/plugins/midas/.claude-plugin/plugin.json drifted from the generated manifest',
      );
    }
    const pluginReadme = read(join('harness', 'plugins', 'midas', 'README.md'));
    if (pluginReadme !== null) {
      check(
        'plugin:readme',
        pluginReadme === computePluginReadme() ? 'ok' : 'warn',
        pluginReadme === computePluginReadme() ? '' : 'harness/plugins/midas/README.md drifted from the generated README',
      );
    }
    const marketplaceJson = read(join('harness', '.claude-plugin', 'marketplace.json'));
    if (marketplaceJson !== null) {
      check(
        'plugin:marketplace-json',
        marketplaceJson === JSON.stringify(computeMarketplaceJson(), null, 2) + '\n' ? 'ok' : 'warn',
        marketplaceJson === JSON.stringify(computeMarketplaceJson(), null, 2) + '\n'
          ? ''
          : 'harness/.claude-plugin/marketplace.json drifted from the generated marketplace',
      );
    }
  }
}

{
  const mcpDrift = evaluateMcpDeclaredVsWired(stateRaw, mcp);
  check('mcp:declared-vs-wired', mcpDrift.status, mcpDrift.note);
}
{
  const required = collectSkillMcpRequired(join(ROOT, paths.engine, 'skills'));
  const skillMcp = evaluateSkillMcpRequired(required, mcp);
  check('mcp:skill-required', skillMcp.status, skillMcp.note);
}

// skills carry valid frontmatter with a name
const skillsDir = join(ROOT, paths.engine, 'skills');
if (!existsSync(skillsDir)) {
  check('skills:frontmatter', 'skip', `no ${paths.engine}/skills`);
} else {
  let bad = 0, total = 0;
  for (const d of readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    total++;
    const skillPath = join(skillsDir, d.name, 'SKILL.md');
    const s = existsSync(skillPath) ? readFileSync(skillPath, 'utf8') : null;
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
    const unattested = /attestation=un-attested/.test(line[0]);
    if (passClaimed && unresolved > 0) {
      // self-inconsistent: the record grades itself pass while carrying unresolved fails
      flagged++;
      check(`gate:audit-${nn}`, 'warn', `record claims verdict=pass but unresolved=${unresolved} — self-inconsistent`);
    } else if (isClosed(nn) && (unresolved > 0 || blocked)) {
      flagged++;
      check(`gate:audit-${nn}`, 'warn', `record has unresolved=${unresolved}${blocked ? ' verdict=blocked' : ''} but sprint ${nn} is closed in state.yaml`);
    } else if (isClosed(nn) && passClaimed && unattested) {
      // Advisory only (not gate:* — must not fail --strict). Binding close still owed on orchestrate.
      check(
        `audit:attestation-${nn}`,
        'warn',
        `sprint ${nn} is done but audit is un-attested — re-run /close-sprint on midas-orchestrator`,
      );
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

// Phase gate evidence: a phase marked gate:passed must carry either a non-empty assumption
// (engine dogfood / deferred phases) or on-disk artifacts: paths (product installs).
if (!stateRaw) {
  check('gate:phase-artifacts', 'skip', 'no state.yaml');
} else {
  const phases = parsePhases(stateRaw);
  let scanned = 0;
  let flagged = 0;
  for (const [name, entry] of phases) {
    if (entry.gate !== 'passed') continue;
    scanned++;
    if (entry.assumption && entry.assumption.length > 0) continue;
    if (!entry.artifacts.length) {
      flagged++;
      check(`gate:phase-${name}`, 'warn', `gate=passed but no assumption: and no artifacts: listed`);
      continue;
    }
    const missing = entry.artifacts.filter((rel) => !existsSync(join(ROOT, rel)));
    if (missing.length) {
      flagged++;
      check(`gate:phase-${name}`, 'warn', `gate=passed but missing on disk: ${missing.join(', ')}`);
    }
  }
  if (scanned === 0) check('gate:phase-artifacts', 'skip', 'no phases with gate=passed');
  else if (flagged === 0) check('gate:phase-artifacts', 'ok', `${scanned} passed phase(s) have assumption or on-disk artifacts`);
}

// Active-sprint STM continuity: progress file required when last_touched is stale/absent.
if (!stateRaw) {
  check('gate:sprint-continuity', 'skip', 'no state.yaml');
} else {
  const sprintStatus = parseSprints(stateRaw);
  const lastTouched = parseSprintLastTouched(stateRaw);
  const active = [...sprintStatus.entries()].filter(([, st]) => st === 'active');
  if (!active.length) {
    check('gate:sprint-continuity', 'skip', 'no active sprint');
  } else {
    const STALE_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let flagged = 0;
    for (const [id] of active) {
      const progressRel = join(paths.runsPath('sprints'), `${id}-progress.md`);
      const progressAbs = join(ROOT, progressRel);
      if (existsSync(progressAbs)) continue;
      const lt = lastTouched.get(id);
      const stale = !lt || Number.isNaN(Date.parse(lt)) || (now - Date.parse(lt) > STALE_MS);
      if (stale) {
        flagged++;
        check(
          'gate:sprint-continuity',
          'warn',
          `active sprint ${id} missing ${progressRel.replace(/\\/g, '/')}` +
            (lt ? ` and last_touched=${lt} is stale/absent` : ' and last_touched is absent'),
        );
      }
    }
    if (flagged === 0) {
      check('gate:sprint-continuity', 'ok', `${active.length} active sprint(s) have progress or fresh last_touched`);
    }
  }
}

// Diff-scoped gate receipts (ADR-012): scripts present; warn when active sprint + production diff lacks passing aggregate.
{
  const scriptsDir = join(ROOT, paths.scripts);
  const testGate = join(scriptsDir, 'gates', 'test-gate.mjs');
  const qualityGate = join(scriptsDir, 'gates', 'quality-gate.mjs');
  if (!existsSync(testGate) || !existsSync(qualityGate)) {
    check('gate:diff-receipts', 'skip', 'gate runners not installed in paths.scripts');
  } else if (!stateRaw) {
    check('gate:diff-receipts', 'skip', 'no state.yaml');
  } else {
    const sprintStatus = parseSprints(stateRaw);
    const active = [...sprintStatus.entries()].filter(([, st]) => st === 'active');
    if (!active.length) {
      check('gate:diff-receipts', 'ok', 'gate runners present; no active sprint');
    } else {
      let hasProd = false;
      try {
        const { hasProductionPaths, listChangedPaths } = await import('./gates/lib/diff-paths.mjs');
        hasProd = hasProductionPaths(listChangedPaths(ROOT));
      } catch {
        hasProd = false;
      }
      if (!hasProd) {
        check('gate:diff-receipts', 'ok', 'gate runners present; no production paths in working diff');
      } else {
        const { listGateRunDir, isPassingReceipt, readGateResult, findPassingGateRunForDiff } = await import('./lib/gate-result.mjs');
        const { listChangedPaths } = await import('./gates/lib/diff-paths.mjs');
        const changed = listChangedPaths(ROOT);
        const match = findPassingGateRunForDiff(ROOT, changed);
        if (match) {
          check(
            'gate:diff-receipts',
            'ok',
            `passing receipts for current diff under cache/gates/${match.runId}/`,
          );
        } else {
          const cacheGates = dirname(listGateRunDir(ROOT, '_probe'));
          let staleOnly = false;
          if (existsSync(cacheGates)) {
            for (const runId of readdirSync(cacheGates)) {
              if (runId.startsWith('_')) continue;
              const testR = readGateResult(ROOT, runId, 'test');
              const qualityR = readGateResult(ROOT, runId, 'quality');
              if (isPassingReceipt(testR) && isPassingReceipt(qualityR)) {
                staleOnly = true;
                break;
              }
            }
          }
          check(
            'gate:diff-receipts',
            'warn',
            staleOnly
              ? 'passing gate receipts exist but changed_paths do not match current production diff — re-run /midas-diff-gates'
              : 'active sprint + production diff: missing passing cache/gates/<run>/{test,quality}.json — run /midas-diff-gates before /close-sprint',
          );
        }
      }
    }
  }
}

// Close-ready preflight (ADR-012 A3): warn when active sprint fails readiness checks.
{
  const closeReadyScript = join(ROOT, paths.scripts, 'close-ready.mjs');
  if (!existsSync(closeReadyScript)) {
    check('gate:close-ready', 'skip', 'close-ready.mjs not installed in paths.scripts');
  } else if (!stateRaw) {
    check('gate:close-ready', 'skip', 'no state.yaml');
  } else {
    try {
      const { evaluateCloseReady } = await import('./lib/close-ready.mjs');
      const report = evaluateCloseReady(ROOT);
      if (report.checks[0]?.id === 'active-sprint' && report.checks[0]?.status === 'skip') {
        check('gate:close-ready', 'ok', 'no active sprint');
      } else if (report.ok) {
        check(
          'gate:close-ready',
          'ok',
          report.sprint_id ? `sprint ${report.sprint_id} ready for /close-sprint` : 'ready',
        );
      } else {
        const warns = report.checks.filter((c) => c.status === 'warn').map((c) => c.id);
        check(
          'gate:close-ready',
          'warn',
          `sprint ${report.sprint_id ?? '?'} not ready — ${warns.join(', ')} (run close-ready.mjs)`,
        );
      }
    } catch (err) {
      check('gate:close-ready', 'warn', err instanceof Error ? err.message : String(err));
    }
  }
}

// Optional bounded autonomy (ADR-009): advisory when Phase 7 but capability missing or policy disabled.
if (!stateRaw) {
  check('autonomy:capability', 'skip', 'no state.yaml');
} else {
  const stageM = stateRaw.match(/^stage:\s*(\S+)/m);
  const stage = stageM ? stageM[1] : null;
  const capability = join(ROOT, '.harness', 'autonomy', 'bin', 'midas-autopilot.mjs');
  if (stage !== 'sprint_execution') {
    check('autonomy:capability', 'skip', `stage=${stage ?? 'unknown'}`);
  } else if (!existsSync(capability)) {
    check(
      'autonomy:capability',
      'ok',
      'not installed — optional: npx … --update --autonomy then /midas-auto-pilot setup (CLI: midas-autopilot setup)',
    );
  } else {
    const policyPath = join(ROOT, '.harness', 'autonomy', 'policy.yaml');
    if (!existsSync(policyPath)) {
      check('autonomy:capability', 'warn', 'policy.yaml missing under .harness/autonomy/');
    } else {
      const policyRaw = readFileSync(policyPath, 'utf8');
      const disabled = /^enabled:\s*false/m.test(policyRaw) || /^mode:\s*disabled/m.test(policyRaw);
      const sprintStatus = parseSprints(stateRaw);
      const runnable = [...sprintStatus.values()].some((st) => st === 'active' || st === 'planned');
      if (disabled && runnable) {
        check(
          'autonomy:capability',
          'warn',
          'installed but disabled while a sprint is active/planned — run midas-autopilot setup',
        );
      } else if (disabled) {
        check('autonomy:capability', 'ok', 'installed; enable with midas-autopilot setup when needed');
      } else {
        check('autonomy:capability', 'ok', 'bounded policy enabled');
      }
    }
  }
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
      check('gates:registry', 'warn', `gates.json drifted from the generated registry — engine maintainers run \`${doctorCmd} --fix\``);
    } else {
      check('gates:registry', 'ok', `${gates.length} phase gate entries`);
    }
  } catch (err) {
    check('gates:registry', 'warn', err.message || 'invalid JSON');
  }
}

// Structured stage-command table: runtime YAML must match STAGE_ROWS (authoring SoT).
const stageTableRaw = read(join(paths.engine, 'stage-command-table.yaml'));
if (stageTableRaw === null) {
  check('stage-table', 'skip', `no ${paths.engine}/stage-command-table.yaml`);
} else {
  try {
    const generatedStageTable = computeStageCommandTableYaml();
    if (stageTableRaw !== generatedStageTable) {
      check('stage-table', 'warn', `stage-command-table.yaml drifted from STAGE_ROWS — engine maintainers edit scripts/stage-command-table.mjs then run \`${doctorCmd} --fix\``);
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
      check('design-system:tokens', 'warn', `design-system/tokens.css drifted from the generated CSS — run \`node ${paths.scripts}/doctor.mjs --fix\``);
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
      check('checks:index', 'warn', `checks.json drifted from the generated index — engine maintainers run \`${doctorCmd} --fix\``);
    } else {
      check('checks:index', 'ok', `${rules.length} rule rows with structured CHECKs`);
    }
  } catch (err) {
    check('checks:index', 'warn', err.message || 'invalid JSON');
  }
}

// Skill registry: exact SKILL.md path index (recompute-and-compare; no cache sidecar).
{
  const skillsDir = join(ROOT, paths.engine, 'skills');
  if (!existsSync(skillsDir)) {
    check('skills:registry', 'skip', `no ${paths.engine}/skills`);
  } else {
    const result = checkSkillRegistry(ROOT, paths);
    if (!result.ok && result.reason === 'missing') {
      check('skills:registry', 'warn', `${result.path} missing — run \`node ${paths.scripts}/skill-registry.mjs\` or \`${doctorCmd} --fix\``);
    } else if (!result.ok) {
      check('skills:registry', 'warn', `${result.path} drifted from recomputed index — run \`node ${paths.scripts}/skill-registry.mjs\` or \`${doctorCmd} --fix\``);
    } else {
      check('skills:registry', 'ok', `${result.path} matches recomputed index`);
    }
  }
}

// Project rules are user-owned overlays. Their content is not written into the vendor registry, but
// it must remain structurally checkable and is folded into adapter drift via computeAdapters().
{
  const baseRulesDir = join(ROOT, paths.engine, 'rules');
  const projectRulesCandidate = paths.rules ? join(ROOT, paths.rules) : null;
  const projectRulesDir = projectRulesCandidate && resolve(projectRulesCandidate) !== resolve(baseRulesDir)
    ? projectRulesCandidate
    : null;
  const baseNames = existsSync(baseRulesDir)
    ? readdirSync(baseRulesDir).filter((name) => name.endsWith('.md'))
    : [];
  const projectNames = projectRulesDir && existsSync(projectRulesDir)
    ? readdirSync(projectRulesDir).filter((name) => name.endsWith('.md'))
    : [];
  const invalidProjectRules = projectNames.filter((name) => {
    // Strip UTF-8 BOM — common in Windows-authored stack rules and breaks `^#` title detection.
    const raw = readFileSync(join(projectRulesDir, name), 'utf8').replace(/^\uFEFF/, '');
    return !/^#\s+\S/m.test(raw) || !/\*\*CHECK:\*\*/.test(raw);
  });
  check(
    'rules:combined',
    invalidProjectRules.length ? 'warn' : 'ok',
    invalidProjectRules.length
      ? `project rules missing title or CHECK: ${invalidProjectRules.join(', ')}`
      : `${baseNames.length} base + ${projectNames.length} project overlay(s)`,
  );
}

console.log('\nmidas doctor — health');
for (const h of health) console.log(`  ${h.status.padEnd(4)} ${h.name}${h.note ? ' — ' + h.note : ''}`);

if (drift) {
  console.log('\nAdapters OUT OF SYNC. Run `' + doctorCmd + ' --fix` (or `/midas-doctor`).');
  process.exit(1);
}
/** Names that never block under --profile=install-verify (still warn in the health table). */
const INSTALL_VERIFY_WARN_ONLY = new Set([
  'rules:combined',
  'mcp:governance',
  'mcp:declared-vs-wired',
  'mcp:cursor-sync',
  'mcp:template-sync',
]);

function isStrictBlockingName(name) {
  if (GATES_ONLY) return name.startsWith('gate:');
  const core =
    name === 'version' ||
    name === 'routing' ||
    name.startsWith('state:') ||
    name.startsWith('layout:') ||
    name.startsWith('file:') ||
    name.startsWith('manifest:') ||
    name.startsWith('mirror:') ||
    name.startsWith('gate:') ||
    name === 'gates:registry' ||
    name === 'stage-table' ||
    name === 'design-system:tokens' ||
    name === 'checks:index' ||
    name === 'skills:registry' ||
    name === 'rules:combined' ||
    name === 'skills:frontmatter' ||
    name === 'gitignore:midas-block' ||
    name === 'mcp:secret-free' ||
    name === 'mcp:governance' ||
    name === 'mcp:declared-vs-wired' ||
    name === 'mcp:skill-required' ||
    name === 'mcp:cursor-sync' ||
    name === 'mcp:template-sync';
  if (!core) return false;
  if (STRICT_PROFILE === 'install-verify' && INSTALL_VERIFY_WARN_ONLY.has(name)) return false;
  return true;
}

const strictBlocking = health.filter((h) => h.status === 'warn' && isStrictBlockingName(h.name));
if (STRICT && strictBlocking.length) {
  const profileNote = STRICT_PROFILE === 'install-verify' ? ' (profile=install-verify)' : '';
  console.log(`\nSTRICT${profileNote}: ${strictBlocking.length} deterministic health check(s) failed: ${strictBlocking.map((h) => h.name).join(', ')}`);
  process.exit(1);
}
const tail = GATES_ONLY ? 'Gate checks complete.' : 'Adapters in sync.';
console.log(`\n${tail}` + (health.some((h) => h.status === 'warn') ? ' (review health warnings above)' : ''));
process.exit(0);
