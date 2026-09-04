import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, cpSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve, extname, basename, relative } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { computeAdapters, computeChecksIndex, computeGatesIndex, DEFAULT_ADAPTER_TOOLS, resolveAdapterTools } from '../render-adapters.mjs';
import {
  checkSkillRegistry,
  collectSkillRegistryRows,
  computeSkillRegistryMarkdown,
  writeSkillRegistry,
  isHostMirrorExcluded,
  INTERNAL_SURFACE_ALLOWLIST,
  DEPRECATED_SURFACE_ALLOWLIST,
} from '../skill-registry.mjs';
import { evaluateMcpDeclaredVsWired, evaluateMcpGovernance, evaluateSkillMcpRequired, OPTIONAL_MCP_IDS } from '../mcp-drift.mjs';
import { ensureMidasGitignore, GITIGNORE_BEGIN, GITIGNORE_END, auditGitignore } from '../gitignore-merge.mjs';
import { detectLayout, detectRole, isV1Install, resolvePaths, RUNS_SUBDIRS, resolveProjectRootFromScript } from '../paths.mjs';
import { exportBundle, applyImport, checkMcpSecrets, ENGINE_BASE_RULES, toCanonical, fromCanonical, planImport } from '../bundle.mjs';
import { loadStageCommandTable, stageRecallPaths, loadEngineBaseRules, computeStageCommandTableYaml, resolveStatusNext, LITE_FRONT_STAGES, LITE_FORBIDDEN_NEXT } from '../stage-command-table.mjs';
import { computeDesignSystemCss } from '../design-system.mjs';
import { computePluginManifest, computePluginReadme, computeMarketplaceJson } from '../build-plugin.mjs';
import { resolveRefreshCommand } from '../../cli/lib/workflow/engine.mjs';
import {
  isKnownRoutingProfile,
  isKnownCostProfile,
  normalizeRoutingProfile,
  normalizeCostProfile,
  resolveRoutingModels,
  resolveCostAwareRouting,
  MAX_SAVINGS_ORCHESTRATE_ESCALATE_STAGES,
} from '../model-profiles.mjs';
import { rewriteRoutingMap } from '../yaml-lite.mjs';
import { scriptBundleFiles, shippedScriptSourcePath } from '../ship-manifest.mjs';
import {
  roleForPath,
  findVendorConflicts,
  findGeneratedMirrorConflicts,
  computeOwnershipManifest,
  writeOwnershipManifest,
  readOwnershipManifest,
  treeSha256,
  sha256File,
  bundledVendorPaths,
  MANIFEST_SCHEMA_VERSION,
} from '../ownership-manifest.mjs';
import { scanVendorTree } from '../lib/reconcile.mjs';
import {
  applyStrictWarns,
  collectReports,
  inspectArtifact,
  parseCanonicalArtifactPath,
  parseFrontmatter,
  readCatalogText,
  stepsMarkdownLinkCount,
  summarizeReports,
} from '../skill-quality-check.mjs';
import { ENGINE_ONLY_SKILLS, HARNESS_ENGINE_ONLY_RELS } from '../engine-only.mjs';
import { resetSandbox, inspectSandboxEnv, isPathInside, gradeSandbox, parseGradeArgs } from '../sandbox-run.mjs';
import { splitSkillDocument } from '../lib/frontmatter.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { missingEvidenceRequired, resolveEvidencePattern } from '../lib/gate-evidence.mjs';
import { UNIT_TEST_FILES } from '../lib/unit-test-files.mjs';
import {
  ROOT,
  PRODUCT_CLOSED,
  TEST_FAST,
  MODELS,
  RITUAL_GUARD,
  RITUAL_CITE,
  skillsDir,
  agentsDir,
  check,
  isHarnessEngineOnlyRel,
  walk,
  walkRelativeFiles,
  treeDigest,
  parsePortableSkill,
  normalizePortableScalar,
  dirNames,
  gitTrackedRelpaths,
  ver,
  agentModelT,
  doctorOutput,
  doctorExit,
  installer,
  engineVersion,
  snippetPath,
} from './harness.mjs';

