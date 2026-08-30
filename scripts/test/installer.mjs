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
  engineVersion,
} from './harness.mjs';

export async function run() {
const installer = readFileSync(join(ROOT, 'cli', 'index.mjs'), 'utf8');
// --- ownership-manifest role / conflict behavior ---------------------------------------------
{
  check('ownership:role:engine-vendor', roleForPath('.harness/engine/skills/x/SKILL.md') === 'vendor');
  check('ownership:role:scripts-vendor', roleForPath('.harness/scripts/doctor.mjs') === 'vendor');
  check('ownership:role:autonomy-policy-user', roleForPath('.harness/autonomy/policy.yaml') === 'user');
  check('ownership:role:generated-agents', roleForPath('AGENTS.md') === 'generated');
  check('ownership:role:product-user', roleForPath('.harness/product/idea.md') === 'user');

  const ownRoot = mkdtempSync(join(tmpdir(), 'midas-own-'));
  try {
    mkdirSync(join(ownRoot, '.harness', 'scripts'), { recursive: true });
    const vendorRel = '.harness/scripts/probe.mjs';
    const vendorAbs = join(ownRoot, vendorRel);
    writeFileSync(vendorAbs, 'export const n = 1;\n', 'utf8');
    writeOwnershipManifest(ownRoot, '9.9.9');
    const manifest = readOwnershipManifest(ownRoot);
    check(
      'ownership:write-read-roundtrip',
      !!manifest &&
        manifest.schema_version === MANIFEST_SCHEMA_VERSION &&
        manifest.midas_version === '9.9.9' &&
        Array.isArray(manifest.files) &&
        manifest.files.some((f) => f.path === vendorRel && f.role === 'vendor' && f.sha256),
    );
    check('ownership:no-conflict-when-unchanged', findVendorConflicts(ownRoot, manifest).length === 0);
    writeFileSync(vendorAbs, 'export const n = 2;\n', 'utf8');
    const conflicts = findVendorConflicts(ownRoot, manifest);
    check(
      'ownership:detects-vendor-byte-drift',
      conflicts.length === 1 && conflicts[0] === vendorRel,
    );
    mkdirSync(join(ownRoot, '.harness', 'engine', 'skills', 'demo'), { recursive: true });
    mkdirSync(join(ownRoot, '.claude', 'skills', 'demo'), { recursive: true });
    const engineSkill = join(ownRoot, '.harness', 'engine', 'skills', 'demo', 'SKILL.md');
    const genRel = '.claude/skills/demo/SKILL.md';
    writeFileSync(engineSkill, '---\nname: demo\n---\nbody\n', 'utf8');
    writeFileSync(join(ownRoot, genRel), '---\nname: demo\n---\nbody\n', 'utf8');
    const withGen = writeOwnershipManifest(ownRoot, '9.9.9');
    check(
      'ownership:tracks-generated-skill-mirror',
      withGen.files.some((f) => f.path === genRel && f.role === 'generated' && f.sha256),
    );
    check('ownership:no-generated-conflict-when-unchanged', findGeneratedMirrorConflicts(ownRoot, withGen).length === 0);
    writeFileSync(join(ownRoot, genRel), '---\nname: demo\n---\nchanged\n', 'utf8');
    const genConflicts = findGeneratedMirrorConflicts(ownRoot, withGen);
    check(
      'ownership:detects-generated-mirror-drift',
      genConflicts.length === 1 && genConflicts[0] === genRel,
    );
    const empty = computeOwnershipManifest(join(ownRoot, 'missing-never'), '0.0.0');
    check('ownership:compute-missing-subdir-empty', Array.isArray(empty.files) && empty.files.length === 0);
    writeFileSync(join(ownRoot, '.harness', 'scripts', 'stray-untracked.mjs'), 'export const leftover = true;\n', 'utf8');
    const allowlisted = computeOwnershipManifest(ownRoot, '9.9.9', { vendorAllowlist: [vendorRel] });
    check(
      'ownership:allowlist-skips-untracked-vendor',
      allowlisted.files.some((f) => f.path === vendorRel) &&
        !allowlisted.files.some((f) => f.path === '.harness/scripts/stray-untracked.mjs'),
    );
    const bundled = bundledVendorPaths(join(ROOT, 'cli', 'template'), ownRoot);
    check(
      'ownership:bundled-vendor-paths-from-template',
      bundled.includes('.harness/engine/VERSION') && bundled.includes('.harness/scripts/doctor.mjs'),
    );
  } finally {
    rmSync(ownRoot, { recursive: true, force: true });
  }
}

// --- preserve-policy + plan/copy decision parity ---------------------------------------------
{
  const { alwaysPreservePath, decideTemplateCopyAction, isVendorManagedPath, isConflictVendorPath, isHostDiscoveryMirrorPath } =
    await import(pathToFileURL(join(ROOT, 'cli', 'lib', 'core', 'preserve-policy.mjs')).href);
  const { ensureAutonomyStatePointers } =
    await import(pathToFileURL(join(ROOT, 'cli', 'lib', 'runtime', 'autonomy-install.mjs')).href);
  const { planTemplateCopy } =
    await import(pathToFileURL(join(ROOT, 'cli', 'lib', 'steps', 'plan-tree.mjs')).href);

  check('preserve:mcp-always', alwaysPreservePath('.mcp.json', true) && alwaysPreservePath('.mcp.json', false));
  check('preserve:product-always', alwaysPreservePath('.harness/product/idea.md', true));
  check('preserve:engine-not-user', !alwaysPreservePath('.harness/engine/x.md', true));
  check('preserve:claude-fresh-only', alwaysPreservePath('.claude/skills/x/SKILL.md', false) && !alwaysPreservePath('.claude/skills/x/SKILL.md', true));
  check(
    'preserve:host-discovery-mirrors',
    isHostDiscoveryMirrorPath('.agents') &&
      isHostDiscoveryMirrorPath('.agents/skills/x/SKILL.md') &&
      !isHostDiscoveryMirrorPath('.claude/skills/x/SKILL.md') &&
      !isHostDiscoveryMirrorPath('.cursor/skills/x/SKILL.md') &&
      !isHostDiscoveryMirrorPath('.cursor/rules/00-midas.mdc') &&
      !isHostDiscoveryMirrorPath('.harness/engine/x.md'),
  );
  check('preserve:vendor-engine', isVendorManagedPath('.harness/engine/a.md'));
  check('preserve:conflict-autonomy-bin', isConflictVendorPath('.harness/autonomy/bin/x.mjs'));
  check('preserve:conflict-autonomy-policy-user', !isConflictVendorPath('.harness/autonomy/policy.yaml'));

  const cases = [
    { rel: '.mcp.json', exists: true, force: true, update: true, expect: 'skip' },
    { rel: '.harness/product/idea.md', exists: true, force: true, update: true, expect: 'skip' },
    { rel: '.harness/engine/a.md', exists: true, force: false, update: true, expect: 'refresh' },
    { rel: '.harness/scripts/doctor.mjs', exists: false, force: false, update: false, expect: 'refresh' },
    { rel: 'AGENTS.md', exists: true, force: true, update: false, expect: 'skip' },
    { rel: '.claude/skills/x/SKILL.md', exists: true, force: false, update: false, expect: 'skip' },
    { rel: '.claude/skills/x/SKILL.md', exists: true, force: true, update: true, expect: 'refresh' },
  ];
  let decideOk = true;
  for (const c of cases) {
    const d = decideTemplateCopyAction(c.rel, { exists: c.exists, force: c.force, update: c.update });
    if (d.action !== c.expect) decideOk = false;
  }
  check('preserve:decide-table', decideOk, 'decideTemplateCopyAction table drift');

  const planTmp = mkdtempSync(join(tmpdir(), 'midas-plan-'));
  try {
    mkdirSync(join(planTmp, 'tpl', '.harness', 'engine'), { recursive: true });
    writeFileSync(join(planTmp, 'tpl', '.harness', 'engine', 'VERSION'), '9.9.9\n', 'utf8');
    writeFileSync(join(planTmp, 'tpl', '.mcp.json'), '{}\n', 'utf8');
    mkdirSync(join(planTmp, 'dst', '.harness', 'engine'), { recursive: true });
    writeFileSync(join(planTmp, 'dst', '.harness', 'engine', 'VERSION'), 'old\n', 'utf8');
    writeFileSync(join(planTmp, 'dst', '.mcp.json'), '{"keep":true}\n', 'utf8');
    const freshPlan = planTemplateCopy({
      template: join(planTmp, 'tpl'),
      target: join(planTmp, 'dst'),
      mode: 'install',
      force: false,
      update: false,
    });
    check(
      'plan:vendor-fresh-note',
      freshPlan.ops.some((o) => o.id === 'vendor-fresh-reset' && o.kind === 'note'),
    );
    const mcpOp = freshPlan.ops.find((o) => o.path === '.mcp.json');
    const engOp = freshPlan.ops.find((o) => o.path === '.harness/engine/VERSION');
    check('plan:mcp-skip', mcpOp?.kind === 'skip');
    check('plan:engine-refresh', engOp?.kind === 'refresh' || engOp?.kind === 'write');

    const updatePlan = planTemplateCopy({
      template: join(planTmp, 'tpl'),
      target: join(planTmp, 'dst'),
      mode: 'update',
      force: true,
      update: true,
    });
    check(
      'plan:vendor-prune-note',
      updatePlan.ops.some((o) => o.id === 'vendor-stale-prune' && o.kind === 'note'),
    );
  } finally {
    rmSync(planTmp, { recursive: true, force: true });
  }

  const autoTmp = mkdtempSync(join(tmpdir(), 'midas-auto-ptr-'));
  try {
    mkdirSync(join(autoTmp, '.harness'), { recursive: true });
    const statePath = join(autoTmp, '.harness', 'state.yaml');
    writeFileSync(statePath, 'midas_version: 1.0.0\nautonomy:\n  enabled: false\n', 'utf8');
    const written = [];
    ensureAutonomyStatePointers({
      target: autoTmp,
      template: autoTmp,
      written,
      skipped: [],
      readMaybe: (p) => {
        try { return readFileSync(p, 'utf8'); } catch { return null; }
      },
    });
    check('autonomy:pointers-no-dup', written.length === 0 && (readFileSync(statePath, 'utf8').match(/^autonomy:/gm) || []).length === 1);
    writeFileSync(statePath, 'midas_version: 1.0.0\n', 'utf8');
    ensureAutonomyStatePointers({
      target: autoTmp,
      template: autoTmp,
      written,
      skipped: [],
      readMaybe: (p) => {
        try { return readFileSync(p, 'utf8'); } catch { return null; }
      },
    });
    check('autonomy:pointers-append', written.length === 1 && /autonomy:\n  enabled: false/.test(readFileSync(statePath, 'utf8')));
  } finally {
    rmSync(autoTmp, { recursive: true, force: true });
  }
}


// --- L0. installer --update must pass paths into readToolsFromState ---------------------------
{
  const installerExec = readFileSync(join(ROOT, 'cli', 'lib', 'runtime', 'execute.mjs'), 'utf8');
  check('installer:fillAgents-paths-arg', /function fillAgents\(tools, paths\)/.test(installerExec));
  check('installer:no-bare-readToolsFromState', !/readToolsFromState\(\)/.test(installerExec));
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
    const installBody = readFileSync(install, 'utf8');
    check(
      'install:update-docs:reconcile-section',
      /Updating an existing install/i.test(installBody) && /reconcil/i.test(installBody),
      'INSTALL.md must document the --update reconciliation contract',
    );
    check(
      'install:update-docs:cites-stale-manifest-test',
      installBody.includes('installer:update-stale-manifest-refresh'),
      'INSTALL.md must cite installer:update-stale-manifest-refresh',
    );
    check(
      'install:update-docs:cites-vendor-conflict-test',
      installBody.includes('installer:update-vendor-conflict-prewrite'),
      'INSTALL.md must cite installer:update-vendor-conflict-prewrite',
    );
    check(
      'install:update-docs:cites-dropped-file-test',
      installBody.includes('installer:update-prunes-dropped-vendor-file'),
      'INSTALL.md must cite installer:update-prunes-dropped-vendor-file',
    );
    check(
      'install:update-docs:cites-untracked-file-test',
      installBody.includes('installer:update-leaves-untracked-vendor-file') &&
        installBody.includes('installer:update-does-not-adopt-untracked-file') &&
        installBody.includes('installer:update-second-leaves-untracked-vendor-file'),
      'INSTALL.md must cite untracked-file tests including the two-update regression',
    );
    check(
      'install:docs:no-3x-auto-migrate',
      !/auto-migrates 1\.x/.test(installBody) && !/Works on \*\*v2 and 1\.x\*\*/.test(installBody),
      'INSTALL.md must not claim 3.x auto-migrates 1.x',
    );
  }
  for (const f of [
    'harness/skills/midas-update/SKILL.md',
    'harness/skills/midas-reconcile/SKILL.md',
    'cli/install-diagnose.mjs',
    'SECURITY.md',
    'README.md',
    'docs/faq.md',
    'cli/index.mjs',
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
  {
    const sh = readFileSync(join(ROOT, 'install.sh'), 'utf8');
    const ps = readFileSync(join(ROOT, 'install.ps1'), 'utf8');
    check(
      'install-shim:sh-reads-harness-version',
      /harness\/VERSION/.test(sh) && /resolve_midas_ref/.test(sh),
      'install.sh must resolve pin from harness/VERSION',
    );
    check(
      'install-shim:ps-reads-harness-version',
      /harness\/VERSION/.test(ps) && /Resolve-MidasRef/.test(ps),
      'install.ps1 must resolve pin from harness/VERSION',
    );
    check('install-shim:bleeding-edge-escape', /MIDAS_BLEEDING_EDGE/.test(sh) && /MIDAS_BLEEDING_EDGE/.test(ps));
  }
  {
    const syncCheck = spawnSync(process.execPath, [join(ROOT, 'scripts', 'sync-version.mjs'), '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check(
      'version:sync-check',
      syncCheck.status === 0,
      syncCheck.stderr || syncCheck.stdout || 'mirrors drift from harness/VERSION',
    );
  }
}

{
  // Engine skill locks — shipped skills + catalog + investigate templates (not lifecycle evidence).
  check(
    'engine-skill:midas-retro:skill-on-disk',
    existsSync(join(ROOT, 'harness', 'skills', 'midas-retro', 'SKILL.md')),
  );
  const skillsCatalog = existsSync(join(ROOT, 'docs', 'skills.md'))
    ? readFileSync(join(ROOT, 'docs', 'skills.md'), 'utf8')
    : '';
  check('engine-skill:midas-retro:catalog', /\/midas-retro\b/.test(skillsCatalog));
  check(
    'engine-skill:midas-investigate:skill-on-disk',
    existsSync(join(ROOT, 'harness', 'skills', 'midas-investigate', 'SKILL.md')),
  );
  check('engine-skill:midas-investigate:catalog', /\/midas-investigate\b/.test(skillsCatalog));
  check(
    'engine-skill:midas-investigate:template',
    existsSync(join(ROOT, 'harness', 'templates', 'investigate-record.md')),
  );
  check(
    'engine-skill:midas-investigate:playbook',
    existsSync(join(ROOT, 'harness', 'templates', 'playbooks', 'debug-root-cause.md')),
  );
  const reconcileSkill = readFileSync(join(ROOT, 'harness', 'skills', 'midas-reconcile', 'SKILL.md'), 'utf8');
  const initSkill = readFileSync(join(ROOT, 'harness', 'skills', 'midas-init', 'SKILL.md'), 'utf8');
  check(
    'skill:midas-reconcile:partial-migrate',
    /partial_migrate/.test(reconcileSkill) && /exists as a file/.test(reconcileSkill),
  );
  check('skill:midas-init:partial-migrate', /partial_migrate/.test(initSkill));
  check(
    'installer:bundle-integrity-fails-stable-mismatch',
    /ok: !stableReleaseMismatch/.test(readFileSync(join(ROOT, 'cli', 'lib', 'workflow', 'gather-checks.mjs'), 'utf8')) &&
      /publishedVer === deps\.bundledVersion/.test(readFileSync(join(ROOT, 'cli', 'lib', 'workflow', 'gather-checks.mjs'), 'utf8')),
  );
}


// --- O. tool selection + tool-aware adapter render ----------------------------------------------
check('render:tool-aware-default', resolveAdapterTools(ROOT).join(',') === DEFAULT_ADAPTER_TOOLS.join(','));
const defaultAdapterPaths = computeAdapters(ROOT).files.map((f) => f.path).sort();
check('render:tool-aware-default:adapter-count', defaultAdapterPaths.length === 6, defaultAdapterPaths.join(', '));

const narrowRoot = mkdtempSync(join(tmpdir(), 'midas-test-'));
mkdirSync(join(narrowRoot, '.harness'), { recursive: true });
writeFileSync(join(narrowRoot, '.harness', 'state.yaml'), 'role: product\nlayout: harness\ntools: [cursor]\n');
const narrowPaths = computeAdapters(narrowRoot).files.map((f) => f.path).sort();
check(
  'render:tool-aware-narrow',
  narrowPaths.length === 2 &&
    narrowPaths.includes('.cursor/rules/00-midas.mdc') &&
    narrowPaths.includes('.cursor/rules/01-midas-checks.mdc'),
  narrowPaths.join(', '),
);
check('render:tool-aware-narrow:no-claude', !narrowPaths.includes('CLAUDE.md'));
rmSync(narrowRoot, { recursive: true, force: true });

const installerArgsSrc = readFileSync(join(ROOT, 'cli', 'lib', 'cli', 'args.mjs'), 'utf8');
const installerRuntime = readFileSync(join(ROOT, 'cli', 'lib', 'runtime', 'execute.mjs'), 'utf8');
const installerOwnershipPhaseSrc = readFileSync(join(ROOT, 'cli', 'lib', 'runtime', 'phases', 'ownership-manifest.mjs'), 'utf8');
const engineSrc = readFileSync(join(ROOT, 'cli', 'lib', 'workflow', 'engine.mjs'), 'utf8');
const gatherSrc = readFileSync(join(ROOT, 'cli', 'lib', 'workflow', 'gather-checks.mjs'), 'utf8');
const installerRunner = readFileSync(join(ROOT, 'cli', 'lib', 'core', 'runner.mjs'), 'utf8');
check('installer:tools-flag', /KNOWN_TOOLS/.test(installer) && /--tools/.test(installer));
check('installer:tool-onboarding', /printToolOnboarding/.test(installerRuntime) && /tool-profiles\.mjs/.test(installerRuntime));
check('installer:no-root-gemini-extension', !/function ensureGeminiExtension/.test(installer) && !/function ensureGeminiExtension/.test(installerRuntime));
check('installer:tools-presets', /parseToolsPreset/.test(readFileSync(join(ROOT, 'scripts', 'tool-profiles.mjs'), 'utf8')));
check('installer:tty-fallback', /stdin\.isTTY/.test(installerRuntime) || /isInteractive/.test(installer));
check('installer:update-honours-tools', /hasToolsFlag\(\)/.test(installerRuntime) && /rewriteStateTools/.test(installerRuntime));
check(
  'installer:sync-skill-mirrors',
  (/async function syncSkillMirrors/.test(installerRuntime) || /syncSkillMirrorsMod/.test(installerRuntime)) &&
    /\.cursor\/skills/.test(readFileSync(join(ROOT, 'cli', 'lib', 'runtime', 'skill-mirrors.mjs'), 'utf8')),
);
check('installer:default-tools-cursor', /export const DEFAULT_TOOLS = \['cursor'\]/.test(installerArgsSrc));
check('installer:lib-workflow-engine', existsSync(join(ROOT, 'cli', 'lib', 'workflow', 'engine.mjs')));
check('installer:prune-orphan-adapters', /function pruneOrphanAdapters/.test(installerRuntime) || /pruneOrphanAdaptersMod/.test(installerRuntime));
check('installer:ops-runner', /export async function runPlanOps/.test(installerRunner));
check('installer:thin-shim', /createExecuteHandler/.test(installer) && /runInstaller\(parsedCmd/.test(installer));
{
  const { runPlanOps } = await import(pathToFileURL(join(ROOT, 'cli', 'lib', 'core', 'runner.mjs')).href);
  const log = [];
  const plan = {
    ops: [
      { id: 'info', kind: 'skip', reason: 'informational' },
      {
        id: 'work',
        kind: 'phase',
        apply: async () => { log.push('apply'); },
        verify: async () => { log.push('verify'); },
      },
    ],
  };
  const r = await runPlanOps(plan, {});
  check(
    'installer:runner-skips-informational-ops',
    r.applied === 1 && r.verified === 1 && log.join(',') === 'apply,verify',
    JSON.stringify(r) + log.join(','),
  );
}
check(
  'engine-state:classic-layout-declared',
  /^layout:\s*classic$/m.test(readFileSync(join(ROOT, 'harness', 'state.yaml'), 'utf8')),
  'engine harness/state.yaml must declare layout: classic',
);
check(
  'engine-state:role-engine',
  /^role:\s*engine$/m.test(readFileSync(join(ROOT, 'harness', 'state.yaml'), 'utf8')),
  'engine harness/state.yaml must declare role: engine',
);
check(
  'ci:user-shape-cursor-smoke',
  /Installer smoke test \(user shape — cursor-only thin root\)/.test(
    readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8'),
  ),
);
const knownMatch = installerArgsSrc.match(/export const KNOWN_TOOLS\s*=\s*\[([^\]]+)\]/);
if (knownMatch) {
  const known = knownMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, ''));
  check('installer:tools-vocabulary', known.join(',') === 'claude-code,cursor,windsurf,gemini,codex,copilot');
} else {
  check('installer:tools-vocabulary', false, 'KNOWN_TOOLS not found in lib/cli/args.mjs');
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
check('doctor:gitignore-check', /gitignore:midas-block/.test(readFileSync(join(ROOT, 'scripts', 'doctor', 'checks', 'mcp.mjs'), 'utf8')));
check(
  'doctor:install-verify-profile',
  /--profile=install-verify/.test(readFileSync(join(ROOT, 'scripts', 'doctor.mjs'), 'utf8')) &&
    /INSTALL_VERIFY_WARN_ONLY/.test(readFileSync(join(ROOT, 'scripts', 'doctor.mjs'), 'utf8')) &&
    /install-verify/.test(installerRuntime),
  'doctor + installer must share install-verify profile',
);
check(
  'doctor:context-cost-hook-check',
  /gate:context-cost-hook/.test(readFileSync(join(ROOT, 'scripts', 'doctor', 'checks', 'mcp.mjs'), 'utf8')),
  'doctor must verify context-cost-refresh sessionStart hook when script is installed',
);
check(
  'doctor:attestation-advisory',
  /audit:attestation-\$\{nn\}/.test(readFileSync(join(ROOT, 'scripts', 'doctor', 'checks', 'gates.mjs'), 'utf8')) ||
    /audit:attestation-/.test(readFileSync(join(ROOT, 'scripts', 'doctor', 'checks', 'gates.mjs'), 'utf8')),
  'doctor must advise when closed-sprint audits are un-attested',
);
{
  const giRoot = mkdtempSync(join(tmpdir(), 'midas-gi-'));
  const tplDir = join(giRoot, 'harness', 'templates');
  mkdirSync(tplDir, { recursive: true });
  writeFileSync(join(giRoot, 'harness', 'state.yaml'), 'role: engine\nlayout: classic\n', 'utf8');
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
check('installer:ensure-gitignore', /async function ensureGitignore\(paths\)/.test(installerRuntime));
check('installer:gitignore-merge', /gitignore-merge\.mjs/.test(installerRuntime));
check('installer:gitignore-report-always', /reportGitignoreLine|gitignore: Midas block already up to date/.test(installerRuntime));
check('installer:gitignore-after-engine', /ensureGitignore\(paths\)/.test(installerRuntime) && /gitignore-merge\.mjs/.test(installerRuntime));
check('installer:verify-after-update', /function verifyInstall\(paths\)/.test(installerRuntime) && /runDoctor\(TARGET, paths/.test(installerRuntime));
{
  // npx ships only `cli/` (package.json files). Hand-authored CLI must import
  // `cli/lib/shared/`, never the generated template or repo-root `scripts/`.
  const cliRoot = join(ROOT, 'cli');
  const importOffenders = [];
  for (const abs of walkFiles(cliRoot, {
    skipDir: (name) => name === 'template' || name === 'node_modules',
    filter: (name) => name.endsWith('.mjs') || name.endsWith('.js'),
  })) {
    const rel = relative(cliRoot, abs).replace(/\\/g, '/');
    const text = readFileSync(abs, 'utf8');
    const specRe = /(?:from|import)\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = specRe.exec(text))) {
      const spec = m[1].replace(/\\/g, '/');
      if (spec.includes('template/')) importOffenders.push(`${rel} → ${spec}`);
      if (/(?:^|\/)\.\.(?:\/\.\.)*\/scripts\//.test(spec)) importOffenders.push(`${rel} → ${spec}`);
    }
  }
  check(
    'installer:no-template-imports',
    importOffenders.length === 0,
    importOffenders.slice(0, 8).join('; ') || 'cli/lib and cli/*.mjs must not import template/ or repo scripts/',
  );
  const gatherImport = readFileSync(join(ROOT, 'cli', 'lib', 'workflow', 'gather-checks.mjs'), 'utf8');
  const stateImport = readFileSync(join(ROOT, 'cli', 'lib', 'runtime', 'state-write.mjs'), 'utf8');
  check(
    'installer:npx-imports-stay-in-cli',
    /from ['"]\.\.\/shared\/mcp-drift\.mjs['"]/.test(gatherImport) &&
      /from ['"]\.\.\/shared\/mcp-drift\.mjs['"]/.test(stateImport) &&
      !/from ['"]\.\.\/\.\.\/\.\.\/scripts\//.test(gatherImport) &&
      !/from ['"]\.\.\/\.\.\/\.\.\/scripts\//.test(stateImport),
    'cli runtime must import cli/lib/shared (npx package), not repo-root scripts/',
  );
}
check('installer:verify-auto-fix-routing', /STRICT:.*\\b\(routing\|version\)\\b/.test(installerRuntime));
check('installer:update-complete-hint', /no need to run \/midas-init for refresh/i.test(installerRuntime));
check('installer:install-vs-update-guard', /id: 'install-vs-update'/.test(gatherSrc));
check('installer:bump-version-always', /updatedTo = bag\.bumpVersionStamp\(paths\)/.test(installerOwnershipPhaseSrc));
check('installer:install-cmd-module', /install-cmd\.mjs/.test(gatherSrc));
check('installer:layout-flag', /3\.x writes only --layout=harness/.test(gatherSrc));
check(
  'installer:refuses-engine-repo',
  /isMidasEngineRepository/.test(readFileSync(join(ROOT, 'cli', 'lib', 'core', 'context.mjs'), 'utf8')) &&
    /not-engine-repo/.test(gatherSrc),
);
{
  const refuse = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--dry-run', ROOT], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const refuseOut = `${refuse.stdout || ''}${refuse.stderr || ''}`;
  check(
    'installer:refuses-engine-repo-runtime',
    refuse.status === 1 && /refusing to install\/update\/migrate into the midas-harness engine repository/.test(refuseOut),
    refuseOut.slice(0, 400),
  );
  check(
    'engine-repo:no-nested-product-install',
    !existsSync(join(ROOT, '.harness', 'engine', 'VERSION')) && !existsSync(join(ROOT, '.harness', 'state.yaml')),
  );
}
check(
  'installer:hasMidasInstall-compact',
  /export function hasMidasInstall/.test(readFileSync(join(ROOT, 'cli', 'lib', 'core', 'context.mjs'), 'utf8')) &&
    /\.midas/.test(readFileSync(join(ROOT, 'cli', 'lib', 'core', 'context.mjs'), 'utf8')),
);
check('installer:engine-owns-lifecycle', /runInstaller\(parsedCmd/.test(installer) && /vendor-conflicts/.test(gatherSrc));
check('installer:bind-applies', existsSync(join(ROOT, 'cli', 'lib', 'steps', 'bind-applies.mjs')));
if (!TEST_FAST) {
{
  const rollbackRoot = mkdtempSync(join(tmpdir(), 'midas-install-rollback-'));
  try {
    writeFileSync(join(rollbackRoot, 'keep.txt'), 'keep\n', 'utf8');
    try {
      execSync(`node "${join(ROOT, 'cli', 'index.mjs')}" "${rollbackRoot}"`, {
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
  const preexistingScriptRoot = mkdtempSync(join(tmpdir(), 'midas-preexisting-script-'));
  const marker = join(preexistingScriptRoot, 'executed-marker.txt');
  try {
    const scriptsDir = join(preexistingScriptRoot, '.harness', 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(
      join(scriptsDir, 'paths.mjs'),
      `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'executed');\nexport function resolvePaths() { throw new Error('preexisting target script executed'); }\n`,
      'utf8',
    );
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', preexistingScriptRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:fresh-overwrites-preexisting-vendor-scripts',
      install.status === 0 && !existsSync(marker),
      install.stderr || install.stdout || `exit ${install.status}`,
    );
  } finally {
    rmSync(preexistingScriptRoot, { recursive: true, force: true });
  }
}
{
  const updateRoot = mkdtempSync(join(tmpdir(), 'midas-harness-update-conflict-'));
  try {
    const install = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', updateRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check('installer:update-conflict-fixture-install', install.status === 0, install.stderr || install.stdout);
    const vendor = join(updateRoot, '.harness', 'engine', 'conventions.md');
    if (!existsSync(vendor)) {
      check('installer:update-vendor-conflict-prewrite', false, 'missing conventions.md after fixture install');
      check('installer:update-conflicts-outside-cache', false, 'skipped — fixture install failed');
      check('installer:update-preflight-blocks-on-conflicts', false, 'skipped — fixture install failed');
      check('installer:update-proceeds-once-conflicts-cleared', false, 'skipped — fixture install failed');
    } else {
    const pristine = readFileSync(vendor, 'utf8');
    const modified = `${pristine}\nproject edit outside overlay\n`;
    writeFileSync(vendor, modified, 'utf8');
    const updateResult = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--update', '--offline', updateRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    // Vendor is engine-owned: the bundle wins, but the local edit is copied aside first.
    const savedConflicts = [];
    const conflictsRoot = join(updateRoot, '.harness', 'conflicts');
    if (existsSync(conflictsRoot)) {
      const walkConflicts = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const abs = join(dir, entry.name);
          if (entry.isDirectory()) walkConflicts(abs);
          else if (entry.name.endsWith('.midas-conflict')) savedConflicts.push(abs);
        }
      };
      walkConflicts(conflictsRoot);
    }
    check(
      'installer:update-vendor-conflict-prewrite',
      updateResult.status === 0 &&
        readFileSync(vendor, 'utf8') === pristine &&
        savedConflicts.some((abs) => readFileSync(abs, 'utf8') === modified),
      updateResult.stderr || updateResult.stdout,
    );
    // Saved edits must not live under `.harness/cache/`: rollback scrubs that tree, which would
    // destroy the only copy of the user's work.
    check(
      'installer:update-conflicts-outside-cache',
      savedConflicts.every((abs) => !abs.replace(/\\/g, '/').includes('/.harness/cache/')),
      savedConflicts.join(', '),
    );
    // A second update must refuse while the saved conflict is unreviewed, and say what to clear.
    const blocked = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), 'update', '--yes', '--offline', updateRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const blockedOut = `${blocked.stdout}${blocked.stderr}`;
    check(
      'installer:update-preflight-blocks-on-conflicts',
      blocked.status !== 0 && /update:conflicts/.test(blockedOut) && /\.harness\/conflicts/.test(blockedOut),
      blockedOut,
    );
    rmSync(conflictsRoot, { recursive: true, force: true });
    const cleared = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), 'update', '--yes', '--offline', updateRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check(
      'installer:update-proceeds-once-conflicts-cleared',
      cleared.status === 0,
      cleared.stderr || cleared.stdout,
    );
    }
  } finally {
    rmSync(updateRoot, { recursive: true, force: true });
  }
}
// A fresh install must hash identical to the bundle it came from, or every install reports itself
// out of date the moment a channel exists. Guards role drift (a per-install file marked `vendor`).
{
  const parityRoot = mkdtempSync(join(tmpdir(), 'midas-harness-hash-parity-'));
  try {
    const install = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', parityRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check('installer:hash-parity-fixture-install', install.status === 0, install.stderr || install.stdout);
    const installed = readOwnershipManifest(parityRoot);
    const bundle = treeSha256(scanVendorTree(join(ROOT, 'cli', 'template')));
    check(
      'installer:tree-hash-matches-bundle',
      installed?.tree_sha256 === bundle,
      `installed ${installed?.tree_sha256} vs bundle ${bundle}`,
    );
    check(
      'ownership:skill-registry-is-generated',
      roleForPath('.harness/engine/skill-registry.md') === 'generated',
      'skill-registry.md is re-derived per install and must not be inside the vendor content hash',
    );
  } finally {
    rmSync(parityRoot, { recursive: true, force: true });
  }
}
{
  const autoRoot = mkdtempSync(join(tmpdir(), 'midas-harness-hash-parity-auto-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', '--autonomy', autoRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:hash-parity-autonomy-install', install.status === 0, install.stderr || install.stdout);
    const installed = readOwnershipManifest(autoRoot);
    const bundle = treeSha256(scanVendorTree(join(ROOT, 'cli', 'template')));
    check(
      'installer:tree-hash-matches-bundle-with-autonomy',
      installed?.tree_sha256 === bundle,
      `installed ${installed?.tree_sha256} vs bundle ${bundle}`,
    );
    const autoVendor = (installed?.files || []).some(
      (f) => f.role === 'vendor' && String(f.path).replace(/\\/g, '/').startsWith('.harness/autonomy/'),
    );
    check(
      'installer:autonomy-still-vendor-in-manifest',
      autoVendor,
      'autonomy files stay in the ownership manifest; they just do not move the channel hash',
    );
  } finally {
    rmSync(autoRoot, { recursive: true, force: true });
  }
}
{
  const checkRoot = mkdtempSync(join(tmpdir(), 'midas-harness-update-check-'));
  try {
    const install = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', checkRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check('installer:update-check-fixture-install', install.status === 0, install.stderr || install.stdout);
    const installed = readOwnershipManifest(checkRoot);
    check(
      'installer:install-records-channel',
      installed?.channel === 'stable',
      `manifest.channel=${installed?.channel}`,
    );
    const unknown = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), 'update', '--check', '--offline', checkRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:update-check-unknown',
      unknown.status === 2 && /cannot determine/.test(`${unknown.stdout}${unknown.stderr}`),
      unknown.stderr || unknown.stdout,
    );
    const edgeManifest = join(checkRoot, 'edge.json');
    writeFileSync(
      edgeManifest,
      `${JSON.stringify({
        schema_version: 1,
        channel: 'edge',
        version: '9.9.9',
        ref: 'main',
        commit: 'abc1234def567890',
        tree_sha256: '0'.repeat(64),
      }, null, 2)}\n`,
      'utf8',
    );
    const available = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), 'update', '--check', '--channel=edge', `--manifest-file=${edgeManifest}`, checkRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const availableOut = `${available.stdout}${available.stderr}`;
    check(
      'installer:update-check-available',
      available.status === 1 &&
        /--channel=edge/.test(availableOut) &&
        /#abc1234def567890/.test(availableOut) &&
        /never downloads/.test(availableOut),
      availableOut,
    );
  } finally {
    rmSync(checkRoot, { recursive: true, force: true });
  }
}
{
  const pruneRoot = mkdtempSync(join(tmpdir(), 'midas-harness-update-dropped-'));
  try {
    const install = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', pruneRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check('installer:update-dropped-fixture-install', install.status === 0, install.stderr || install.stdout);
    const manifestPath = join(pruneRoot, '.harness', 'manifest.json');
    const injectVendor = (rel, body) => {
      const abs = join(pruneRoot, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body, 'utf8');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.files = (manifest.files || []).filter((f) => f.path !== rel);
      manifest.files.push({
        path: rel,
        role: 'vendor',
        sha256: sha256File(abs),
        size: statSync(abs).size,
      });
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    };
    injectVendor('.harness/engine/dropped.md', 'was in the last install\n');
    injectVendor('.harness/engine/dropped-edited.md', 'original dropped bytes\n');
    writeFileSync(join(pruneRoot, '.harness', 'engine', 'dropped-edited.md'), 'original dropped bytes\nI edited this\n', 'utf8');
    writeFileSync(join(pruneRoot, '.harness', 'engine', 'stray.md'), 'untracked note\n', 'utf8');

    const updateResult = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), 'update', '--yes', '--offline', pruneRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const saved = [];
    const conflictsRoot = join(pruneRoot, '.harness', 'conflicts');
    const walkConflicts = (dir) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) walkConflicts(abs);
        else if (entry.name.endsWith('.midas-conflict')) saved.push(abs);
      }
    };
    walkConflicts(conflictsRoot);
    check(
      'installer:update-prunes-dropped-vendor-file',
      updateResult.status === 0 && !existsSync(join(pruneRoot, '.harness', 'engine', 'dropped.md')),
      updateResult.stderr || updateResult.stdout,
    );
    check(
      'installer:update-saves-edited-dropped-vendor-file',
      updateResult.status === 0 &&
        !existsSync(join(pruneRoot, '.harness', 'engine', 'dropped-edited.md')) &&
        saved.some((abs) => readFileSync(abs, 'utf8').includes('I edited this')),
      updateResult.stderr || updateResult.stdout,
    );
    check(
      'installer:update-leaves-untracked-vendor-file',
      updateResult.status === 0 &&
        readFileSync(join(pruneRoot, '.harness', 'engine', 'stray.md'), 'utf8') === 'untracked note\n',
      updateResult.stderr || updateResult.stdout,
    );
  } finally {
    rmSync(pruneRoot, { recursive: true, force: true });
  }
}
{
  const strayRoot = mkdtempSync(join(tmpdir(), 'midas-harness-update-untracked-twice-'));
  try {
    const install = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', strayRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check('installer:update-untracked-twice-fixture', install.status === 0, install.stderr || install.stdout);
    const strayRel = '.harness/engine/stray.md';
    writeFileSync(join(strayRoot, strayRel), 'untracked note\n', 'utf8');
    const first = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), 'update', '--yes', '--offline', strayRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const afterFirst = existsSync(join(strayRoot, '.harness', 'manifest.json'))
      ? JSON.parse(readFileSync(join(strayRoot, '.harness', 'manifest.json'), 'utf8'))
      : { files: [] };
    check(
      'installer:update-does-not-adopt-untracked-file',
      first.status === 0 &&
        existsSync(join(strayRoot, strayRel)) &&
        !(afterFirst.files || []).some((f) => f.path === strayRel),
      first.stderr || first.stdout,
    );
    const second = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), 'update', '--yes', '--offline', strayRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:update-second-leaves-untracked-vendor-file',
      second.status === 0 &&
        existsSync(join(strayRoot, strayRel)) &&
        readFileSync(join(strayRoot, strayRel), 'utf8') === 'untracked note\n',
      second.stderr || second.stdout,
    );
  } finally {
    rmSync(strayRoot, { recursive: true, force: true });
  }
}
{
  const staleRoot = mkdtempSync(join(tmpdir(), 'midas-harness-update-stale-manifest-'));
  try {
    const install = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', staleRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check('installer:update-stale-manifest-install', install.status === 0, install.stderr || install.stdout);
    const manifestPath = join(staleRoot, '.harness', 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const file of manifest.files) {
      if (file.role === 'vendor' && file.sha256) file.sha256 = '0'.repeat(64);
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const updateResult = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--update', '--offline', staleRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const doctor = spawnSync(process.execPath, [join(staleRoot, '.harness', 'scripts', 'doctor.mjs'), '--strict'], {
      cwd: staleRoot,
      encoding: 'utf8',
    });
    check(
      'installer:update-stale-manifest-refresh',
      updateResult.status === 0 &&
        !/re-baselining/.test(`${updateResult.stdout}${updateResult.stderr}`) &&
        doctor.status === 0,
      updateResult.stderr || updateResult.stdout || doctor.stderr || doctor.stdout,
    );
  } finally {
    rmSync(staleRoot, { recursive: true, force: true });
  }
}
{
  const pruneRoot = mkdtempSync(join(tmpdir(), 'midas-harness-update-tools-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=claude-code,cursor,windsurf,gemini', pruneRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:update-tools-fixture-install', install.status === 0, install.stderr || install.stdout);
    const updateResult = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--update', '--offline', '--tools=cursor', pruneRoot],
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
        existsSync(join(pruneRoot, '.cursor', 'rules', '01-midas-checks.mdc')) &&
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
  const userMirrorRoot = mkdtempSync(join(tmpdir(), 'midas-harness-user-mirror-'));
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
      [join(ROOT, 'cli', 'index.mjs'), '--tools=codex', userMirrorRoot],
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
  const cursorMcpRoot = mkdtempSync(join(tmpdir(), 'midas-harness-cursor-mcp-conflict-'));
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
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', cursorMcpRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:cursor-mcp-conflict-rolls-back',
      (install.status === 1 || install.status === 5) &&
        /Cursor config before installing/.test(`${install.stdout}${install.stderr}`) &&
        treeDigest(cursorMcpRoot) === before,
      install.stderr || install.stdout,
    );
  } finally {
    rmSync(cursorMcpRoot, { recursive: true, force: true });
  }
}
{
  const projectRulesRoot = mkdtempSync(join(tmpdir(), 'midas-harness-project-rules-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', projectRulesRoot],
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
        /Local policy/.test(readFileSync(join(projectRulesRoot, '.cursor', 'rules', '01-midas-checks.mdc'), 'utf8')) &&
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
  const uninstallRoot = mkdtempSync(join(tmpdir(), 'midas-harness-uninstall-'));
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
      [join(ROOT, 'cli', 'index.mjs'), '--tools=codex', uninstallRoot],
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
      [join(ROOT, 'cli', 'index.mjs'), '--uninstall', uninstallRoot],
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
    const dry = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--update', '--dry-run', '--offline', legacyUpdateRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:update-v1-dry-run-refuses',
      dry.status === 1 &&
        /does not support 1\.x/i.test(`${dry.stdout}${dry.stderr}`) &&
        treeDigest(legacyUpdateRoot) === before,
      dry.stderr || dry.stdout,
    );
    const updateResult = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--update', '--yes', '--offline', legacyUpdateRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const out = `${updateResult.stdout}${updateResult.stderr}`;
    check(
      'installer:update-v1-refuses',
      updateResult.status === 1 &&
        /does not support 1\.x/i.test(out) &&
        treeDigest(legacyUpdateRoot) === before &&
        !existsSync(join(legacyUpdateRoot, '.harness', 'engine', 'VERSION')),
      out.slice(0, 800),
    );
    const uninstallV1 = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--uninstall', legacyUpdateRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:uninstall-v1-refuses',
      uninstallV1.status === 1 &&
        /does not support 1\.x/i.test(`${uninstallV1.stdout}${uninstallV1.stderr}`) &&
        treeDigest(legacyUpdateRoot) === before,
      (uninstallV1.stderr || uninstallV1.stdout || '').slice(0, 800),
    );
  } finally {
    rmSync(legacyUpdateRoot, { recursive: true, force: true });
  }
}
{
  const migrateRefuse = mkdtempSync(join(tmpdir(), 'midas-migrate-refuse-'));
  try {
    mkdirSync(join(migrateRefuse, 'harness'), { recursive: true });
    writeFileSync(join(migrateRefuse, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(join(migrateRefuse, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\n', 'utf8');
    const before = treeDigest(migrateRefuse);
    const migration = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--migrate', '--apply', '--yes', migrateRefuse],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:migrate-refuses-v1-zero-writes',
      migration.status === 1 &&
        /does not support 1\.x/i.test(`${migration.stdout}${migration.stderr}`) &&
        treeDigest(migrateRefuse) === before,
      migration.stderr || migration.stdout,
    );
  } finally {
    rmSync(migrateRefuse, { recursive: true, force: true });
  }
}
{
  // Harness-layout --update verify fail → NEEDS_REPAIR; vendor tree not wiped.
  const harnessVerifyRoot = mkdtempSync(join(tmpdir(), 'midas-harness-verify-fail-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', harnessVerifyRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:harness-verify-fail-fixture', install.status === 0, install.stderr || install.stdout);
    const statePath = join(harnessVerifyRoot, '.harness', 'state.yaml');
    const state = readFileSync(statePath, 'utf8').replace(/^midas_version:\s*\S+/m, 'midas_version: 2.0.0');
    writeFileSync(statePath, state, 'utf8');
    const update = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--update', '--yes', '--offline', harnessVerifyRoot],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, MIDAS_TEST_VERIFY_FAIL: '1' },
      },
    );
    const out = `${update.stdout}${update.stderr}`;
    check(
      'installer:update-harness-verify-fail-needs-repair',
      update.status === 6 &&
        /NEEDS_REPAIR|needs repair/i.test(out) &&
        existsSync(join(harnessVerifyRoot, '.harness', 'engine', 'VERSION')) &&
        existsSync(join(harnessVerifyRoot, '.harness', 'cache', 'installer', 'active.json')),
      out.slice(0, 1200),
    );
  } finally {
    rmSync(harnessVerifyRoot, { recursive: true, force: true });
  }
}

// --- Installer lifecycle characterization (deterministic CLI) --------------------------------
{
  const { sortPlanOps, createPlan } = await import(pathToFileURL(join(ROOT, 'cli', 'lib', 'core', 'plan.mjs')).href);
  const { detectContext, compareVersions } = await import(pathToFileURL(join(ROOT, 'cli', 'lib', 'core', 'context.mjs')).href);
  try {
    const sorted = sortPlanOps([
      { id: 'b', kind: 'write', dependsOn: ['a'] },
      { id: 'a', kind: 'write' },
      { id: 'c', kind: 'write', dependsOn: ['a', 'b'] },
    ]);
    check('installer:plan-topo-sort', sorted.map((o) => o.id).join(',') === 'a,b,c');
  } catch (e) {
    check('installer:plan-topo-sort', false, e.message);
  }
  try {
    createPlan({ mode: 't', target: '.', ops: [{ id: 'a', kind: 'x', dependsOn: ['missing'] }] });
    check('installer:plan-missing-dep', false, 'expected throw');
  } catch {
    check('installer:plan-missing-dep', true);
  }
  try {
    createPlan({
      mode: 't',
      target: '.',
      ops: [
        { id: 'a', kind: 'x', dependsOn: ['b'] },
        { id: 'b', kind: 'x', dependsOn: ['a'] },
      ],
    });
    check('installer:plan-cycle', false, 'expected throw');
  } catch {
    check('installer:plan-cycle', true);
  }
  check('installer:compare-versions', compareVersions('2.0.0', '2.1.0') < 0 && compareVersions('2.1.0-rc.1', '2.1.0') < 0);
  const emptyDir = mkdtempSync(join(tmpdir(), 'midas-ctx-'));
  const emptyCtx = detectContext(emptyDir);
  check('installer:detect-context-empty', !emptyCtx.installed && emptyCtx.layout == null);
  rmSync(emptyDir, { recursive: true, force: true });
}
{
  const emptyUpdate = mkdtempSync(join(tmpdir(), 'midas-update-empty-'));
  try {
    const before = treeDigest(emptyUpdate);
    const r = spawnSync(process.execPath, [join(ROOT, 'cli', 'index.mjs'), '--update', '--offline', emptyUpdate], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    check(
      'installer:update-empty-dir-refuses',
      r.status === 1 && /no existing Midas install/.test(`${r.stdout}${r.stderr}`) && treeDigest(emptyUpdate) === before,
      r.stderr || r.stdout,
    );
  } finally {
    rmSync(emptyUpdate, { recursive: true, force: true });
  }
}
{
  const parent = mkdtempSync(join(tmpdir(), 'midas-nested-parent-'));
  const child = join(parent, 'child');
  try {
    mkdirSync(child, { recursive: true });
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', parent],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:nested-parent-install', install.status === 0, install.stderr || install.stdout);
    const before = treeDigest(child);
    const nested = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', child],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:nested-install-refuses',
      nested.status === 1 && /nested|already inside/i.test(`${nested.stdout}${nested.stderr}`) && treeDigest(child) === before,
      nested.stderr || nested.stdout,
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
{
  const dryRoot = mkdtempSync(join(tmpdir(), 'midas-dry-run-'));
  try {
    const before = treeDigest(dryRoot);
    const r = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', '--dry-run', '--json', dryRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    let envelope = null;
    try { envelope = JSON.parse(r.stdout || '{}'); } catch { /* ignore */ }
    check(
      'installer:dry-run-zero-writes',
      r.status === 0 && treeDigest(dryRoot) === before && envelope?.dryRun === true && envelope?.ok === true && Array.isArray(envelope?.plan?.ops),
      r.stderr || r.stdout,
    );
  } finally {
    rmSync(dryRoot, { recursive: true, force: true });
  }
}
{
  const spaced = mkdtempSync(join(tmpdir(), 'midas space install '));
  try {
    const r = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', spaced],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:path-with-spaces',
      r.status === 0 && existsSync(join(spaced, '.harness', 'engine', 'VERSION')) && existsSync(join(spaced, '.harness', 'manifest.json')),
      r.stderr || r.stdout,
    );
    check(
      'installer:cursor-only-thin-root',
      r.status === 0 &&
        existsSync(join(spaced, '.cursor', 'skills')) &&
        existsSync(join(spaced, '.harness', 'product')) &&
        existsSync(join(spaced, '.harness', 'rules')) &&
        existsSync(join(spaced, '.harness', 'runs')) &&
        !existsSync(join(spaced, '.agents')) &&
        !existsSync(join(spaced, '.claude')) &&
        !existsSync(join(spaced, '.windsurf')) &&
        !existsSync(join(spaced, 'GEMINI.md')),
      r.stderr || r.stdout,
    );
  } finally {
    rmSync(spaced, { recursive: true, force: true });
  }
}
{
  const diagTmp = mkdtempSync(join(tmpdir(), 'midas-diag-matrix-'));
  try {
    const { diagnoseProject } = await import(pathToFileURL(join(ROOT, 'cli', 'install-diagnose.mjs')).href);
    check('diagnose:matrix-not-installed', diagnoseProject(diagTmp).status === 'not_installed');

    mkdirSync(join(diagTmp, 'nested'), { recursive: true });
    mkdirSync(join(diagTmp, '.harness', 'engine'), { recursive: true });
    writeFileSync(join(diagTmp, '.harness', 'engine', 'VERSION'), '2.2.1\n', 'utf8');
    writeFileSync(join(diagTmp, '.harness', 'state.yaml'), 'midas_version: 2.2.1\nlayout: harness\nsetup_complete: true\n', 'utf8');
    check('diagnose:matrix-nested-cwd', diagnoseProject(join(diagTmp, 'nested')).status === 'nested_or_wrong_cwd');

    const legacy = mkdtempSync(join(tmpdir(), 'midas-diag-legacy-'));
    mkdirSync(join(legacy, 'harness'), { recursive: true });
    writeFileSync(join(legacy, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(join(legacy, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\n', 'utf8');
    check('diagnose:matrix-legacy', diagnoseProject(legacy).status === 'unsupported_v1');
    {
      const refused = resolveRefreshCommand({ command: 'update', dryRun: false, yes: true }, legacy);
      check('update-refuses-legacy', refused.refuseV1 === true && refused.promoted === false);
      const preview = resolveRefreshCommand({ command: 'update', dryRun: true }, legacy);
      check('update-refuses-legacy-dry-run', preview.refuseV1 === true);
      const stay = resolveRefreshCommand({ command: 'update', dryRun: false }, diagTmp);
      check('update-stays-on-harness', stay.refuseV1 !== true && stay.cmd.command === 'update');
      const legacyCli = diagnoseProject(legacy);
      check('diagnose:legacy-points-2-10', /create-midas@2\.10\.3 update --yes/.test(legacyCli.nextCli || ''));
      check('diagnose:legacy-slash-reconcile', legacyCli.nextSlash === '/midas-reconcile');
    }
    rmSync(legacy, { recursive: true, force: true });

    const partial = mkdtempSync(join(tmpdir(), 'midas-diag-partial-'));
    mkdirSync(join(partial, '.harness', 'product'), { recursive: true });
    writeFileSync(join(partial, '.harness', 'product', 'idea.md'), '# idea\n', 'utf8');
    check('diagnose:matrix-partial-migrate', diagnoseProject(partial).status === 'partial_migrate');
    check('diagnose:partial-slash-init', diagnoseProject(partial).nextSlash === '/midas-init');
    {
      const partialDiag = diagnoseProject(partial, { bundledVersion: '2.10.0' });
      check(
        'diagnose:partial-uses-update-subcommand',
        /#v2\.10\.0 update --yes/.test(partialDiag.detail || '') && !/#v2\.9\.8/.test(partialDiag.detail || ''),
        partialDiag.detail,
      );
    }
    rmSync(partial, { recursive: true, force: true });

    writeFileSync(join(diagTmp, '.harness', 'state.yaml'), 'midas_version: 2.0.0\nlayout: harness\nsetup_complete: true\n', 'utf8');
    {
      const behind = diagnoseProject(diagTmp);
      check('diagnose:matrix-version-behind', behind.status === 'version_behind');
      check('diagnose:version-behind-slash-init', behind.nextSlash === '/midas-init');
    }

    writeFileSync(join(diagTmp, '.harness', 'state.yaml'), 'midas_version: 2.2.1\nlayout: harness\nsetup_complete: true\n', 'utf8');
    check('diagnose:matrix-ready', diagnoseProject(diagTmp).status === 'ready');

    writeFileSync(
      join(diagTmp, '.harness', 'state.yaml'),
      'midas_version: 2.2.1\nlayout: harness\nsetup_complete: true\nstage: sprint_execution\n',
      'utf8',
    );
    const sprintExec = diagnoseProject(diagTmp);
    check(
      'diagnose:autonomy-hint-sprint-execution',
      sprintExec.status === 'ready' && /Autonomy:/.test(sprintExec.detail || ''),
      sprintExec.detail,
    );

    const jsonDiag = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--diagnose', '--json', diagTmp],
      { cwd: ROOT, encoding: 'utf8' },
    );
    let dj = null;
    try { dj = JSON.parse(jsonDiag.stdout || '{}'); } catch { /* ignore */ }
    check(
      'diagnose:json-envelope',
      jsonDiag.status === 0 && dj?.schema_version === 1 && dj?.mode === 'diagnose' && dj?.diagnosis?.status === 'ready',
      jsonDiag.stderr || jsonDiag.stdout,
    );
  } finally {
    rmSync(diagTmp, { recursive: true, force: true });
  }
}
{
  const uninstallDry = mkdtempSync(join(tmpdir(), 'midas-uninstall-dry-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', uninstallDry],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:uninstall-dry-fixture', install.status === 0, install.stderr || install.stdout);
    const before = treeDigest(uninstallDry);
    const dry = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--uninstall', '--dry-run', uninstallDry],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:uninstall-dry-run',
      dry.status === 0 && /dry run/i.test(`${dry.stdout}${dry.stderr}`) && treeDigest(uninstallDry) === before,
      dry.stderr || dry.stdout,
    );
    mkdirSync(join(uninstallDry, '.harness', 'product'), { recursive: true });
    writeFileSync(join(uninstallDry, '.harness', 'product', 'idea.md'), '# keep\n', 'utf8');
    const purge = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--uninstall', '--purge', uninstallDry],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:uninstall-purge',
      purge.status === 0 &&
        !existsSync(join(uninstallDry, '.harness', 'engine', 'VERSION')) &&
        !existsSync(join(uninstallDry, '.harness', 'product', 'idea.md')) &&
        !existsSync(join(uninstallDry, '.harness', 'state.yaml')),
      purge.stderr || purge.stdout,
    );
  } finally {
    rmSync(uninstallDry, { recursive: true, force: true });
  }
}
{
  const hooksFixture = mkdtempSync(join(tmpdir(), 'midas-uninstall-hooks-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', hooksFixture],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:hooks-fixture-install', install.status === 0, install.stderr || install.stdout);
    const hooksPath = join(hooksFixture, '.cursor', 'hooks.json');
    const hooksBefore = existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : '';
    check(
      'installer:cursor-hooks-seeded',
      /trace-hook\.mjs|\.harness\/scripts\/safety\//.test(hooksBefore) &&
        /carryover-refresh\.mjs|context-cost-refresh\.mjs/.test(hooksBefore),
      hooksBefore.slice(0, 300) || 'missing hooks.json',
    );
    const uninstallHooks = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--uninstall', hooksFixture],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const hooksAfter = existsSync(hooksPath) ? readFileSync(hooksPath, 'utf8') : '';
    check(
      'installer:uninstall-strips-cursor-hooks',
      uninstallHooks.status === 0 &&
        (!existsSync(hooksPath) ||
          (!hooksAfter.includes('trace-hook.mjs') &&
            !hooksAfter.includes('.harness/scripts/safety/') &&
            !hooksAfter.includes('carryover-refresh.mjs') &&
            !hooksAfter.includes('context-cost-refresh.mjs'))),
      uninstallHooks.stderr || uninstallHooks.stdout,
    );
  } finally {
    rmSync(hooksFixture, { recursive: true, force: true });
  }
}
{
  const migrateOk = mkdtempSync(join(tmpdir(), 'midas-migrate-ok-'));
  try {
    mkdirSync(join(migrateOk, 'harness'), { recursive: true });
    mkdirSync(join(migrateOk, 'scripts'), { recursive: true });
    mkdirSync(join(migrateOk, 'product'), { recursive: true });
    writeFileSync(join(migrateOk, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(join(migrateOk, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\nsetup_complete: true\n', 'utf8');
    writeFileSync(join(migrateOk, 'scripts', 'doctor.mjs'), '// Midas doctor\n', 'utf8');
    writeFileSync(join(migrateOk, 'product', 'idea.md'), '# idea\n', 'utf8');
    const migration = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--migrate', '--apply', '--yes', '--tools=cursor', migrateOk],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(
      'installer:migrate-apply-refuses',
      migration.status === 1 &&
        /does not support 1\.x/i.test(`${migration.stdout}${migration.stderr}`) &&
        !existsSync(join(migrateOk, '.harness', 'engine', 'VERSION')),
      migration.stderr || migration.stdout,
    );
  } finally {
    rmSync(migrateOk, { recursive: true, force: true });
  }
}
{
  const upgradeRoot = mkdtempSync(join(tmpdir(), 'midas-upgrade-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', upgradeRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:upgrade-fixture', install.status === 0, install.stderr || install.stdout);
    // Simulate older stamp so --update is an upgrade path (conflict checks still run).
    const statePath = join(upgradeRoot, '.harness', 'state.yaml');
    const state = readFileSync(statePath, 'utf8').replace(/midas_version:\s*\S+/, 'midas_version: 0.0.1');
    writeFileSync(statePath, state, 'utf8');
    const manifestPath = join(upgradeRoot, '.harness', 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.midas_version = '0.0.1';
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const update = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--update', '--yes', '--offline', upgradeRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const newState = readFileSync(statePath, 'utf8');
    check(
      'installer:version-upgrade-path',
      update.status === 0 &&
        !/midas_version:\s*0\.0\.1/.test(newState) &&
        /verify:\s*ok/i.test(`${update.stdout}${update.stderr}`),
      update.stderr || update.stdout,
    );
  } finally {
    rmSync(upgradeRoot, { recursive: true, force: true });
  }
}
{
  const reinstallRoot = mkdtempSync(join(tmpdir(), 'midas-reinstall-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', reinstallRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:reinstall-fixture', install.status === 0, install.stderr || install.stdout);
    const statePath = join(reinstallRoot, '.harness', 'state.yaml');
    const state = readFileSync(statePath, 'utf8').replace(/midas_version:\s*\S+/, 'midas_version: 2.6.0');
    writeFileSync(statePath, state, 'utf8');
    const manifestPath = join(reinstallRoot, '.harness', 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.midas_version = '2.6.0';
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const reinstall = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', '--yes', reinstallRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const newState = readFileSync(statePath, 'utf8');
    check(
      'installer:reinstall-stale-version-bump',
      reinstall.status === 0 &&
        !/midas_version:\s*2\.6\.0/.test(newState) &&
        /verify:\s*ok/i.test(`${reinstall.stdout}${reinstall.stderr}`),
      reinstall.stderr || reinstall.stdout,
    );
  } finally {
    rmSync(reinstallRoot, { recursive: true, force: true });
  }
}

{
  const migrateDry = mkdtempSync(join(tmpdir(), 'midas-migrate-apply-dry-'));
  try {
    mkdirSync(join(migrateDry, 'harness'), { recursive: true });
    mkdirSync(join(migrateDry, 'product'), { recursive: true });
    writeFileSync(join(migrateDry, 'harness', 'VERSION'), '1.1.4\n', 'utf8');
    writeFileSync(join(migrateDry, 'harness', 'state.yaml'), 'midas_version: 1.1.4\nlayout: classic\n', 'utf8');
    writeFileSync(join(migrateDry, 'product', 'idea.md'), '# idea\n', 'utf8');
    const before = treeDigest(migrateDry);
    const r = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--migrate', '--apply', '--dry-run', '--json', migrateDry],
      { cwd: ROOT, encoding: 'utf8' },
    );
    let envelope = null;
    try { envelope = JSON.parse(r.stdout || '{}'); } catch { /* ignore */ }
    check(
      'installer:migrate-apply-dry-run-refuses',
      r.status === 1 &&
        treeDigest(migrateDry) === before &&
        existsSync(join(migrateDry, 'harness', 'VERSION')) &&
        !existsSync(join(migrateDry, '.harness', 'engine', 'VERSION')),
      r.stderr || r.stdout,
    );
  } finally {
    rmSync(migrateDry, { recursive: true, force: true });
  }
}
{
  const dryConflict = mkdtempSync(join(tmpdir(), 'midas-update-dry-conflict-'));
  try {
    const install = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--tools=cursor', dryConflict],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check('installer:update-dry-conflict-fixture', install.status === 0, install.stderr || install.stdout);
    const vendor = join(dryConflict, '.harness', 'engine', 'conventions.md');
    if (!existsSync(vendor)) {
      check('installer:update-dry-run-reports-vendor-conflict', false, 'missing conventions.md after fixture install');
    } else {
    writeFileSync(vendor, `${readFileSync(vendor, 'utf8')}\nlocal edit\n`, 'utf8');
    const before = treeDigest(dryConflict);
    const dry = spawnSync(
      process.execPath,
      [join(ROOT, 'cli', 'index.mjs'), '--update', '--dry-run', '--offline', '--json', dryConflict],
      { cwd: ROOT, encoding: 'utf8' },
    );
    let envelope = null;
    try { envelope = JSON.parse(dry.stdout || '{}'); } catch { /* ignore */ }
    const ops = envelope?.plan?.ops || [];
    check(
      'installer:update-dry-run-reports-vendor-conflict',
      dry.status === 0 &&
        treeDigest(dryConflict) === before &&
        envelope?.ok === true &&
        ops.some((op) => op.kind === 'conflict' && op.path === '.harness/engine/conventions.md'),
      dry.stderr || dry.stdout,
    );
    }
  } finally {
    rmSync(dryConflict, { recursive: true, force: true });
  }
}
} else {
  check('installer:subprocess:skipped-MIDAS_TEST_FAST', true);
}

}
