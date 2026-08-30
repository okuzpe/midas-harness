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
import { detectLayout, detectRole, isV1Install, resolvePaths, MIGRATION_MAP, MIGRATION_MAP_HUB, RUNS_SUBDIRS, hubPathsYaml, resolveProjectRootFromScript } from '../paths.mjs';
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
// --- K. BEHAVIORAL: the out-of-model gate check actually FIRES (and doesn't cry wolf) -----------
// Runs the real doctor against two planted fixtures: one where a `done` sprint carries unresolved CRITs
// (must warn) and one that is clean (must stay quiet). This is the first test that proves a guardrail
// *works*, not just that files parse.

if (existsSync(join(ROOT, 'scripts', 'fixtures', 'inconsistent-audit'))) {
  const bad = doctorOutput('scripts/fixtures/inconsistent-audit');
  check('behavioral:gate-fires', /warn\s+gate:audit-01/.test(bad), 'doctor did not warn gate:audit-01 on a closed sprint with an unresolved/blocked record');
  const good = doctorOutput('scripts/fixtures/consistent-audit');
  check('behavioral:gate-no-false-positive', !/warn\s+gate:audit/.test(good), 'doctor warned gate:audit on a CONSISTENT record (false positive)');
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
check(
  'behavioral:product-closed-strict-gates',
  doctorExit('scripts/fixtures/product-closed', '--strict --gates-only') === 0,
  'product-closed gate records must be consistent with state.yaml',
);


// --- M. CI workflows carry the hardened supply-chain policy -------------------------------
const workflowDir = join(ROOT, '.github', 'workflows');
{
  const releasePrep = join(workflowDir, 'release-prep.yml');
  if (existsSync(releasePrep)) {
    const text = readFileSync(releasePrep, 'utf8');
    check(
      'workflow:release-prep:changelog-from-version',
      /harness\/VERSION/.test(text) && !/## \\\[1\\\.1\\\.3\\\]/.test(text) && !/1\\.1\\.3/.test(text),
      'release-prep must derive CHANGELOG section from harness/VERSION',
    );
    check(
      'workflow:release-prep:installs-mkdocs',
      /pip install mkdocs-material==9\.7\.6/.test(text) && /setup-python@/.test(text),
      'release-prep must install MkDocs before mkdocs build --strict',
    );
  }
}
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
for (const f of ['.mcp.json', 'cli/template/.mcp.json', 'harness/plugins/midas/.mcp.json']) {
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
  const governance = evaluateMcpGovernance(text);
  check(`mcp:${f}:governed`, governance.status === 'ok', governance.note);
}
if (existsSync(join(ROOT, '.mcp.json')) && existsSync(join(ROOT, 'harness', 'plugins', 'midas', '.mcp.json'))) {
  check(
    'mcp:plugin-matches-root',
    readFileSync(join(ROOT, '.mcp.json'), 'utf8') === readFileSync(join(ROOT, 'harness', 'plugins', 'midas', '.mcp.json'), 'utf8'),
    're-run build-plugin.mjs',
  );
}
const installer = readFileSync(join(ROOT, 'cli', 'index.mjs'), 'utf8');
const installerExecuteSrc = readFileSync(join(ROOT, 'cli', 'lib', 'runtime', 'execute.mjs'), 'utf8');
const installerRenderPhaseSrc = readFileSync(join(ROOT, 'cli', 'lib', 'runtime', 'phases', 'render-adapters.mjs'), 'utf8');
const installerPlanTreeSrc = readFileSync(join(ROOT, 'cli', 'lib', 'steps', 'plan-tree.mjs'), 'utf8');
const installerPreserveSrc = readFileSync(join(ROOT, 'cli', 'lib', 'core', 'preserve-policy.mjs'), 'utf8');
const installerWalkTemplateSrc = readFileSync(join(ROOT, 'cli', 'lib', 'core', 'walk-template.mjs'), 'utf8');
check(
  'mcp:installer-wraps-npx-on-windows',
  /mcp-cursor-sync\.mjs/.test(installerRenderPhaseSrc) && /syncCursorMcp/.test(installerRenderPhaseSrc),
);
check(
  'mcp:installer-preserves-user-config',
  /\.mcp\.json/.test(installerPreserveSrc) && /decideTemplateCopyAction/.test(installerPreserveSrc) &&
    /decideTemplateCopyAction/.test(installerPlanTreeSrc) && /copy-tree\.mjs/.test(installerExecuteSrc),
  '.mcp.json must remain user-owned on update (preserve-policy + plan-tree + copy-tree)',
);
check(
  'copy-tree:skips-host-discovery-mirrors',
  /isHostDiscoveryMirrorPath/.test(installerWalkTemplateSrc) &&
    /walkTemplate/.test(installerPlanTreeSrc),
);
check(
  'installer:ensures-user-layout-dirs',
  /function ensureUserLayoutDirs/.test(installerExecuteSrc) &&
    /ensureUserLayoutDirs\(session\.paths\)/.test(
      readFileSync(join(ROOT, 'cli', 'lib', 'runtime', 'phases', 'write-state.mjs'), 'utf8'),
    ),
);

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
  const { diagnoseProject } = await import(pathToFileURL(join(ROOT, 'cli', 'install-diagnose.mjs')).href);
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
  check('diagnose:not-installed-slash', r1.nextSlash === '/midas-init');
  rmSync(tmp, { recursive: true, force: true });
}
{
  const tmp = mkdtempSync(join(tmpdir(), 'midas-diag-cli-'));
  const r = spawnSync('node', [join(ROOT, 'cli', 'index.mjs'), '--diagnose', tmp], {
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
  const r = spawnSync('node', [join(ROOT, 'cli', 'index.mjs'), '--diagnose', tmp], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  check(
    'diagnose:missing-path-is-read-only',
    r.status === 1 && /Status: not_installed/.test(r.stdout || '') && !existsSync(tmp),
    r.stderr || r.stdout || `exit ${r.status}`,
  );
}
{
  const pcOut = doctorOutput('scripts/fixtures/product-closed');
  check(
    'behavioral:mcp-drift-product-closed',
    /ok\s+mcp:declared-vs-wired/.test(pcOut),
    'product-closed .mcp.json should satisfy declared MCPs',
  );
  const pcGi = auditGitignore(PRODUCT_CLOSED);
  check('product-closed:gitignore-audit', pcGi.status === 'ok', pcGi.note);
}

}