export async function run() {
// --- F3. product-closed cited test paths exist on disk ---------------------------------------
const productClosedProduct = join(PRODUCT_CLOSED, '.harness', 'product');
check(
  'product-closed:cited-test:route',
  existsSync(join(productClosedProduct, 'src/app/api/tasks/route.test.ts')),
);

const stateFile = join(PRODUCT_CLOSED, '.harness', 'state.yaml');
if (existsSync(stateFile)) {
  const s = readFileSync(stateFile, 'utf8');
  for (const key of ['midas_version', 'stage', 'cost_profile', 'routing', 'phases', 'sprints']) {
    check(`state:${key}`, new RegExp(`(^|\\n)${key}:`).test(s));
  }
}

// --- F2. routing map reconciles with cost-aware resolver + first-party agent pins --------------
// Under the Claude profile, state.routing and agent pins must equal resolveCostAwareRouting(...).

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
  const expected = resolveCostAwareRouting('claude', profile || 'balanced');
  for (const t of ['orchestrate', 'build', 'scout']) {
    check(`routing:example-matches-cost-aware:${t}`, !!routing[t] && routing[t] === expected[t], `state ${routing[t]} != expected ${expected[t]}`);
    check(`routing:example-agent-pin:${t}`, !!pins[t] && pins[t] === expected[t], `agent ${pins[t]} != expected ${expected[t]}`);
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
  check(
    'root-pkg:single-npx-bin',
    Object.keys(pkg.bin || {}).length === 1 && pkg.bin?.midas === 'cli/index.mjs',
    'multiple root bins break `npx github:…` on npm 11+',
  );
  for (const b of bins) check(`root-bin-exists:${b}`, existsSync(join(ROOT, b)));
}

// --- report ------------------------------------------------------------------------------------
// --- I. engine version single-sourced at harness/VERSION, mirrored everywhere ------------------

const engineVersion = ver('harness/VERSION', false);
check('version:harness/VERSION-present', !!engineVersion, 'missing harness/VERSION');
if (engineVersion) {
  for (const f of ['package.json', 'cli/package.json', 'gemini-extension.json']) {
    const v = ver(f, true);
    check(`version:${f}`, v === engineVersion, `${v} != ${engineVersion}`);
  }
}
{
  const createMidasPkg = join(ROOT, 'cli', 'package.json');
  if (existsSync(createMidasPkg)) {
    try {
      const pkg = JSON.parse(readFileSync(createMidasPkg, 'utf8'));
      check('create-midas:pkg:bin', pkg.bin?.['create-midas'] === 'index.mjs', `bin=${pkg.bin?.['create-midas']}`);
      check('create-midas:pkg:type', pkg.type === 'module', `type=${pkg.type}`);
      check(
        'create-midas:pkg:files',
        JSON.stringify(pkg.files || []) === JSON.stringify(['index.mjs', 'install-diagnose.mjs', 'lib', 'template']),
        `files=${JSON.stringify(pkg.files || [])}`,
      );
      check('create-midas:pkg:engine-floor', pkg.engines?.node === '>=22', `node=${pkg.engines?.node}`);
      check('create-midas:pkg:homepage', pkg.homepage === 'https://github.com/okuzpe/midas-harness#readme', `homepage=${pkg.homepage}`);
      check('create-midas:pkg:repository-url', pkg.repository?.url === 'git+https://github.com/okuzpe/midas-harness.git', `repository.url=${pkg.repository?.url}`);
      check('create-midas:pkg:repository-dir', pkg.repository?.directory === 'cli', `repository.directory=${pkg.repository?.directory}`);
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
    ['scripts/fixtures/product-closed/.harness/state.yaml', /^midas_version:\s*([0-9][^\s#]*)/m],
    ['scripts/fixtures/product-lite/.harness/state.yaml', /^midas_version:\s*([0-9][^\s#]*)/m],
  ]) {
    const p = join(ROOT, f);
    if (existsSync(p)) {
      const m = readFileSync(p, 'utf8').match(re);
      check(`version:${f}`, !!m && m[1] === engineVersion, m ? `${m[1]} != ${engineVersion}` : 'no midas_version');
    }
  }
}

// --- I1. install-cmd helpers (canonical npx strings) ------------------------------------------
{
  const { formatInstallCmd, formatUpdateCmd, formatUpdateCmdFromRelease, formatShortUpdateCmd, npxPackageRef } = await import('../lib/install-cmd.mjs');
  check('install-cmd:package-ref', npxPackageRef(engineVersion || '0.0.0') === `github:okuzpe/midas-harness#v${engineVersion || '0.0.0'}`);
  if (engineVersion) {
    check(
      'install-cmd:install',
      formatInstallCmd({ version: engineVersion, tools: 'cursor' }) === `npx github:okuzpe/midas-harness#v${engineVersion} --tools=cursor`,
    );
    check(
      'install-cmd:update',
      formatUpdateCmd({ version: engineVersion }) === `npx github:okuzpe/midas-harness#v${engineVersion} update`,
    );
  }
  check(
    'install-cmd:update-edge',
    formatUpdateCmd({ channel: 'edge', commit: 'deadbeefcafebabe' }) ===
      'npx github:okuzpe/midas-harness#deadbeefcafebabe update --channel=edge',
  );
  check(
    'install-cmd:short-update',
    formatShortUpdateCmd({ flags: '--resume' }) === 'midas update --resume',
  );
  check(
    'install-cmd:update-from-edge-release',
    formatUpdateCmdFromRelease({ channel: 'edge', commit: 'abc1234', version: '2.9.9' }) ===
      'npx github:okuzpe/midas-harness#abc1234 update --channel=edge',
  );
  check(
    'install-cmd:shipped',
    existsSync(join(ROOT, 'cli', 'lib', 'core', 'install-cmd.mjs')) &&
      existsSync(join(ROOT, 'scripts', 'lib', 'install-cmd.mjs')),
  );
  check(
    'install-cmd:no-format-migrate',
    !/function formatMigrateCmd/.test(
      readFileSync(join(ROOT, 'cli', 'lib', 'core', 'install-cmd.mjs'), 'utf8'),
    ),
  );
  check(
    'install-diagnose:no-related-cli',
    !/function relatedCli/.test(readFileSync(join(ROOT, 'cli', 'install-diagnose.mjs'), 'utf8')),
  );
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

}
