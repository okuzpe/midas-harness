#!/usr/bin/env node
// bundle.mjs — export/import Midas project knowledge as portable JSON (dependency-free).
//
//   node scripts/bundle.mjs export [--profile full] [-o out.json] [--only a,b] [--include-tests] [--include-src]
//   node scripts/bundle.mjs import bundle.json [--dry-run] [--merge|--replace] [--replace-state]
//
// Paths in bundles use classic canonical coordinates (harness/, .harness/). Import remaps for compact.

import {
  createHash,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATION_MAP, resolvePaths } from './paths.mjs';
import {
  parseEnforcement,
  parseMidasVersion,
  parseSprints,
  stripQuotes,
} from './yaml-lite.mjs';

export const MIDAS_BUNDLE_VERSION = '1';

import { loadEngineBaseRules, stageRecallPaths } from './stage-command-table.mjs';

/** Always-on engine rules — derived from create-midas/template harness/rules/. */
export const ENGINE_BASE_RULES = loadEngineBaseRules();

const LOCKFILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
]);

const MCP_SECRET_RE = /(authorization|token|api[_-]?key|secret|password)"\s*:\s*"([^"]+)"/gi;

const KNOWLEDGE_FILES = [
  'product/idea.md',
  'product/market.md',
  'product/business-plan.md',
  'product/architecture.md',
  'product/open-questions.md',
  'product/roadmap.md',
  'product/conventions.md',
  'product/design-system.md',
  'product/design-direction.md',
  'product/inventory.md',
  'product/debt.md',
  'product/features.json',
  'product/package.json',
  'product/design-system/tokens.json',
  'product/design-system/tokens.css',
];


const FROZEN_RUNS = ['audits', 'verifications', 'debates', 'sprints', 'sweeps'];

const TEST_GLOB_RE = /\.(test|spec)\.(tsx?|jsx?|mjs|cjs|vue|svelte)$/;
const TEST_CONFIG_RE = /^(vitest|jest|playwright)\.config\.(tsx?|js|mjs|cjs)$/;

/** @type {Set<string>} */
export const VALID_PROFILES = new Set([
  'config', 'knowledge', 'memory', 'evidence', 'tests', 'recall', 'full',
]);

/** Optional warn-only scan for committed secrets in bundle content (not .mcp.json). */
const CONTENT_SECRET_RE = /(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY)/;

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

function posix(p) {
  return p.replace(/\\/g, '/');
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** @param {string} rel repo-relative */
export function toCanonical(rel, layout) {
  const p = posix(rel);
  if (layout !== 'compact') return p;
  const fileMaps = MIGRATION_MAP.filter((m) => m.type === 'file').sort((a, b) => b.to.length - a.to.length);
  for (const { from, to } of fileMaps) {
    if (p === to) return from;
  }
  const sorted = [...MIGRATION_MAP].sort((a, b) => b.to.length - a.to.length);
  for (const { from, to } of sorted) {
    if (p === to) return from;
    if (p.startsWith(to + '/')) return from + p.slice(to.length);
  }
  return p;
}

/** @param {string} canonical classic coordinates */
export function fromCanonical(canonical, layout) {
  const p = posix(canonical);
  if (layout !== 'compact') return p;
  const fileMaps = MIGRATION_MAP.filter((m) => m.type === 'file').sort((a, b) => b.from.length - a.from.length);
  for (const { from, to } of fileMaps) {
    if (p === from) return to;
  }
  const sorted = [...MIGRATION_MAP].sort((a, b) => b.from.length - a.from.length);
  for (const { from, to } of sorted) {
    if (p === from) return to;
    if (p.startsWith(from + '/')) return to + p.slice(from.length);
  }
  return p;
}

export function parseStateScalar(yaml, key) {
  const m = yaml.match(new RegExp(`^${key}:\\s*([^#\\n]+)`, 'm'));
  return m ? stripQuotes(m[1].trim()) : null;
}

/** Artifact paths listed under a phase in state.yaml. */
export function parsePhaseArtifacts(yaml, phase) {
  const lines = yaml.split(/\r?\n/);
  let inPhase = false;
  let inArtifacts = false;
  const out = [];
  for (const line of lines) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      inPhase = new RegExp(`^${phase}:`).test(line);
      inArtifacts = false;
      continue;
    }
    if (!inPhase) continue;
    if (/^\s+artifacts:/.test(line)) {
      inArtifacts = true;
      const inline = line.match(/artifacts:\s*\[([^\]]*)\]/);
      if (inline) {
        for (const part of inline[1].split(',')) {
          const s = stripQuotes(part.trim());
          if (s) out.push(s);
        }
        inArtifacts = false;
      }
      continue;
    }
    if (!inArtifacts) continue;
    if (!/^\s+-\s+/.test(line)) {
      inArtifacts = false;
      continue;
    }
    const item = line.replace(/^\s+-\s+/, '').trim();
    out.push(stripQuotes(item));
  }
  return out;
}

