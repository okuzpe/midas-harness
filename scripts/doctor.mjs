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

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAdapters, renderAdapters } from './render-adapters.mjs';
import { parseRouting, rewriteRoutingMap } from './yaml-lite.mjs';
import { syncCursorMcp } from './mcp-cursor-sync.mjs';
import { ensureMidasGitignore } from './gitignore-merge.mjs';
import { resolvePaths, resolveProjectRootFromScript } from './paths.mjs';
import { renderStageCommandTable } from './stage-command-table.mjs';
import { renderDesignSystemTokens } from './design-system.mjs';
import {
  normalizeRoutingProfile,
  normalizeCostProfile,
  resolveCostAwareRouting,
} from './model-profiles.mjs';
import { readOwnershipManifest, sha256File } from './ownership-manifest.mjs';
import { isStrictBlockingName, INSTALL_VERIFY_WARN_ONLY } from './doctor/profiles.mjs';
import { createDoctorHelpers } from './doctor/helpers.mjs';
import { runHealthChecks } from './doctor/registry.mjs';
export { INSTALL_VERIFY_WARN_ONLY };

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
      reduced blocking set for create-midas verify (kit integrity only; omits rules:combined,
      mcp governance/sync, and product sprint lifecycle such as close-ready / diff-receipts)
  node scripts/doctor.mjs --gates-only  skip adapter drift check
  node scripts/doctor.mjs --help    show this help

Profiles (with --strict):
  full             default for humans / midas-doctor — all deterministic warns block
  install-verify   installer post-apply — layout/version/routing/manifest/mirrors/adapters/secrets;
                   rules:combined, mcp governance/sync, and product sprint gates (close-ready,
                   diff-receipts, records, phase-artifacts) stay warn-only
  update-preflight before an update writes — only layout:consistent (broken tree);
                   leftover .harness/conflicts/ warn but do not block`;

const FIX = process.argv.includes('--fix');
const STRICT = process.argv.includes('--strict');
const GATES_ONLY = process.argv.includes('--gates-only');
const SHOW_HELP = process.argv.includes('--help') || process.argv.includes('-h');
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
const STRICT_PROFILE = (profileArg ? profileArg.slice('--profile='.length) : 'full').trim() || 'full';
// Optional positional project root: check THAT project instead of the engine repo. Lets `--strict` run
// against a real install (or scripts/fixtures/product-closed) so the gate-records check is provably exercised.
// Adapter drift before an update is expected — re-rendering them is part of what the update does —
// so the preflight profile reports drift without letting it block.
const PREFLIGHT = STRICT_PROFILE === 'update-preflight';
const SKIP_ADAPTER_DRIFT = GATES_ONLY || PREFLIGHT;
const rootArg = process.argv.slice(2).find((a) => !a.startsWith('-') && !a.startsWith('--'));
const ROOT = rootArg ? resolve(process.cwd(), rootArg) : resolveProjectRootFromScript(import.meta.url);
const paths = resolvePaths(ROOT);
const doctorCmd = `node ${paths.scripts}/doctor.mjs`;
const updateCheckCmd = 'npx github:okuzpe/midas-harness update --check';

if (SHOW_HELP) {
  console.log(HELP);
  process.exit(0);
}

const helpers = createDoctorHelpers(ROOT, paths);
const { read } = helpers;

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

// --- --fix: rewrite adapters via the shared render path ----------------------------------------
const ENGINE_VERSION = (read(paths.version) || '').trim();
if (FIX) {
  if (!existsSync(join(ROOT, paths.engine, 'conventions.md'))) {
    console.error(`midas doctor --fix: ${paths.engine}/conventions.md missing — cannot render adapters.`);
    process.exit(1);
  }
  const { hash, results } = renderAdapters(ROOT);
  const stageTable = paths.role === 'product' ? null : renderStageCommandTable(ROOT);
  const designSystem = paths.role === 'product' ? null : renderDesignSystemTokens(ROOT);
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
  // Product installs (role: product): rewrite `.claude/agents` and engine agent copies together.
  // Engine repo: rewrite state.routing when mismatched; never rewrite harness/agents
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
        if (paths.role === 'product') {
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
if (!SKIP_ADAPTER_DRIFT) {
  console.log('midas doctor — adapters');
  for (const f of computeAdapters(ROOT).files) {
    const onDisk = read(f.path);
    if (onDisk === null) { drift = true; console.log(`  MISSING  ${f.path}`); }
    else if (onDisk !== f.content) { drift = true; console.log(`  DRIFT    ${f.path}`); }
    else console.log(`  ok       ${f.path}`);
  }
} else {
  console.log(`midas doctor — adapters (skipped: ${GATES_ONLY ? '--gates-only' : 'profile=update-preflight'})`);
}

const health = [];
await runHealthChecks({
  ROOT,
  paths,
  VERSION: ENGINE_VERSION,
  doctorCmd,
  updateCheckCmd,
  pluginHelpers,
  health,
});

console.log('\nmidas doctor — health');
for (const h of health) console.log(`  ${h.status.padEnd(4)} ${h.name}${h.note ? ' — ' + h.note : ''}`);

if (drift) {
  console.log('\nAdapters OUT OF SYNC. Run `' + doctorCmd + ' --fix` (or `/midas-doctor`).');
  process.exit(1);
}

const strictBlocking = health.filter((h) => h.status === 'warn' && isStrictBlockingName(h.name, {
  preflight: PREFLIGHT,
  gatesOnly: GATES_ONLY,
  profile: STRICT_PROFILE,
}));
if (STRICT && strictBlocking.length) {
  const profileNote = STRICT_PROFILE === 'full' ? '' : ` (profile=${STRICT_PROFILE})`;
  console.log(`\nSTRICT${profileNote}: ${strictBlocking.length} deterministic health check(s) failed: ${strictBlocking.map((h) => h.name).join(', ')}`);
  process.exit(1);
}
const tail = SKIP_ADAPTER_DRIFT
  ? (GATES_ONLY ? 'Gate checks complete.' : 'Update preflight clear.')
  : 'Adapters in sync.';
console.log(`\n${tail}` + (health.some((h) => h.status === 'warn') ? ' (review health warnings above)' : ''));
process.exit(0);
