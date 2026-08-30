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
import { detectLayout, detectRole, isV1Install, resolvePaths, RUNS_SUBDIRS, harnessPathsYaml, resolveProjectRootFromScript } from '../paths.mjs';
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
  snippetPath,
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
} from './harness.mjs';

export async function run() {
// --- M. role resolver (ADR-017) --------------------------------------------------------------
check('paths:module-exists', existsSync(join(ROOT, 'scripts', 'paths.mjs')));
{
  const engine = resolvePaths(ROOT);
  check('paths:engine-role', engine.role === 'engine');
  check('paths:engine-engine', engine.engine === 'harness');
  check('paths:engine-state', engine.state === 'harness/state.yaml');
  check('paths:engine-runs', engine.runs === 'runs');
  check('paths:engine-product', engine.product === 'docs/product');
  check('paths:runs-subdirs', RUNS_SUBDIRS.includes('sprints') && RUNS_SUBDIRS.includes('sweeps') && RUNS_SUBDIRS.includes('lean') && RUNS_SUBDIRS.includes('retros') && RUNS_SUBDIRS.includes('investigate') && RUNS_SUBDIRS.includes('auto-pilot'));
  check('paths:harness-yaml-product', harnessPathsYaml().product === '.harness/product');
  check('paths:no-migration-map-export', !Object.hasOwn(await import('../paths.mjs'), 'MIGRATION_MAP'));
  check('paths:detect-role-engine', detectRole(ROOT) === 'engine');
  check('paths:detect-layout-engine-alias', detectLayout(ROOT) === 'classic');
}
{
  const productRoot = mkdtempSync(join(tmpdir(), 'midas-product-role-'));
  try {
    mkdirSync(join(productRoot, '.harness', 'engine'), { recursive: true });
    writeFileSync(join(productRoot, '.harness', 'state.yaml'), 'midas_version: 3.0.0\nrole: product\nlayout: harness\n', 'utf8');
    check('paths:detect-role-product', detectRole(productRoot) === 'product');
    check('paths:detect-layout-product-alias', detectLayout(productRoot) === 'harness');
    const pp = resolvePaths(productRoot);
    check('paths:product-engine', pp.engine === '.harness/engine');
    check('paths:product-runs', pp.runs === '.harness/runs');
    check('paths:product-runs-audits', pp.runsPath('audits') === '.harness/runs/audits');
  } finally {
    rmSync(productRoot, { recursive: true, force: true });
  }
}
{
  const v1Root = mkdtempSync(join(tmpdir(), 'midas-v1-refuse-paths-'));
  try {
    mkdirSync(join(v1Root, 'harness'), { recursive: true });
    writeFileSync(join(v1Root, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(join(v1Root, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\n', 'utf8');
    check('paths:v1-is-v1', isV1Install(v1Root) === true);
    check('paths:v1-detect-layout-null', detectLayout(v1Root) === null);
    check('paths:engine-not-v1', isV1Install(ROOT) === false);
  } finally {
    rmSync(v1Root, { recursive: true, force: true });
  }
}
check('migrate-layout:removed', !existsSync(join(ROOT, 'scripts', 'migrate-layout.mjs')));
check(
  'migrate-layout:template-removed',
  !existsSync(join(ROOT, 'cli', 'template', '.harness', 'scripts', 'migrate-layout.mjs')),
);
check('migrate-harness:removed', !existsSync(join(ROOT, 'cli', 'migrate-harness.mjs')));
check('schema:layout-field', /layout:\s*harness/.test(readFileSync(join(ROOT, 'harness', 'state.schema.md'), 'utf8')));
check('schema:role-field', /role:\s*product/.test(readFileSync(join(ROOT, 'harness', 'state.schema.md'), 'utf8')));
check('schema:paths-product', /product:\s*\.harness\/product/.test(readFileSync(join(ROOT, 'harness', 'state.schema.md'), 'utf8')));
check(
  'schema:no-mojibake',
  !/[ÔÃ’]/.test(readFileSync(join(ROOT, 'harness', 'state.schema.md'), 'utf8')),
  'state.schema.md has UTF-8 mojibake — use —, –, ≥, →',
);
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
  const templateAuditChecklists = join(ROOT, 'cli', 'template', '.harness', 'engine', 'templates', 'audit-checklists.md');
  if (existsSync(sourceAuditChecklists) && existsSync(templateAuditChecklists)) {
    check(
      'template:audit-checklists:match',
      readFileSync(sourceAuditChecklists, 'utf8') === readFileSync(templateAuditChecklists, 'utf8'),
      'cli/template/harness/templates/audit-checklists.md drifted from source',
    );
  }
}
{
  const sourceMonorepoWiring = join(ROOT, 'harness', 'pipeline', 'monorepo-wiring.md');
  const templateMonorepoWiring = join(ROOT, 'cli', 'template', '.harness', 'engine', 'pipeline', 'monorepo-wiring.md');
  if (existsSync(sourceMonorepoWiring) && existsSync(templateMonorepoWiring)) {
    check(
      'pipeline:monorepo-wiring:match',
      readFileSync(sourceMonorepoWiring, 'utf8') === readFileSync(templateMonorepoWiring, 'utf8'),
      'cli/template/harness/pipeline/monorepo-wiring.md drifted from source',
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
  check(
    'skill:midas-status:stage-table-yaml',
    /stage-command-table\.yaml/.test(statusBody) && /Do not duplicate/i.test(statusBody),
    'status must read stage-command-table.yaml instead of inlining the stage table',
  );
  check(
    'skill:midas-status:no-inlined-stage-table',
    !/\|\s*`?idea_intake`?\s*\|/.test(statusBody),
    'status must not embed a duplicated markdown stage→command table',
  );
}
const recallSkill = join(skillsDir, 'midas-recall', 'SKILL.md');
if (existsSync(recallSkill)) {
  const recallBody = readFileSync(recallSkill, 'utf8');
  check(
    'skill:midas-recall:stage-table-yaml',
    /stage-command-table\.yaml/.test(recallBody) && /Do not duplicate/i.test(recallBody),
    'recall must read stage-command-table.yaml instead of inlining recall paths per stage',
  );
  check(
    'skill:midas-recall:no-inlined-recall-table',
    !/\|\s*`?idea_intake`?\s*\|/.test(recallBody),
    'recall must not embed a duplicated markdown recall-path table',
  );
}
const helpSkill = join(skillsDir, 'midas-help', 'SKILL.md');
if (existsSync(helpSkill)) {
  const helpBody = readFileSync(helpSkill, 'utf8');
  check(
    'skill:midas-help:skill-flows',
    /skill-flows\.md/.test(helpBody),
    'help should cite skill-flows.md for flow-shape questions',
  );
  check(
    'skill:midas-help:response-map',
    /response-map\.md/.test(helpBody),
    'help must load the per-option map from L3 response-map.md',
  );
  check(
    'skill:midas-help:surface-filter',
    /user-surface:\s*primary/i.test(helpBody) || /Surface filter \(ADR-013\)/i.test(helpBody),
    'help must document primary-only surface filter (ADR-013)',
  );
  // AskQuestion option lines use "** Label ** (`/slash`)" — internals must not appear there.
  const askBlock = helpBody.match(/## Steps[\s\S]*?2\.\s+\*\*Answer/i)?.[0] || '';
  for (const banned of ['/midas-qa', '/midas-diff-gates', '/midas-lean-review', '/midas-sweep', '/midas-progress', '/midas-improve-loop', '/midas-autopilot', '/midas-auto-sprints']) {
    const inOptions = askBlock.includes(banned);
    check(
      `skill:midas-help:no-option:${banned.replace('/', '')}`,
      !inOptions,
      inOptions ? `AskQuestion options must not list ${banned}` : 'ok',
    );
  }
}

}