export function findActiveSprintId(yaml) {
  const sprints = parseSprints(yaml);
  for (const [id, status] of sprints) {
    if (status === 'active') return id;
  }
  return null;
}

function globExists(root, pattern) {
  const norm = posix(pattern);
  if (norm.includes('*')) {
    const star = norm.indexOf('*');
    const prefix = norm.slice(0, star).replace(/\/$/, '');
    const suffix = norm.slice(star + 1);
    const base = prefix ? join(root, prefix) : root;
    if (!existsSync(base)) return [];
    const hits = [];
    for (const f of walkFiles(base)) {
      const rel = posix(relative(root, f));
      if (!suffix || suffix === '/' || rel.endsWith(suffix) || rel.includes(suffix.replace(/^\//, ''))) {
        hits.push(rel);
      }
    }
    return hits;
  }
  const full = join(root, norm);
  if (!existsSync(full)) return [];
  if (statSync(full).isDirectory()) {
    return walkFiles(full).map((f) => posix(relative(root, f)));
  }
  return [norm];
}

function listUnder(root, relDir) {
  const base = join(root, relDir);
  if (!existsSync(base)) return [];
  return walkFiles(base).map((f) => posix(relative(root, f)));
}

function isExcludedPath(canonical) {
  if (LOCKFILES.has(canonical.split('/').pop())) return true;
  if (canonical.includes('/node_modules/')) return true;
  if (canonical.includes('/cache/')) return true;
  if (canonical.endsWith('.hash')) return true;
  return false;
}

export function collectProjectRulePaths(stateYaml, root, layout) {
  const artifacts = parsePhaseArtifacts(stateYaml, 'architecture_rules');
  const ruleArtifacts = artifacts.filter((a) => a.includes('/rules/') || a.startsWith('harness/rules/'));
  const paths = new Set();
  for (const a of ruleArtifacts) {
    const canon = toCanonical(a, layout);
    if (existsSync(join(root, fromCanonical(canon, layout)))) paths.add(canon);
  }
  const rulesDir = fromCanonical('harness/rules', layout);
  const absRules = join(root, rulesDir);
  if (existsSync(absRules)) {
    for (const f of walkFiles(absRules)) {
      const base = posix(relative(absRules, f));
      if (ENGINE_BASE_RULES.has(base)) continue;
      paths.add(toCanonical(join(rulesDir, base), layout));
    }
  }
  return [...paths];
}

export function collectEnforcementPaths(stateYaml, root, layout) {
  const out = new Set();
  for (const e of parseEnforcement(stateYaml)) {
    if (!e.config) continue;
    const canon = toCanonical(e.config, layout);
    if (existsSync(join(root, fromCanonical(canon, layout)))) out.add(canon);
  }
  return [...out];
}

export function collectRecallPaths(stateYaml, root, layout) {
  const paths = new Set();
  const stateCanon = 'harness/state.yaml';
  paths.add(stateCanon);

  const activeId = findActiveSprintId(stateYaml);
  if (activeId) {
    for (const f of listUnder(root, 'product/sprints')) {
      const base = f.split('/').pop() || '';
      if (base.startsWith(`${activeId}-`) || base.startsWith(`${activeId.padStart(2, '0')}-`)) {
        paths.add(toCanonical(f, layout));
      }
    }
    const progressCanon = `.harness/sprints/${activeId}-progress.md`;
    if (existsSync(join(root, fromCanonical(progressCanon, layout)))) paths.add(progressCanon);
  }

  const stage = parseStateScalar(stateYaml, 'stage') || 'idea_intake';
  for (const p of stageRecallPaths(stage)) {
    const canon = toCanonical(p, layout);
    if (existsSync(join(root, fromCanonical(canon, layout)))) paths.add(canon);
  }
  if (stage === 'tech_architecture' || stage === 'architecture_rules') {
    for (const f of listUnder(root, fromCanonical('product/adr', layout))) {
      paths.add(toCanonical(f, layout));
    }
  }
  if (stage === 'sprint_execution') {
    for (const f of listUnder(root, 'product/playbooks')) paths.add(toCanonical(f, layout));
    for (const r of collectProjectRulePaths(stateYaml, root, layout)) paths.add(r);
  }
  const mode = parseStateScalar(stateYaml, 'mode');
  if (mode === 'brownfield') {
    for (const p of ['product/inventory.md', 'product/debt.md']) {
      const canon = toCanonical(p, layout);
      if (existsSync(join(root, fromCanonical(canon, layout)))) paths.add(canon);
    }
    const sweeps = listUnder(root, fromCanonical('.harness/sweeps', layout));
    if (sweeps.length) paths.add(toCanonical(sweeps.sort().pop(), layout));
  }
  return [...paths].slice(0, 15);
}

function collectTestPaths(root, layout) {
  const out = new Set();
  const productRoot = join(root, 'product');
  if (!existsSync(productRoot)) return [];
  for (const f of walkFiles(productRoot)) {
    const rel = posix(relative(root, f));
    const canon = toCanonical(rel, layout);
    const base = canon.split('/').pop();
    if (TEST_GLOB_RE.test(base) || TEST_CONFIG_RE.test(base)) out.add(canon);
  }
  return [...out];
}

export function resolveExportPaths(root, opts) {
  const paths = resolvePaths(root);
  const layout = paths.layout;
  const statePath = paths.state;
  const stateYaml = existsSync(join(root, statePath)) ? readFileSync(join(root, statePath), 'utf8') : '';
  const profile = opts.profile || 'full';
  const includeTests = opts.includeTests || profile === 'tests';
  const includeSrc = opts.includeSrc;
  const only = opts.only;

  if (!only?.length && !VALID_PROFILES.has(profile)) {
    throw new Error(`unknown profile "${profile}" — valid: ${[...VALID_PROFILES].join(', ')}`);
  }

  let candidates = new Set();

  const add = (canon) => {
    if (!canon || isExcludedPath(canon)) return;
    const base = canon.split('/').pop() || '';
    const isTest = TEST_GLOB_RE.test(base) || TEST_CONFIG_RE.test(base);
    if (canon.startsWith('product/src/') && !includeSrc && !isTest) return;
    candidates.add(canon);
  };

  if (only?.length) {
    for (const item of only) {
      const trimmed = item.trim();
      if (trimmed.includes('*')) {
        for (const h of globExists(root, trimmed)) add(toCanonical(h, layout));
      } else {
        const canon = toCanonical(trimmed, layout);
        const disk = fromCanonical(canon, layout);
        const abs = join(root, disk);
        if (!existsSync(abs)) continue;
        if (statSync(abs).isDirectory()) {
          for (const f of listUnder(root, disk)) add(toCanonical(f, layout));
        } else {
          add(canon);
        }
      }
    }
  } else {
    const wantsConfig = ['config', 'full'].includes(profile);
    const wantsKnowledge = ['knowledge', 'memory', 'evidence', 'tests', 'full', 'recall'].includes(profile);
    const wantsMemory = ['memory', 'evidence', 'tests', 'full'].includes(profile);
    const wantsEvidence = ['evidence', 'tests', 'full'].includes(profile);

    if (profile === 'recall') {
      for (const p of collectRecallPaths(stateYaml, root, layout)) add(p);
    } else {
      if (wantsConfig || wantsMemory || wantsEvidence) add('harness/state.yaml');
      if (wantsConfig) {
        add('.mcp.json');
        for (const p of collectEnforcementPaths(stateYaml, root, layout)) add(p);
      }
      if (wantsKnowledge || wantsMemory) {
        for (const p of KNOWLEDGE_FILES) {
          const canon = toCanonical(p, layout);
          if (existsSync(join(root, fromCanonical(canon, layout)))) add(canon);
        }
        for (const f of listUnder(root, 'product/adr')) add(toCanonical(f, layout));
        for (const f of listUnder(root, 'product/playbooks')) add(toCanonical(f, layout));
        for (const f of listUnder(root, 'product/sprints')) add(toCanonical(f, layout));
      }
      if (wantsMemory) {
        for (const p of collectProjectRulePaths(stateYaml, root, layout)) add(p);
        for (const f of listUnder(root, fromCanonical('.harness/sprints', layout))) add(toCanonical(f, layout));
      }
      if (wantsEvidence) {
        for (const sub of FROZEN_RUNS) {
          for (const f of listUnder(root, fromCanonical(`.harness/${sub}`, layout))) add(toCanonical(f, layout));
        }
      }
    }
    if (includeTests) {
      for (const p of collectTestPaths(root, layout)) add(p);
    }
  }

  return {
    paths: resolvePaths(root),
    layout,
    stateYaml,
    statePath,
    files: [...candidates].sort(),
  };
}

export function checkMcpSecrets(mcpText) {
  MCP_SECRET_RE.lastIndex = 0;
  let m;
  while ((m = MCP_SECRET_RE.exec(mcpText)) !== null) {
    const val = m[2];
    if (val && !/^\$\{[A-Z0-9_]+\}$/.test(val)) return true;
  }
  return false;
}

export function exportBundle(root, opts = {}) {
  const { paths, layout, stateYaml, files } = resolveExportPaths(root, opts);
  const mcpPath = join(root, '.mcp.json');
  if (existsSync(mcpPath)) {
    const mcp = readFileSync(mcpPath, 'utf8');
    if (checkMcpSecrets(mcp)) {
      throw new Error('export blocked: .mcp.json contains literal secrets — use ${ENV_VAR} placeholders');
    }
  }

  const bundleFiles = [];
  const skipped = [];
  const contentWarnings = [];
  for (const canon of files) {
    const diskPath = fromCanonical(canon, layout);
    const abs = join(root, diskPath);
    if (!existsSync(abs)) {
      skipped.push({ path: canon, reason: 'missing' });
      continue;
    }
    if (statSync(abs).isDirectory()) continue;
    const content = readFileSync(abs, 'utf8');
    if (canon !== '.mcp.json' && CONTENT_SECRET_RE.test(content)) {
      contentWarnings.push({ path: canon, reason: 'possible secret pattern in content' });
    }
    bundleFiles.push({ path: canon, sha256: sha256(content), content });
  }

  const profile = opts.profile || 'full';
  const includeStateInPayload = bundleFiles.some((f) => f.path === 'harness/state.yaml');

  return {
    midas_bundle_version: MIDAS_BUNDLE_VERSION,
    exported_at: new Date().toISOString().slice(0, 10),
    midas_version: parseMidasVersion(stateYaml) || null,
    profile,
    source: {
      name: parseStateScalar(stateYaml, 'name') || 'unknown',
      layout,
    },
    state_yaml: includeStateInPayload ? stateYaml : null,
    files: bundleFiles,
    skipped,
    content_warnings: contentWarnings.length ? contentWarnings : undefined,
  };
}

export function planImport(root, bundle, opts = {}) {
  const paths = resolvePaths(root);
  const layout = paths.layout;
  const merge = opts.merge === true && !opts.replace;
  const replace = opts.replace === true;
  const replaceState = opts.replaceState === true;
  const dryRun = opts.dryRun === true;

  const actions = [];
  const warnings = [];

  if (bundle.midas_bundle_version !== MIDAS_BUNDLE_VERSION) {
    warnings.push(`bundle version ${bundle.midas_bundle_version} != supported ${MIDAS_BUNDLE_VERSION}`);
  }

  const destVersion = existsSync(join(root, paths.state))
    ? parseMidasVersion(readFileSync(join(root, paths.state), 'utf8'))
    : null;
  if (bundle.midas_version && destVersion && compareSemver(bundle.midas_version, destVersion) > 0) {
    warnings.push(`bundle midas_version ${bundle.midas_version} > dest ${destVersion} — consider /midas-update`);
  }

  if (bundle.state_yaml && replaceState) {
    const destState = fromCanonical('harness/state.yaml', layout);
    const exists = existsSync(join(root, destState));
    const action = exists ? 'replace' : 'create';
    actions.push({ path: destState, canonical: 'harness/state.yaml', action, kind: 'state' });
  } else if (bundle.state_yaml && !replaceState) {
    warnings.push('state_yaml present but --replace-state not set — state unchanged');
  }

  for (const entry of bundle.files || []) {
    if (entry.path === 'harness/state.yaml') continue;
    const dest = fromCanonical(entry.path, layout);
    const abs = join(root, dest);
    const exists = existsSync(abs);
    let action = 'create';
    if (exists && merge) action = 'skip';
    if (exists && replace) action = 'replace';
    if (exists && !merge && !replace) action = 'conflict';
    actions.push({ path: dest, canonical: entry.path, action, kind: 'file', entry });
  }

  return { paths, layout, actions, warnings, dryRun };
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function applyImport(root, bundle, opts = {}) {
  const plan = planImport(root, bundle, opts);
  const written = [];
  const skipped = [];

  if (!opts.dryRun) {
    for (const act of plan.actions) {
      if (act.action === 'skip') {
        skipped.push(act.path);
        continue;
      }
      if (act.action === 'conflict') {
        skipped.push(act.path);
        continue;
      }
      let content;
      if (act.kind === 'state') {
        content = bundle.state_yaml;
      } else {
        content = act.entry.content;
        if (act.entry.sha256 && sha256(content) !== act.entry.sha256) {
          throw new Error(`checksum mismatch for ${act.canonical} — bundle may be corrupt or tampered`);
        }
      }
      const abs = join(root, act.path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, 'utf8');
      written.push(act.path);
    }
  }

  return { ...plan, written, skipped };
}

function printResult(bundle, verb, extra = {}) {
  const files = bundle.files?.length ?? 0;
  const skipped = bundle.skipped?.length ?? 0;
  const warns = extra.contentWarnings ?? bundle.content_warnings?.length ?? 0;
  const verdict = extra.verdict || (warns ? 'warn' : 'ok');
  console.log(
    `MIDAS_BUNDLE_RESULT: verb=${verb} profile=${bundle.profile || '-'} files=${files} skipped=${skipped} secrets=0 warnings=${warns} verdict=${verdict}`,
  );
}

function parseArgs(argv) {
  const out = {
    command: null,
    bundlePath: null,
    profile: 'full',
    output: null,
    only: null,
    includeTests: false,
    includeSrc: false,
    dryRun: false,
    merge: false,
    replace: false,
    replaceState: false,
    root: '.',
  };
  const rest = [...argv];
  out.command = rest.shift();
  if (out.command === 'import') out.bundlePath = rest.shift();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--profile' && rest[i + 1]) { out.profile = rest[++i]; continue; }
    if (a.startsWith('--profile=')) { out.profile = a.slice('--profile='.length); continue; }
    if ((a === '-o' || a === '--output') && rest[i + 1]) { out.output = rest[++i]; continue; }
    if (a.startsWith('--only=')) { out.only = a.slice('--only='.length).split(','); continue; }
    if (a === '--only' && rest[i + 1]) { out.only = rest[++i].split(','); continue; }
    if (a === '--include-tests') { out.includeTests = true; continue; }
    if (a === '--include-src') { out.includeSrc = true; continue; }
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a === '--merge') { out.merge = true; continue; }
    if (a === '--replace') { out.replace = true; continue; }
    if (a === '--replace-state') { out.replaceState = true; continue; }
    if (!a.startsWith('-') && out.command === 'export' && !out.output) out.output = a;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd(), args.root);

  if (args.command === 'export') {
    try {
      const bundle = exportBundle(root, {
        profile: args.profile,
        only: args.only,
        includeTests: args.includeTests,
        includeSrc: args.includeSrc,
      });
      const json = JSON.stringify(bundle, null, 2);
      if (args.output) {
        writeFileSync(resolve(args.output), json, 'utf8');
        console.log(`wrote ${args.output} (${bundle.files.length} files)`);
      } else {
        process.stdout.write(json);
      }
      for (const w of bundle.content_warnings || []) {
        console.warn(`warn: ${w.path} — ${w.reason}`);
      }
      printResult(bundle, 'export');
    } catch (err) {
      console.error(`export failed: ${err.message}`);
      console.log('MIDAS_BUNDLE_RESULT: verb=export files=0 skipped=0 secrets=0 warnings=0 verdict=fail');
      process.exit(1);
    }
    return;
  }

  if (args.command === 'import') {
    if (!args.bundlePath) {
      console.error('usage: node scripts/bundle.mjs import <bundle.json> [--dry-run] [--merge|--replace] [--replace-state]');
      process.exit(1);
    }
    let bundle;
    try {
      bundle = JSON.parse(readFileSync(resolve(args.bundlePath), 'utf8'));
    } catch (err) {
      console.error(`import failed: invalid JSON — ${err.message}`);
      process.exit(1);
    }
    if (bundle.midas_bundle_version !== MIDAS_BUNDLE_VERSION) {
      console.error(`import failed: bundle version ${bundle.midas_bundle_version} != supported ${MIDAS_BUNDLE_VERSION}`);
      process.exit(1);
    }
    let result;
    try {
      result = applyImport(root, bundle, {
        dryRun: args.dryRun,
        merge: args.merge,
        replace: args.replace,
        replaceState: args.replaceState,
      });
    } catch (err) {
      console.error(`import failed: ${err.message}`);
      console.log('MIDAS_BUNDLE_RESULT: verb=import files=0 skipped=0 verdict=fail');
      process.exit(1);
    }
    for (const w of result.warnings) console.warn(`warn: ${w}`);
    for (const act of result.actions) {
      console.log(`${act.action.padEnd(8)} ${act.path}`);
    }
    const verb = args.dryRun ? 'import-dry-run' : 'import';
    console.log(
      `MIDAS_BUNDLE_RESULT: verb=${verb} files=${result.written?.length ?? 0} skipped=${result.skipped?.length ?? 0} verdict=ok`,
    );
    return;
  }

  console.error(`usage:
  node scripts/bundle.mjs export [--profile full|config|knowledge|memory|evidence|tests|recall] [-o out.json]
  node scripts/bundle.mjs import <bundle.json> [--dry-run] [--merge|--replace] [--replace-state]`);
  process.exit(1);
}

const isMain = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) main();
