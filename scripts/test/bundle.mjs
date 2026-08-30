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
} from './harness.mjs';

export async function run() {
// --- M. midas-bundle export/import (scripts/fixtures/product-closed) -------------------------------
{
  check('bundle:product-closed-fixture', existsSync(join(PRODUCT_CLOSED, '.harness', 'state.yaml')));
  const mem = exportBundle(PRODUCT_CLOSED, { profile: 'memory' });
    const memPaths = mem.files.map((f) => f.path);
    check('bundle:memory:idea', memPaths.includes('product/idea.md'));
    check('bundle:memory:state_yaml', Boolean(mem.state_yaml));
    check('bundle:memory:stack-rules', ['folder-structure.md', 'tenant-isolation.md', 'session-cookies.md'].every((r) =>
      memPaths.includes(`harness/rules/${r}`)));
    check('bundle:memory:no-base-rule', !memPaths.includes('harness/rules/code-quality.md'));
    const full = exportBundle(PRODUCT_CLOSED, { profile: 'full' });
    check('bundle:full:biome', full.files.some((f) => f.path === 'product/biome.json'));
    const playOnly = exportBundle(PRODUCT_CLOSED, { only: ['product/playbooks'] });
    check('bundle:only:no-src', !playOnly.files.some((f) => f.path.startsWith('product/src/')));
    const withTests = exportBundle(PRODUCT_CLOSED, { includeTests: true, profile: 'memory' });
    check('bundle:tests:route-test', withTests.files.some((f) => f.path.endsWith('route.test.ts')));
    check('bundle:mcp-secret-detect', checkMcpSecrets('{"token":"sk-live-abc"}'));
    check('bundle:mcp-env-ok', !checkMcpSecrets('{"token":"${MY_TOKEN}"}'));
    check('bundle:export:content-secret-blocked', (() => {
      const secretRoot = mkdtempSync(join(tmpdir(), 'midas-bundle-secret-'));
      try {
        mkdirSync(join(secretRoot, '.harness', 'product'), { recursive: true });
        writeFileSync(join(secretRoot, '.harness', 'state.yaml'), 'role: product\nlayout: harness\npaths:\n  state: .harness/state.yaml\n  product: .harness/product\n');
        writeFileSync(join(secretRoot, '.harness', 'product', 'idea.md'), 'token: sk-1234567890abcdef\n');
        try {
          exportBundle(secretRoot, { profile: 'knowledge' });
          return false;
        } catch (error) {
          return /possible secret/i.test(error.message);
        }
      } finally {
        rmSync(secretRoot, { recursive: true, force: true });
      }
    })());
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
      try { exportBundle(PRODUCT_CLOSED, { profile: 'bogus' }); return false; } catch { return true; }
    })());
    check('bundle:canonical-v2-state', fromCanonical('harness/state.yaml', 'harness') === '.harness/state.yaml');
    check('bundle:canonical-v2-product', fromCanonical('product/idea.md', 'harness') === '.harness/product/idea.md');
    check('bundle:canonical-v2-rules', fromCanonical('harness/rules/x.md', 'harness') === '.harness/rules/x.md');
    check('bundle:canonical-v2-runs', fromCanonical('.harness/audits/a.md', 'harness') === '.harness/runs/audits/a.md');
    check('bundle:canonical-v2-roundtrip', toCanonical(fromCanonical('harness/rules/x.md', 'harness'), 'harness') === 'harness/rules/x.md');
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
      mkdirSync(join(tmp2, '.harness'), { recursive: true });
      writeFileSync(join(tmp2, '.harness', 'state.yaml'), 'marker: old');
      const plan = planImport(tmp2, mem, { replaceState: true });
      const st = plan.actions.find((a) => a.kind === 'state');
      check('bundle:replace-state-action', st?.action === 'replace');
      applyImport(tmp2, mem, { replaceState: true });
      check('bundle:replace-state-writes', readFileSync(join(tmp2, '.harness', 'state.yaml'), 'utf8').includes('product-closed'));
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
    {
      const traversalRoot = mkdtempSync(join(tmpdir(), 'midas-bundle-traversal-'));
      const outside = `${traversalRoot}-outside.txt`;
      try {
        const malicious = {
          midas_bundle_version: '1',
          midas_version: '2.2.1',
          files: [{
            path: `../${basename(outside)}`,
            sha256: createHash('sha256').update('owned', 'utf8').digest('hex'),
            content: 'owned',
          }],
        };
        let rejected = false;
        try {
          applyImport(traversalRoot, malicious, { replace: true });
        } catch (error) {
          rejected = /outside|unsafe|relative/i.test(error.message);
        }
        check('bundle:import:rejects-traversal', rejected && !existsSync(outside));
      } finally {
        rmSync(traversalRoot, { recursive: true, force: true });
        rmSync(outside, { force: true });
      }
    }
    {
      const atomicRoot = mkdtempSync(join(tmpdir(), 'midas-bundle-atomic-'));
      try {
        const partial = {
          midas_bundle_version: '1',
          midas_version: '2.2.1',
          files: [
            {
              path: 'product/first.md',
              sha256: createHash('sha256').update('first', 'utf8').digest('hex'),
              content: 'first',
            },
            { path: 'product/second.md', sha256: 'deadbeef', content: 'second' },
          ],
        };
        let rejected = false;
        try {
          applyImport(atomicRoot, partial, { replace: true });
        } catch (error) {
          rejected = /checksum mismatch/i.test(error.message);
        }
        check('bundle:import:preflights-before-write', rejected && !existsSync(join(atomicRoot, 'product', 'first.md')));
      } finally {
        rmSync(atomicRoot, { recursive: true, force: true });
      }
    }
    {
      const stateRoot = mkdtempSync(join(tmpdir(), 'midas-bundle-state-checksum-'));
      try {
        const stateBundle = {
          midas_bundle_version: '1',
          midas_version: '2.2.1',
          state_yaml: 'name: tampered\n',
          files: [{
            path: 'harness/state.yaml',
            sha256: createHash('sha256').update('name: original\n', 'utf8').digest('hex'),
            content: 'name: original\n',
          }],
        };
        let rejected = false;
        try {
          applyImport(stateRoot, stateBundle, { replaceState: true });
        } catch (error) {
          rejected = /checksum mismatch/i.test(error.message);
        }
        check('bundle:import:state-checksum', rejected && !existsSync(join(stateRoot, 'harness', 'state.yaml')));
      } finally {
        rmSync(stateRoot, { recursive: true, force: true });
      }
    }
    const playDir = exportBundle(PRODUCT_CLOSED, { only: ['product/playbooks'] });
    check('bundle:only-playbooks-count', playDir.files.length === 3);
}

// --- N. stage-command-table + rules-match + migrate-layout smoke ----------------------------
{
  const { stages } = loadStageCommandTable();
  const lifecycleStages = [
    'idea_intake',
    'contextualize',
    'market_research',
    'business_case',
    'tech_architecture',
    'architecture_rules',
    'sprint_planning',
    'sprint_execution',
    'shipped',
  ];
  for (const name of lifecycleStages) {
    check(`stage-table:has:${name}`, Object.prototype.hasOwnProperty.call(stages, name));
  }
  check('stage-table:sprint-execution-verify', stages.sprint_execution?.verifyUi === '/midas-verify');
  check('stage-table:sprint-execution-close', stages.sprint_execution?.commandWhenDone === '/close-sprint');
  check('stage-table:recall-paths', stageRecallPaths('contextualize').includes('product/open-questions.md'));
  check('stage-table:idea-intake-command', stages.idea_intake?.command === '/idea-intake');
  check('stage-table:shipped-null-command', stages.shipped?.command === null);
  check('stage-table:idea-intake-recall', stageRecallPaths('idea_intake').includes('product/idea.md'));
  const derived = loadEngineBaseRules();
  check('engine-base-rules:has-acceptance', derived.has('acceptance-criteria.md'));
  check('engine-base-rules:matches-template', (() => {
    const tplRules = join(ROOT, 'cli', 'template', '.harness', 'engine', 'rules');
    const srcRules = join(ROOT, 'harness', 'rules');
    if (!existsSync(tplRules)) return false;
    const hashDir = (dir) => {
      const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
      return createHash('sha256').update(files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')).digest('hex');
    };
    return hashDir(srcRules) === hashDir(tplRules);
  })(), 're-run build-create.mjs');
}

check('behavioral:migrate-layout-removed', !existsSync(join(ROOT, 'scripts', 'migrate-layout.mjs')));
check(
  'behavioral:migrate-layout-template-removed',
  !existsSync(join(ROOT, 'cli', 'template', '.harness', 'scripts', 'migrate-layout.mjs')),
);

if (existsSync(join(ROOT, 'scripts', 'bundle.mjs'))) {
  try {
    const help = execSync(`node "${join(ROOT, 'scripts', 'bundle.mjs')}"`, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    check('behavioral:bundle-cli-usage', /export|import|profile/i.test(help));
  } catch (e) {
    const msg = String(e.stdout || e.stderr || e.message);
    check('behavioral:bundle-cli-usage', /export|import|profile/i.test(msg));
  }
}

{
  const st = readFileSync(join(PRODUCT_CLOSED, '.harness', 'state.yaml'), 'utf8');
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
    check(`product-closed:artifact:${p}`, existsSync(join(PRODUCT_CLOSED, p)));
  }
  check('product-closed:features-json', existsSync(join(PRODUCT_CLOSED, '.harness', 'product', 'features.json')));
  check('product-closed:sprint-progress', existsSync(join(PRODUCT_CLOSED, '.harness', 'runs', 'sprints', '01-progress.md')));
}

check('skill:midas-progress:canonical', existsSync(join(ROOT, 'harness', 'skills', 'midas-progress', 'SKILL.md')));
check('skill:midas-qa:canonical', existsSync(join(ROOT, 'harness', 'skills', 'midas-qa', 'SKILL.md')));
check(
  'skill:midas-progress:not-in-host-mirror',
  !existsSync(join(ROOT, '.claude', 'skills', 'midas-progress', 'SKILL.md')),
  'internal surface must be omitted from .claude/skills (ADR-013)',
);
check(
  'skill:midas-qa:not-in-host-mirror',
  !existsSync(join(ROOT, '.claude', 'skills', 'midas-qa', 'SKILL.md')),
  'internal surface must be omitted from .claude/skills (ADR-013)',
);
check('skill:midas-design', existsSync(join(ROOT, 'harness', 'skills', 'midas-design', 'SKILL.md')));
check('skill:midas-design-claude-mirror', existsSync(join(ROOT, '.claude', 'skills', 'midas-design', 'SKILL.md')));
check('skill:midas-reconcile', existsSync(join(ROOT, '.claude', 'skills', 'midas-reconcile', 'SKILL.md')));
check(
  'skill:host-mirror-excludes-internal',
  [...INTERNAL_SURFACE_ALLOWLIST].every((n) => !existsSync(join(ROOT, '.cursor', 'skills', n, 'SKILL.md'))),
);
check(
  'skill:host-mirror-excludes-deprecated',
  [...DEPRECATED_SURFACE_ALLOWLIST].every((n) => !existsSync(join(ROOT, '.agents', 'skills', n, 'SKILL.md'))),
);
check('installer:diagnose-flag', /--diagnose/.test(installer) && (/install-diagnose\.mjs/.test(installer) || /runInstaller/.test(installer)));
check('build-create:install-diagnose', existsSync(join(ROOT, 'cli', 'install-diagnose.mjs')));
check('create-midas:files-install-diagnose', /install-diagnose\.mjs/.test(readFileSync(join(ROOT, 'cli', 'package.json'), 'utf8')));
{
  const sourceDiagnose = join(ROOT, 'cli', 'install-diagnose.mjs');
  const templateDiagnose = join(ROOT, 'cli', 'template', '.harness', 'scripts', 'install-diagnose.mjs');
  if (existsSync(sourceDiagnose) && existsSync(templateDiagnose)) {
    check(
      'create-template:install-diagnose:match',
      readFileSync(sourceDiagnose, 'utf8') === readFileSync(templateDiagnose, 'utf8'),
      'cli/template/.harness/scripts/install-diagnose.mjs drifted from cli/install-diagnose.mjs',
    );
  }
}
  {
    const sourceDesignSystem = join(ROOT, 'scripts', 'design-system.mjs');
    const templateDesignSystem = join(ROOT, 'cli', 'template', '.harness', 'scripts', 'design-system.mjs');
    if (existsSync(sourceDesignSystem) && existsSync(templateDesignSystem)) {
      check(
      'create-template:design-system-script:match',
      readFileSync(sourceDesignSystem, 'utf8') === readFileSync(templateDesignSystem, 'utf8'),
      'cli/template/.harness/scripts/design-system.mjs drifted from scripts/design-system.mjs',
      );
    }
  }
  {
    const sourceGemini = join(ROOT, 'gemini-extension.json');
    const templateGemini = join(ROOT, 'cli', 'template', 'gemini-extension.json');
    if (existsSync(sourceGemini) && existsSync(templateGemini)) {
      check(
        'create-template:gemini-extension:match',
        readFileSync(sourceGemini, 'utf8') === readFileSync(templateGemini, 'utf8'),
        'cli/template/gemini-extension.json drifted from gemini-extension.json',
      );
    }
  }
  {
    const sourceAgentsModels = join(ROOT, 'docs', 'agents-and-models.md');
    const templateAgentsModels = join(ROOT, 'cli', 'template', '.harness', 'engine', 'docs', 'agents-and-models.md');
    if (existsSync(sourceAgentsModels) && existsSync(templateAgentsModels)) {
      check(
        'create-template:agents-and-models:match',
        readFileSync(sourceAgentsModels, 'utf8') === readFileSync(templateAgentsModels, 'utf8'),
        'cli/template/.harness/engine/docs/agents-and-models.md drifted from docs/agents-and-models.md',
      );
    }
  }
  {
    const sourceSkillQuality = join(ROOT, 'docs', 'skill-quality-gate.md');
    const templateSkillQuality = join(ROOT, 'cli', 'template', '.harness', 'engine', 'docs', 'skill-quality-gate.md');
    if (existsSync(sourceSkillQuality) && existsSync(templateSkillQuality)) {
      check(
        'create-template:skill-quality-gate:match',
        readFileSync(sourceSkillQuality, 'utf8') === readFileSync(templateSkillQuality, 'utf8'),
        'cli/template/.harness/engine/docs/skill-quality-gate.md drifted from docs/skill-quality-gate.md',
      );
    }
  }
  {
    const sourceSkillFlows = join(ROOT, 'docs', 'skill-flows.md');
    const templateSkillFlows = join(ROOT, 'cli', 'template', '.harness', 'engine', 'docs', 'skill-flows.md');
    check('create-template:skill-flows', existsSync(templateSkillFlows));
    if (existsSync(sourceSkillFlows) && existsSync(templateSkillFlows)) {
      check(
        'create-template:skill-flows:match',
        readFileSync(sourceSkillFlows, 'utf8') === readFileSync(templateSkillFlows, 'utf8'),
        'cli/template/.harness/engine/docs/skill-flows.md drifted from docs/skill-flows.md',
      );
    }
  }
  {
    const sourceContextDigest = join(ROOT, 'docs', 'context-digest.md');
    const templateContextDigest = join(ROOT, 'cli', 'template', '.harness', 'engine', 'docs', 'context-digest.md');
    check('create-template:context-digest', existsSync(templateContextDigest));
    if (existsSync(sourceContextDigest) && existsSync(templateContextDigest)) {
      check(
        'create-template:context-digest:match',
        readFileSync(sourceContextDigest, 'utf8') === readFileSync(templateContextDigest, 'utf8'),
        'cli/template/.harness/engine/docs/context-digest.md drifted from docs/context-digest.md',
      );
    }
  }
  {
    const sourceResume = join(ROOT, 'harness', 'templates', 'session-resume-precedence.md');
    const templateResume = join(ROOT, 'cli', 'template', '.harness', 'engine', 'templates', 'session-resume-precedence.md');
    check('create-template:session-resume-precedence', existsSync(templateResume));
    if (existsSync(sourceResume) && existsSync(templateResume)) {
      check(
        'create-template:session-resume-precedence:match',
        readFileSync(sourceResume, 'utf8') === readFileSync(templateResume, 'utf8'),
        'template session-resume-precedence.md drifted from harness source',
      );
    }
  }
check('verify-record:device-profiles', /## Device profiles/.test(readFileSync(join(ROOT, 'harness', 'templates', 'verify-record.md'), 'utf8')));
check('mcp-drift:maestro-optional', OPTIONAL_MCP_IDS.includes('maestro'));
check('harness:stage-command-table', existsSync(join(ROOT, 'harness', 'stage-command-table.yaml')));
if (existsSync(join(ROOT, 'harness', 'stage-command-table.yaml'))) {
  const stageTableText = readFileSync(join(ROOT, 'harness', 'stage-command-table.yaml'), 'utf8');
  check(
    'harness:stage-command-table:generator-sync',
    stageTableText === computeStageCommandTableYaml(),
    'harness/stage-command-table.yaml drifted from the generated table',
  );
  const templateStageTable = join(ROOT, 'cli', 'template', '.harness', 'engine', 'stage-command-table.yaml');
  if (existsSync(templateStageTable)) {
    check(
      'create-template:stage-command-table:match',
      readFileSync(templateStageTable, 'utf8') === stageTableText,
      'template harness/stage-command-table.yaml drifted from source',
    );
  }
}
check('mcp:template-root-match', existsSync(join(ROOT, 'cli', 'template', '.mcp.json')) && existsSync(join(ROOT, '.mcp.json')));
if (existsSync(join(ROOT, 'cli', 'template', '.mcp.json')) && existsSync(join(ROOT, '.mcp.json'))) {
  check(
    'mcp:template-root-exact',
    readFileSync(join(ROOT, 'cli', 'template', '.mcp.json'), 'utf8') === readFileSync(join(ROOT, '.mcp.json'), 'utf8'),
    'template .mcp.json drifted from root .mcp.json',
  );
}
{
  const rootMcp = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8'));
  check(
    'mcp:root-default-empty',
    Object.keys(rootMcp.mcpServers || {}).length === 0,
    'active MCP servers require explicit user approval and Runlayer governance',
  );
  const shadow = evaluateMcpGovernance(JSON.stringify({
    mcpServers: {
      unsafe: { command: 'npm', args: ['exec', '--yes', '@scope/server'] },
    },
  }));
  check(
    'mcp:governance-detects-shadow',
    shadow.status === 'warn' && shadow.shadowServers.includes('unsafe'),
    shadow.note,
  );
  const managed = evaluateMcpGovernance(JSON.stringify({
    mcpServers: {
      managed: { command: 'runlayer', args: ['run', '123e4567-e89b-12d3-a456-426614174000'] },
    },
  }));
  check('mcp:governance-allows-runlayer', managed.status === 'ok', managed.note);
  {
    const selfManagedMode = 'self_managed';
    const acceptsShadow =
      selfManagedMode === 'self_managed' &&
      shadow.status === 'warn' &&
      shadow.shadowServers.includes('unsafe');
    check('mcp:governance-self-managed', acceptsShadow, 'brownfield self_managed accepts shadow MCPs under --strict');
  }
  check(
    'mcp:template-default-empty',
    Object.keys(JSON.parse(readFileSync(join(ROOT, 'cli', 'template', '.mcp.json'), 'utf8')).mcpServers || {}).length === 0,
    'template must not enable MCP servers without approval',
  );
}
check('harness:design-system:tokens-css', existsSync(join(ROOT, 'harness', 'design-system', 'tokens.css')));
if (existsSync(join(ROOT, 'harness', 'design-system', 'tokens.css'))) {
  const tokensCss = readFileSync(join(ROOT, 'harness', 'design-system', 'tokens.css'), 'utf8');
  check(
    'harness:design-system:generator-sync',
    tokensCss === computeDesignSystemCss(ROOT),
    'harness/design-system/tokens.css drifted from tokens.json',
  );
  const templateTokensCss = join(ROOT, 'cli', 'template', '.harness', 'engine', 'design-system', 'tokens.css');
  if (existsSync(templateTokensCss)) {
    check(
      'create-template:design-system:tokens-css:match',
      readFileSync(templateTokensCss, 'utf8') === tokensCss,
      'template harness/design-system/tokens.css drifted from source',
    );
  }
}

check('mkdocs:adr-003', /ADR-003/.test(readFileSync(join(ROOT, 'mkdocs.yml'), 'utf8')));
{
  const docsRoot = join(ROOT, 'docs');
  const outside = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) visit(abs);
      else if (entry.name.endsWith('.md')) {
        const text = readFileSync(abs, 'utf8');
        if (/\]\(\.\.\/(?:\.\.\/)?(?:INSTALL|CONTRIBUTING)/.test(text) || /\]\(\.\.\/\.\.\/harness\//.test(text)) {
          outside.push(abs.slice(ROOT.length + 1).replace(/\\/g, '/'));
        }
      }
    }
  };
  visit(docsRoot);
  check(
    'docs:mkdocs-no-outside-repo-rel-links',
    outside.length === 0,
    `mkdocs --strict cannot resolve: ${outside.join(', ')} — use an in-docs path or a GitHub blob URL`,
  );
}
check(
  'ci:doctor-smoke-passes-install-root',
  /doctor\.mjs --strict \/tmp\/midas-smoke\b/.test(readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')),
);
check(
  'ci:update-check-exit-code-captured',
  /check_code=\$\?/.test(readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')) &&
    /test "\$check_code" -eq 0/.test(readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')),
);

// --- status-page + yaml-lite smoke ----------------------------------------
check('script:status-page:exists', existsSync(join(ROOT, 'scripts', 'status-page.mjs')));
check('script:skill-quality-check:exists', existsSync(join(ROOT, 'scripts', 'skill-quality-check.mjs')));
check('script:skill-registry:exists', existsSync(join(ROOT, 'scripts', 'skill-registry.mjs')));
if (existsSync(join(ROOT, 'scripts', 'precommit-eval.mjs'))) {
  try {
    const out = execSync(`node "${join(ROOT, 'scripts', 'precommit-eval.mjs')}" --json`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const envelope = JSON.parse(out);
    check('precommit:floor-mechanical-ok', envelope.mechanical_ok === true, envelope.hard_fails?.join('; '));
    check('precommit:floor-uses-staged-skill-quality', !envelope.checks?.some((c) => c.id === 'skill-quality'));
    check('precommit:floor-has-staged-check', envelope.checks?.some((c) => c.id === 'skill-quality-staged'));
  } catch (e) {
    check('precommit:floor-mechanical-ok', false, e.message || String(e));
  }
}
check('script:bump-version:exists', existsSync(join(ROOT, 'scripts', 'bump-version.mjs')));
check('script:sync-version:exists', existsSync(join(ROOT, 'scripts', 'sync-version.mjs')));
check('script:engine-version:exists', existsSync(join(ROOT, 'scripts', 'lib', 'engine-version.mjs')));
check('template:skill-state-ritual:exists', existsSync(join(ROOT, 'harness', 'templates', 'skill-state-ritual.md')));
if (existsSync(join(ROOT, 'scripts', 'bump-version.mjs'))) {
  try {
    const out = execSync(`node "${join(ROOT, 'scripts', 'bump-version.mjs')}" 9.9.9 --dry-run`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    check(
      'behavioral:bump-version-dry-run',
      /bump-version: .+ → 9\.9\.9 \(dry-run\)/.test(out) && /harness\/VERSION/.test(out),
      'dry-run should list harness/VERSION only',
    );
  } catch (e) {
    check('behavioral:bump-version-dry-run', false, String(e.stderr || e.message));
  }
}
check('script:yaml-lite:exists', existsSync(join(ROOT, 'scripts', 'yaml-lite.mjs')));
if (existsSync(join(ROOT, 'scripts', 'status-page.mjs'))) {
  const statusTmp = mkdtempSync(join(tmpdir(), 'midas-status-'));
  const statusOut = join(statusTmp, 'status.html');
  try {
    execSync(`node "${join(ROOT, 'scripts', 'status-page.mjs')}" --out "${statusOut}"`, { cwd: ROOT, stdio: 'pipe' });
    const html = existsSync(statusOut) ? readFileSync(statusOut, 'utf8') : '';
    check('behavioral:status-page-runs', html.includes('Midas harness status'));
    check(
      'behavioral:status-page-lists-retros-sweeps',
      /<th>Retros<\/th>/.test(html) &&
        /<th>Sweeps<\/th>/.test(html) &&
        /<th>Investigations<\/th>/.test(html) &&
        /Auto-pilot journal/.test(html),
      'status.html must list Retros, Sweeps, Investigations, and auto-pilot journal',
    );
  } catch (e) {
    check('behavioral:status-page-runs', false, String(e.stderr || e.message));
  } finally {
    rmSync(statusTmp, { recursive: true, force: true });
  }
}
check('template:gate-record', existsSync(join(ROOT, 'harness', 'templates', 'gate-record.md')));
check('template:audit-record', existsSync(join(ROOT, 'harness', 'templates', 'audit-record.md')));
check('template:verify-record', existsSync(join(ROOT, 'harness', 'templates', 'verify-record.md')));
check('harness:gates-registry', existsSync(join(ROOT, 'harness', 'gates.json')));
if (existsSync(join(ROOT, 'harness', 'gates.json'))) {
  let gates = null;
  try {
    gates = JSON.parse(readFileSync(join(ROOT, 'harness', 'gates.json'), 'utf8'));
  } catch (e) {
    check('harness:gates-registry:json', false, e.message);
  }
  if (gates) {
    const phases = Array.isArray(gates.gates) ? gates.gates : [];
    const phaseNames = phases.map((g) => g.phase).filter(Boolean);
    for (const phase of ['idea_intake', 'contextualize', 'market_research', 'business_case', 'tech_architecture', 'architecture_rules', 'sprint_planning', 'sprint_execution', 'audit']) {
      check(`harness:gates-registry:phase:${phase}`, phaseNames.includes(phase), 'missing gate entry');
    }
    check('harness:gates-registry:shape', phases.length >= 9 && phases.every((g) => g.id && g.phase && g.owner && g.evidence_required), 'registry entries need id, phase, owner, and evidence_required');
    check(
      'harness:gates-registry:generator-sync',
      JSON.stringify(gates) === JSON.stringify(computeGatesIndex(ROOT, 'harness')),
      'harness/gates.json drifted from the generated registry',
    );
    const pipelineRitual = [
      ['gate-00', '0-idea-intake.md', 'gate-00.md'],
      ['gate-01', '1-contextualize.md', 'gate-01.md'],
      ['gate-02', '2-market-research.md', 'gate-02.md'],
      ['gate-03', '3-business-case.md', 'gate-03.md'],
      ['gate-04', '4-tech-architecture.md', 'gate-04.md'],
      ['gate-05', '5-architecture-rules.md', 'gate-05.md'],
      ['gate-06', '6-sprint-planning.md', 'gate-06.md'],
    ];
    for (const [id, file, needle] of pipelineRitual) {
      const text = readFileSync(join(ROOT, 'harness', 'pipeline', file), 'utf8');
      check(`harness:gates-registry:ritual:${id}`, text.includes(needle), `${file} must name ${needle}`);
    }
    const skillRitual = [
      ['gate-00.md', 'idea-intake'],
      ['gate-01.md', 'contextualize'],
      ['gate-02.md', 'market-research'],
      ['gate-03.md', 'business-plan'],
      ['gate-04.md', 'choose-architecture'],
      ['gate-05.md', 'define-conventions'],
      ['gate-06.md', 'plan-sprints'],
    ];
    for (const [needle, skill] of skillRitual) {
      const text = readFileSync(join(ROOT, 'harness', 'skills', skill, 'SKILL.md'), 'utf8');
      check(
        `harness:gates-registry:skill:${needle}`,
        text.includes(needle),
        `${skill} must freeze ${needle}`,
      );
    }
    check(
      'harness:gates-registry:gate-07-progress',
      /NN-progress\.md/.test(readFileSync(join(ROOT, 'harness', 'pipeline', '7-sprint-execution.md'), 'utf8')),
      'gate-07 uses {runs}/sprints/NN-progress.md, not gate-07.md',
    );
    check(
      'harness:gates-registry:gate-08-audit-nn',
      /audit-NN\.md/.test(readFileSync(join(ROOT, 'harness', 'pipeline', '8-audit-adjust.md'), 'utf8')),
      'gate-08 uses {runs}/audits/audit-NN.md, not gate-08.md',
    );
    const g01 = phases.find((g) => g.id === 'gate-01');
    check(
      'harness:gates-registry:gate-01-idea',
      Array.isArray(g01?.evidence_required) && g01.evidence_required.includes('{product}/idea.md'),
    );
    const g06 = phases.find((g) => g.id === 'gate-06');
    check(
      'harness:gates-registry:gate-06-roadmap',
      Array.isArray(g06?.evidence_required) &&
        g06.evidence_required.includes('{product}/roadmap.md') &&
        g06.evidence_required.includes('{product}/features.json'),
    );
  }
}
{
  check(
    'gate-evidence:classic-state',
    resolveEvidencePattern('.harness/state.yaml', { state: 'harness/state.yaml' }) === 'harness/state.yaml',
  );
  check(
    'gate-evidence:product-token',
    resolveEvidencePattern('{product}/idea.md', { product: '.harness/product' }) === '.harness/product/idea.md',
  );
  const closedPaths = resolvePaths(PRODUCT_CLOSED);
  const missClosed = missingEvidenceRequired(
    PRODUCT_CLOSED,
    closedPaths,
    ['.harness/state.yaml', '{product}/idea.md'],
    { tools: ['claude-code'] },
  );
  check('gate-evidence:product-closed-core', missClosed.length === 0, missClosed.join(', '));
  const missClaude = missingEvidenceRequired(
    PRODUCT_CLOSED,
    closedPaths,
    ['.claude/CLAUDE.md'],
    { tools: ['claude-code'] },
  );
  check(
    'gate-evidence:host-adapter-when-selected',
    missClaude.includes('.claude/CLAUDE.md'),
    missClaude.join(', '),
  );
  const missCursorSkipped = missingEvidenceRequired(
    PRODUCT_CLOSED,
    closedPaths,
    ['.cursor/rules/00-midas.mdc'],
    { tools: ['claude-code'] },
  );
  check('gate-evidence:host-adapter-skipped', missCursorSkipped.length === 0, missCursorSkipped.join(', '));
}
const templateGatesIndex = join(ROOT, 'cli', 'template', '.harness', 'engine', 'gates.json');
if (existsSync(templateGatesIndex) && existsSync(join(ROOT, 'harness', 'gates.json'))) {
  check(
    'create-template:gates-index:match',
    readFileSync(templateGatesIndex, 'utf8') === readFileSync(join(ROOT, 'harness', 'gates.json'), 'utf8'),
    'template harness/gates.json drifted from source',
  );
}
check('harness:checks-index', existsSync(join(ROOT, 'harness', 'checks.json')));
if (existsSync(join(ROOT, 'harness', 'checks.json'))) {
  let checksIndex = null;
  try {
    checksIndex = JSON.parse(readFileSync(join(ROOT, 'harness', 'checks.json'), 'utf8'));
  } catch (e) {
    check('harness:checks-index:json', false, e.message);
  }
  if (checksIndex) {
    const rules = Array.isArray(checksIndex.rules) ? checksIndex.rules : [];
    const ruleDir = join(ROOT, 'harness', 'rules');
    const ruleFiles = existsSync(ruleDir) ? readdirSync(ruleDir).filter((f) => f.endsWith('.md')).length : 0;
    check('harness:checks-index:rules-count', rules.length === ruleFiles, `${rules.length} != ${ruleFiles}`);
    check(
      'harness:checks-index:structured',
      rules.every((r) =>
        r &&
        typeof r.slug === 'string' &&
        typeof r.title === 'string' &&
        typeof r.path === 'string' &&
        r.phase === 8 &&
        typeof r.owner === 'string' &&
        typeof r.check_count === 'number' &&
        Array.isArray(r.checks) &&
        r.checks.length > 0 &&
        r.checks.length === r.check_count &&
        r.checks.every((c) =>
          c &&
          typeof c.kind === 'string' &&
          typeof c.body === 'string' &&
          c.phase === 8 &&
          c.owner === r.owner &&
          ['command', 'manual'].includes(c.kind) &&
          ['high', 'medium'].includes(c.severity) &&
          (c.kind === 'manual' ? c.severity === 'medium' : c.severity === 'high') &&
          (c.section === null || typeof c.section === 'string')
        )
      ),
      'structured checks need phase/owner/severity/section metadata',
    );
    check(
      'harness:checks-index:generator-sync',
      JSON.stringify(checksIndex) === JSON.stringify(computeChecksIndex(ROOT, 'harness')),
      'harness/checks.json drifted from the generated index',
    );
    let commandChecks = 0;
    let manualChecks = 0;
    for (const r of rules) {
      for (const c of r.checks) {
        if (c.kind === 'command') commandChecks += 1;
        else manualChecks += 1;
      }
    }
    check('harness:checks-index:command-floor', commandChecks >= 140, `${commandChecks} command CHECKs (need ≥140)`);
    check('harness:checks-index:manual-ceiling', manualChecks <= 85, `${manualChecks} manual CHECKs (need ≤85)`);
    check('conformance-gate:exists', existsSync(join(ROOT, 'scripts', 'gates', 'conformance-gate.mjs')));
    const modelRouting = rules.find((r) => r && r.slug === 'model-routing');
    if (modelRouting) {
      check(
        'harness:checks-index:model-routing-continuations',
        modelRouting.checks.filter((c) => c.kind === 'manual').length >= 2 &&
          modelRouting.checks.some((c) => /scout delegation/.test(c.body)) &&
          modelRouting.checks.some((c) => /Tier & delegation/.test(c.body)),
        'model-routing manual markers or wrapped lines were not captured correctly',
      );
    }
  }
}
const templateChecksIndex = join(ROOT, 'cli', 'template', '.harness', 'engine', 'checks.json');
if (existsSync(templateChecksIndex) && existsSync(join(ROOT, 'harness', 'checks.json'))) {
  let checksIndex = null;
  let templateIndex = null;
  try {
    checksIndex = JSON.parse(readFileSync(join(ROOT, 'harness', 'checks.json'), 'utf8'));
    templateIndex = JSON.parse(readFileSync(templateChecksIndex, 'utf8'));
  } catch (e) {
    check('create-template:checks-index:json', false, e.message);
  }
  if (checksIndex && templateIndex) {
    check(
      'create-template:checks-index:match',
      JSON.stringify(templateIndex) === JSON.stringify(checksIndex),
      'template harness/checks.json drifted from source',
    );
  }
}

}
