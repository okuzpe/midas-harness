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
import { resetSandbox, inspectSandboxEnv, isPathInside, gradeSandbox, parseGradeArgs, ACTIVE_RUN_REL } from '../sandbox-run.mjs';
import { loadOracleDoc } from '../lib/sandbox-grade.mjs';
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
// --- D. generated adapters in sync with source -------------------------------------------------
for (const f of computeAdapters(ROOT).files) {
  const onDisk = existsSync(f.abs) ? readFileSync(f.abs, 'utf8') : null;
  check(`adapter-sync:${f.path}`, onDisk === f.content, onDisk === null ? 'missing' : 'drift');
}

// --- E. plugin tree matches .claude/ -----------------------------------------------------------
const pluginSkills = join(ROOT, 'harness', 'plugins', 'midas', 'skills');
const pluginAgents = join(ROOT, 'harness', 'plugins', 'midas', 'agents');
if (existsSync(join(ROOT, 'harness', 'plugins', 'midas'))) {
  const shippedSkills = dirNames(skillsDir).filter(
    (n) => !ENGINE_ONLY_SKILLS.includes(n) && !isHostMirrorExcluded(n),
  );
  check('plugin:skills-match', JSON.stringify(dirNames(pluginSkills)) === JSON.stringify(shippedSkills), 're-run build-plugin.mjs');
  for (const name of ENGINE_ONLY_SKILLS) {
    check(`plugin:excludes-${name}`, !existsSync(join(pluginSkills, name)));
  }
  check(
    'plugin:excludes-host-picker-internal',
    [...INTERNAL_SURFACE_ALLOWLIST].every((n) => !existsSync(join(pluginSkills, n))),
  );
  const srcAgents = walk(agentsDir).map((p) => basename(p)).sort();
  const plgAgents = walk(pluginAgents).map((p) => basename(p)).sort();
  check('plugin:agents-match', JSON.stringify(srcAgents) === JSON.stringify(plgAgents), 're-run build-plugin.mjs');
  const pluginJson = join(ROOT, 'harness', 'plugins', 'midas', '.claude-plugin', 'plugin.json');
  if (existsSync(pluginJson)) {
    check(
      'plugin:manifest-json',
      readFileSync(pluginJson, 'utf8') === JSON.stringify(computePluginManifest(), null, 2) + '\n',
      're-run build-plugin.mjs',
    );
  }
  const pluginReadme = join(ROOT, 'harness', 'plugins', 'midas', 'README.md');
  if (existsSync(pluginReadme)) {
    check(
      'plugin:readme',
      readFileSync(pluginReadme, 'utf8') === computePluginReadme(),
      're-run build-plugin.mjs',
    );
  }
  const marketplaceJson = join(ROOT, 'harness', '.claude-plugin', 'marketplace.json');
  if (existsSync(marketplaceJson)) {
    check(
      'plugin:marketplace-json',
      readFileSync(marketplaceJson, 'utf8') === JSON.stringify(computeMarketplaceJson(), null, 2) + '\n',
      're-run build-plugin.mjs',
    );
  }
  const sourceClaude = join(ROOT, '.claude');
  const pluginClaude = join(ROOT, 'harness', 'plugins', 'midas', '.claude');
  if (existsSync(sourceClaude) && existsSync(pluginClaude)) {
    const sourceFiles = walkRelativeFiles(sourceClaude);
    const pluginFiles = walkRelativeFiles(pluginClaude);
    const sameShape = JSON.stringify(sourceFiles) === JSON.stringify(pluginFiles);
    const sameContent = sameShape && sourceFiles.every(
      (rel) => readFileSync(join(sourceClaude, rel), 'utf8') === readFileSync(join(pluginClaude, rel), 'utf8'),
    );
    check(
      'plugin:claude-tree-match',
      sameShape && sameContent,
      'harness/plugins/midas/.claude drifts from source .claude',
    );
  }
}

// --- E2. create-midas bundled template matches source -----------------------------------------
const tplRoot = join(ROOT, 'cli', 'template');
if (existsSync(tplRoot)) {
  check(
    'create-template:skills-match',
    JSON.stringify(dirNames(join(tplRoot, '.claude', 'skills'))) ===
      JSON.stringify(dirNames(skillsDir).filter((n) => !ENGINE_ONLY_SKILLS.includes(n) && !isHostMirrorExcluded(n))),
    're-run build-create.mjs',
  );
  for (const f of ['AGENTS.md', '.mcp.json', '.harness/engine/methodology.md', '.harness/engine/conventions.md', '.harness/engine/gates.json', '.harness/engine/checks.json', '.harness/engine/skill-registry.md', '.harness/engine/stage-command-table.yaml', '.harness/scripts/render-adapters.mjs', '.harness/scripts/yaml-lite.mjs', '.harness/scripts/mcp-drift.mjs', '.harness/scripts/mcp-cursor-sync.mjs', '.harness/scripts/tool-profiles.mjs', '.harness/scripts/model-profiles.mjs', '.harness/scripts/portable-skills.mjs', '.harness/scripts/gitignore-merge.mjs', '.harness/scripts/paths.mjs', '.harness/scripts/stage-command-table.mjs', '.harness/scripts/design-system.mjs', '.harness/scripts/doctor.mjs', '.harness/scripts/status-page.mjs', '.harness/scripts/skill-quality-check.mjs', '.harness/scripts/skill-registry.mjs', '.harness/scripts/bundle.mjs', '.harness/scripts/ownership-manifest.mjs', '.harness/scripts/trace-write.mjs', '.harness/scripts/trace-inspect.mjs', '.harness/scripts/trace-hook.mjs', '.harness/scripts/lib/trace-models.mjs', '.harness/scripts/lib/trace-store.mjs', '.harness/engine/docs/agents-and-models.md', '.harness/engine/docs/skill-quality-gate.md', '.harness/engine/docs/skill-flows.md', '.harness/engine/docs/skills.md']) {
    check(`create-template:has:${f}`, existsSync(join(tplRoot, f)));
  }
  // The template must NOT carry repo-internal trees into a user project.
  for (const d of ['docs/research', '.github', 'cli']) {
    check(`create-template:excludes:${d}`, !existsSync(join(tplRoot, d)));
  }
  check('layout:no-legacy-root-plugins-dir', !existsSync(join(ROOT, 'plugins')));
  check('layout:no-legacy-examples-dir', !existsSync(join(ROOT, 'examples')));
  check(
    'create-template:engine-excludes-plugins',
    !existsSync(join(tplRoot, '.harness', 'engine', 'plugins')),
  );
  check(
    'layout:product-closed-fixture',
    existsSync(join(PRODUCT_CLOSED, '.harness', 'state.yaml')),
  );
  {
    const seedState = join(ROOT, 'sandbox', 'seed', '.harness', 'state.yaml');
    const seedYaml = existsSync(seedState) ? readFileSync(seedState, 'utf8') : '';
    check('sandbox:seed-state', existsSync(seedState));
    check('sandbox:seed-idea', existsSync(join(ROOT, 'sandbox', 'seed', '.harness', 'product', 'idea.md')));
    check('sandbox:seed-name', /^name:\s*sandbox-example\s*$/m.test(seedYaml));
    check('sandbox:seed-cost-balanced', /^cost_profile:\s*balanced\s*$/m.test(seedYaml));
    check(
      'sandbox:gitignore-working-copy',
      /sandbox\/example-product\//.test(readFileSync(join(ROOT, '.gitignore'), 'utf8')),
    );
    const ideaIntakeSkill = readFileSync(join(ROOT, 'harness', 'skills', 'idea-intake', 'SKILL.md'), 'utf8');
    const playbook0 = readFileSync(join(ROOT, 'harness', 'pipeline', '0-idea-intake.md'), 'utf8');
    check(
      'idea-intake:freeze-gate-00',
      /\{runs\}\/audits\/gate-00\.md/.test(ideaIntakeSkill),
    );
    check(
      'idea-intake:askquestion-mode',
      /Confirm via `AskQuestion`/.test(ideaIntakeSkill) && !/Confirm via `AskUserQuestion`/.test(ideaIntakeSkill),
    );
    const contextualizeSkill = readFileSync(join(ROOT, 'harness', 'skills', 'contextualize', 'SKILL.md'), 'utf8');
    const businessPlanSkill = readFileSync(join(ROOT, 'harness', 'skills', 'business-plan', 'SKILL.md'), 'utf8');
    check(
      'contextualize:askquestion-batches',
      /Use `AskQuestion`/.test(contextualizeSkill) && !/Use `AskUserQuestion`/.test(contextualizeSkill),
    );
    check(
      'choose-architecture:askquestion-forks',
      /ask via `AskQuestion`/.test(readFileSync(join(ROOT, 'harness', 'skills', 'choose-architecture', 'SKILL.md'), 'utf8')) &&
        !/ask via `AskUserQuestion`/.test(readFileSync(join(ROOT, 'harness', 'skills', 'choose-architecture', 'SKILL.md'), 'utf8')),
    );
    check(
      'define-conventions:askquestion-direction',
      /Ask human via `AskQuestion`/.test(readFileSync(join(ROOT, 'harness', 'skills', 'define-conventions', 'SKILL.md'), 'utf8')) &&
        !/Ask human via `AskUserQuestion`/.test(readFileSync(join(ROOT, 'harness', 'skills', 'define-conventions', 'SKILL.md'), 'utf8')),
    );
    check(
      'playbook-4:askquestion',
      /ask via `AskQuestion`/.test(readFileSync(join(ROOT, 'harness', 'pipeline', '4-tech-architecture.md'), 'utf8')) &&
        !/ask via `AskUserQuestion`/.test(readFileSync(join(ROOT, 'harness', 'pipeline', '4-tech-architecture.md'), 'utf8')),
    );
    check(
      'playbook-0:pitch-heading',
      /## 1-line pitch/.test(playbook0) && !/## One-line pitch/.test(playbook0),
    );
    check(
      'playbook-0:no-blank-state-overwrite',
      /already exists from `\/midas-init`/.test(playbook0) &&
        !/Create or overwrite `paths\.state`/.test(playbook0),
    );
    const playbook2 = readFileSync(join(ROOT, 'harness', 'pipeline', '2-market-research.md'), 'utf8');
    const marketSkill = readFileSync(join(ROOT, 'harness', 'skills', 'market-research', 'SKILL.md'), 'utf8');
    check(
      'playbook-2:template-headings',
      /## Market overview/.test(playbook2) &&
        /## Competitive landscape/.test(playbook2) &&
        /## Top 3 risks/.test(playbook2) &&
        !/## Market snapshot/.test(playbook2),
    );
    check(
      'market-research:template-headings',
      /## Market overview/.test(marketSkill) &&
        /## Competitive landscape/.test(marketSkill) &&
        !/## Market snapshot/.test(marketSkill),
    );
    const playbook3 = readFileSync(join(ROOT, 'harness', 'pipeline', '3-business-case.md'), 'utf8');
    check(
      'playbook-3:template-headings',
      /## Revenue \/ cost model/.test(playbook3) &&
        /## Human sign-off/.test(playbook3) &&
        /via `AskQuestion`/.test(playbook3) &&
        !/human_approved: true/.test(playbook3) &&
        !/## Revenue \/ sustainability model/.test(playbook3),
    );
    check(
      'business-plan:no-human-approved-key',
      /## Human sign-off/.test(businessPlanSkill) && !/human_approved: true/.test(businessPlanSkill),
    );
    const playbook4 = readFileSync(join(ROOT, 'harness', 'pipeline', '4-tech-architecture.md'), 'utf8');
    const archSkill = readFileSync(join(ROOT, 'harness', 'skills', 'choose-architecture', 'SKILL.md'), 'utf8');
    check(
      'playbook-4:template-headings',
      /## Architecture diagram/.test(playbook4) &&
        /## Stack decisions/.test(playbook4) &&
        !/## System diagram/.test(playbook4),
    );
    check(
      'choose-architecture:template-headings',
      /## Architecture diagram/.test(archSkill) &&
        /## Stack decisions/.test(archSkill) &&
        !/## System diagram/.test(archSkill),
    );
    const playbook6 = readFileSync(join(ROOT, 'harness', 'pipeline', '6-sprint-planning.md'), 'utf8');
    const planSkill = readFileSync(join(ROOT, 'harness', 'skills', 'plan-sprints', 'SKILL.md'), 'utf8');
    check(
      'playbook-6:template-headings',
      /## Definition of Done \(DoD\)/.test(playbook6) &&
        /## Sprint sequence/.test(playbook6) &&
        /template table/.test(playbook6) &&
        !/checkbox list of concrete tasks/.test(playbook6),
    );
    check(
      'plan-sprints:template-headings',
      /## Definition of Done \(DoD\)/.test(planSkill) &&
        !/Scope \/ non-scope/.test(planSkill),
    );
    check(
      'sandbox:gitignore-active-run',
      /sandbox\/findings\/_active-run\.json/.test(readFileSync(join(ROOT, '.gitignore'), 'utf8')),
    );
    check(
      'sandbox:tally-line',
      /MIDAS_SANDBOX_RESULT:/.test(readFileSync(join(ROOT, 'harness', 'templates', 'audit-checklists.md'), 'utf8')),
    );
    check(
      'sandbox:oracle-tally-line',
      /MIDAS_SANDBOX_ORACLE:/.test(readFileSync(join(ROOT, 'harness', 'templates', 'audit-checklists.md'), 'utf8')),
    );
    check('sandbox:oracle-isolation-file', existsSync(join(ROOT, 'sandbox', 'oracles', 'isolation.json')));
    check('sandbox:oracle-idea-intake-file', existsSync(join(ROOT, 'sandbox', 'oracles', 'idea-intake.json')));
    check('sandbox:oracle-contextualize-file', existsSync(join(ROOT, 'sandbox', 'oracles', 'contextualize.json')));
    check('sandbox:oracle-market-research-file', existsSync(join(ROOT, 'sandbox', 'oracles', 'market-research.json')));
    check('sandbox:oracle-business-plan-file', existsSync(join(ROOT, 'sandbox', 'oracles', 'business-plan.json')));
    check('sandbox:oracle-choose-architecture-file', existsSync(join(ROOT, 'sandbox', 'oracles', 'choose-architecture.json')));
    check('sandbox:oracle-define-conventions-file', existsSync(join(ROOT, 'sandbox', 'oracles', 'define-conventions.json')));
    check('sandbox:oracle-plan-sprints-file', existsSync(join(ROOT, 'sandbox', 'oracles', 'plan-sprints.json')));
    const sandboxSkill = readFileSync(join(ROOT, 'harness', 'skills', 'midas-sandbox', 'SKILL.md'), 'utf8');
    check(
      'sandbox:skill-always-reset',
      /\*\*Always\*\* `node scripts\/sandbox-run.mjs reset`/.test(sandboxSkill),
    );
        check(
          'sandbox:skill-trace-root-not-exported',
          /does not export it to the Task/.test(sandboxSkill) &&
            /\{cache\}\/MIDAS_TRACE_ROOT/.test(sandboxSkill) &&
            !/sets `MIDAS_TRACE_ROOT` to the working copy/.test(sandboxSkill),
        );
    check(
      'sandbox:skill-grades-after-task',
      /sandbox-run.mjs grade --skill/.test(sandboxSkill),
    );
    check('sandbox:skill-missing-skip', /--missing skip/.test(sandboxSkill));
    check(
      'sandbox:skill-empty-idea-flag',
      /reset --empty-idea/.test(sandboxSkill) && /capture/.test(sandboxSkill),
    );
    check(
      'sandbox:skill-grade-after-each',
      /After \*\*each\*\* skill Task/.test(sandboxSkill) &&
        /while fixture `stage` is still `contextualize`/.test(sandboxSkill),
    );
    check(
      'sandbox:seed-not-shipped-script',
      !scriptBundleFiles().includes('sandbox-run.mjs'),
    );
    const reset = resetSandbox(ROOT);
    check('sandbox:reset-seed', reset.ok && existsSync(join(reset.work, '.harness', 'state.yaml')), reset.error || '');
    const seedIdea = readFileSync(join(reset.work, '.harness', 'product', 'idea.md'), 'utf8');
    check(
      'sandbox:seed-idea-filled',
      /A single-user local chore list/.test(seedIdea) && !/<!-- TODO: one sentence/.test(seedIdea),
    );
    const env = inspectSandboxEnv(ROOT);
    check('sandbox:env-ok', env.ok, env.error || '');
    check('sandbox:env-name', env.name === 'sandbox-example', env.name);
    check(
      'sandbox:env-engine-is-repo-harness',
      env.ok && env.engine === resolve(ROOT, 'harness'),
      env.engine,
    );
    check('sandbox:env-trace-root', env.ok && env.midasTraceRoot === reset.work, env.midasTraceRoot);
    check(
      'sandbox:is-path-inside',
      isPathInside(reset.work, join(reset.work, '.harness', 'state.yaml')),
    );
    check(
      'sandbox:is-path-outside-engine-state',
      !isPathInside(reset.work, join(ROOT, 'harness', 'state.yaml')),
    );
    {
      const workState = join(reset.work, '.harness', 'state.yaml');
      const original = readFileSync(workState, 'utf8');
      writeFileSync(
        workState,
        original.replace(/^  state:\s*\.harness\/state\.yaml\s*$/m, '  state: ../../harness/state.yaml'),
        'utf8',
      );
      const redirected = inspectSandboxEnv(ROOT);
      check(
        'sandbox:env-rejects-state-outside-work',
        redirected.ok === false && /outside working copy/.test(redirected.error || ''),
        redirected.error || 'expected isolation fail',
      );
      writeFileSync(workState, original.replace(/^name:\s*sandbox-example\s*$/m, 'name: harness'), 'utf8');
      const badName = inspectSandboxEnv(ROOT);
      check(
        'sandbox:env-rejects-wrong-name',
        badName.ok === false && badName.name === 'harness',
        badName.error || badName.name,
      );
      const restored = resetSandbox(ROOT);
      check('sandbox:reset-after-negative', restored.ok && inspectSandboxEnv(ROOT).ok);
      check(
        'sandbox:baseline-after-reset',
        existsSync(join(restored.work, '.harness', 'cache', 'sandbox-baseline.json')),
      );
      const baselineJson = JSON.parse(
        readFileSync(join(restored.work, '.harness', 'cache', 'sandbox-baseline.json'), 'utf8'),
      );
      check(
        'sandbox:baseline-skills-hash',
        typeof baselineJson.engineSkillsSha256 === 'string' && baselineJson.engineSkillsSha256.length === 64,
      );
      check(
        'sandbox:baseline-rules-hash',
        typeof baselineJson.engineRulesSha256 === 'string' && baselineJson.engineRulesSha256.length === 64,
      );
      check(
        'sandbox:baseline-fixture-updated',
        baselineJson.fixtureUpdated === '2026-08-28',
        String(baselineJson.fixtureUpdated),
      );
      check(
        'sandbox:baseline-fixture-state-hash',
        typeof baselineJson.fixtureStateSha256 === 'string' && baselineJson.fixtureStateSha256.length === 64,
      );
      const isolationGrade = gradeSandbox({ root: ROOT, skill: 'isolation', ledger: false });
      check(
        'sandbox:grade-isolation-ok',
        isolationGrade.ok === true && isolationGrade.isolation === 'ok',
        isolationGrade.tally,
      );
      {
        const start = spawnSync(process.execPath, [join(ROOT, 'scripts', 'sandbox-run.mjs'), 'start-run'], {
          cwd: ROOT,
          encoding: 'utf8',
        });
        const tracesCurrent = join(restored.work, '.harness', 'cache', 'traces', 'current.json');
        let started = {};
        try {
          started = JSON.parse(String(start.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
        } catch {
          started = {};
        }
        check(
          'sandbox:start-run',
          start.status === 0 && Boolean(started.session_id && started.run_id),
          start.stderr || start.stdout,
        );
        check('sandbox:start-run-current', existsSync(tracesCurrent), tracesCurrent);
        check(
          'sandbox:start-run-not-engine',
          !started.session_id ||
            !existsSync(join(ROOT, 'runs', 'cache', 'traces', `session-${started.session_id}`)),
        );
        check('sandbox:active-run-sidecar', existsSync(join(ROOT, ACTIVE_RUN_REL)));
        check(
          'sandbox:start-run-trace-root-file',
          readFileSync(join(restored.work, '.harness', 'cache', 'MIDAS_TRACE_ROOT'), 'utf8').trim() ===
            restored.work,
        );
        const finish = spawnSync(process.execPath, [join(ROOT, 'scripts', 'sandbox-run.mjs'), 'finish'], {
          cwd: ROOT,
          encoding: 'utf8',
        });
        check(
          'sandbox:finish-active',
          finish.status === 0 && /"session_id"/.test(finish.stdout) && !/"reason":"no-active-run"/.test(finish.stdout),
          finish.stderr || finish.stdout,
        );
        check('sandbox:active-run-cleared', !existsSync(join(ROOT, ACTIVE_RUN_REL)));
        const finishIdle = spawnSync(process.execPath, [join(ROOT, 'scripts', 'sandbox-run.mjs'), 'finish'], {
          cwd: ROOT,
          encoding: 'utf8',
        });
        check(
          'sandbox:finish-idle',
          finishIdle.status === 1 && /no-active-run/.test(`${finishIdle.stdout}\n${finishIdle.stderr}`),
          finishIdle.stderr || finishIdle.stdout,
        );
      }
      const graded = gradeSandbox({ root: ROOT, skill: 'idea-intake', ledger: false });
      check('sandbox:grade-seed-idea-intake-fails', graded.ok === false, graded.tally);
      check(
        'sandbox:grade-seed-idea-intake-pitch-already-ok',
        graded.checks.some((c) => c.id === 'pitch-not-todo' && c.ok),
        graded.tally,
      );
      {
        const emptied = resetSandbox(ROOT, { emptyIdea: true });
        check('sandbox:reset-empty-idea', emptied.ok, emptied.error || '');
        const blankIdea = readFileSync(join(emptied.work, '.harness', 'product', 'idea.md'), 'utf8');
        check(
          'sandbox:empty-idea-has-todos',
          /<!-- TODO: one sentence/.test(blankIdea) &&
            /<!-- TODO: paste or transcribe/.test(blankIdea) &&
            !/\{\{PROJECT_NAME\}\}/.test(blankIdea),
        );
        const gradedEmpty = gradeSandbox({ root: ROOT, skill: 'idea-intake', ledger: false });
        check(
          'sandbox:grade-empty-idea-pitch-todo',
          gradedEmpty.ok === false &&
            gradedEmpty.checks.some((c) => c.id === 'pitch-not-todo' && !c.ok) &&
            gradedEmpty.checks.some((c) => c.id === 'raw-not-todo' && !c.ok),
          gradedEmpty.tally,
        );
        resetSandbox(ROOT);
      }
      const gradedCtx = gradeSandbox({ root: ROOT, skill: 'contextualize', ledger: false });
      check(
        'sandbox:grade-seed-contextualize-fails',
        gradedCtx.ok === false && gradedCtx.checks.some((c) => c.id === 'stage-advanced' && !c.ok),
        gradedCtx.tally,
      );
      const gradedMarket = gradeSandbox({ root: ROOT, skill: 'market-research', ledger: false });
      check(
        'sandbox:grade-seed-market-research-fails',
        gradedMarket.ok === false && gradedMarket.checks.some((c) => c.id === 'market-file' && !c.ok),
        gradedMarket.tally,
      );
      const gradedPlan = gradeSandbox({ root: ROOT, skill: 'business-plan', ledger: false });
      check(
        'sandbox:grade-seed-business-plan-fails',
        gradedPlan.ok === false && gradedPlan.checks.some((c) => c.id === 'plan-file' && !c.ok),
        gradedPlan.tally,
      );
      const gradedArch = gradeSandbox({ root: ROOT, skill: 'choose-architecture', ledger: false });
      check(
        'sandbox:grade-seed-choose-architecture-fails',
        gradedArch.ok === false && gradedArch.checks.some((c) => c.id === 'arch-file' && !c.ok),
        gradedArch.tally,
      );
      const gradedConv = gradeSandbox({ root: ROOT, skill: 'define-conventions', ledger: false });
      check(
        'sandbox:grade-seed-define-conventions-fails',
        gradedConv.ok === false && gradedConv.checks.some((c) => c.id === 'folder-structure' && !c.ok),
        gradedConv.tally,
      );
      const gradedSprints = gradeSandbox({ root: ROOT, skill: 'plan-sprints', ledger: false });
      check(
        'sandbox:grade-seed-plan-sprints-fails',
        gradedSprints.ok === false && gradedSprints.checks.some((c) => c.id === 'roadmap-file' && !c.ok),
        gradedSprints.tally,
      );
      check(
        'sandbox:grade-seed-idea-intake-stage',
        graded.checks.some((c) => c.id === 'stage-advanced' && !c.ok),
        graded.tally,
      );
      check(
        'sandbox:grade-seed-idea-intake-artifacts',
        graded.checks.some((c) => c.id === 'idea-artifact' && !c.ok),
        graded.tally,
      );
      check(
        'sandbox:grade-seed-idea-intake-state-hash',
        graded.checks.some((c) => c.id === 'state-not-seed' && !c.ok),
        graded.tally,
      );
      const slashSkill = gradeSandbox({ root: ROOT, skill: '/idea-intake', ledger: false });
      check(
        'sandbox:grade-slash-skill',
        slashSkill.skill === 'idea-intake' && slashSkill.ok === false,
        slashSkill.tally,
      );
      const flagAsSkill = parseGradeArgs(['--skill', '--ledger']);
      check('sandbox:parse-skill-not-flag', flagAsSkill.skill === 'isolation' && flagAsSkill.ledger === true);
      const missingOracle = gradeSandbox({ root: ROOT, skill: 'close-sprint', ledger: false });
      check(
        'sandbox:grade-missing-oracle-fails',
        missingOracle.ok === false && missingOracle.checks.some((c) => c.id === 'oracle-close-sprint-file' && !c.ok),
        missingOracle.tally,
      );
      const skipMissing = gradeSandbox({ root: ROOT, skill: 'close-sprint', missing: 'skip', ledger: false });
      check(
        'sandbox:grade-missing-oracle-skip',
        skipMissing.ok === true && skipMissing.isolation === 'ok',
        skipMissing.tally,
      );
      {
        const brokenDir = mkdtempSync(join(tmpdir(), 'midas-sandbox-oracle-'));
        const bogusOracle = join(ROOT, 'sandbox', 'oracles', '_grade-invalid.json');
        try {
          writeFileSync(join(brokenDir, 'broken.json'), '{', 'utf8');
          const broken = loadOracleDoc('broken', brokenDir);
          check('sandbox:oracle-invalid-not-missing', broken.invalid === true && broken.missing === false);
          writeFileSync(bogusOracle, '{', 'utf8');
          const skipBroken = gradeSandbox({ root: ROOT, skill: '_grade-invalid', missing: 'skip', ledger: false });
          check(
            'sandbox:grade-invalid-oracle-not-skipped',
            skipBroken.ok === false && skipBroken.checks.some((c) => c.id === 'oracle-_grade-invalid-file' && !c.ok),
            skipBroken.tally,
          );
        } finally {
          if (existsSync(bogusOracle)) unlinkSync(bogusOracle);
          rmSync(brokenDir, { recursive: true, force: true });
        }
      }
      {
        const simState = join(restored.work, '.harness', 'state.yaml');
        let sim = readFileSync(simState, 'utf8');
        sim = sim.replace(/^updated:\s*2026-08-28\s*$/m, 'updated: 2026-08-30');
        sim = sim.replace(/^stage:\s*idea_intake\s*$/m, 'stage: contextualize');
        sim = sim.replace(/^    status:\s*not_started\s*$/m, '    status: passed');
        sim = sim.replace(/^    gate:\s*pending\s*$/m, '    gate: passed');
        writeFileSync(simState, sim, 'utf8');
        const stageOnly = gradeSandbox({ root: ROOT, skill: 'idea-intake', ledger: false });
        check(
          'sandbox:grade-idea-intake-stage-only-fails',
          stageOnly.ok === false && stageOnly.checks.some((c) => c.id === 'idea-artifact' && !c.ok),
          stageOnly.tally,
        );
        sim = sim.replace(/^    gate:\s*passed\s*$/m, '    gate: passed\n    artifacts: [.harness/product/idea.md]');
        writeFileSync(simState, sim, 'utf8');
        const artifactsOnly = gradeSandbox({ root: ROOT, skill: 'idea-intake', ledger: false });
        check(
          'sandbox:grade-idea-intake-artifacts-without-gate-record',
          artifactsOnly.ok === false && artifactsOnly.checks.some((c) => c.id === 'gate-record' && !c.ok),
          artifactsOnly.tally,
        );
        mkdirSync(join(restored.work, '.harness', 'runs', 'audits'), { recursive: true });
        writeFileSync(
          join(restored.work, '.harness', 'runs', 'audits', 'gate-00.md'),
          '# Phase gate gate-00 — Idea Intake\n\nMIDAS_GATE_RESULT: verdict=pass unresolved=0\n',
          'utf8',
        );
        const afterGate = gradeSandbox({ root: ROOT, skill: 'idea-intake', ledger: false });
        check('sandbox:grade-idea-intake-after-gate', afterGate.ok === true, afterGate.tally);
        resetSandbox(ROOT);
      }
      const probe = join(ROOT, 'harness', 'skills', '_sandbox-grade-probe.md');
      try {
        writeFileSync(probe, 'sandbox-grade-probe\n', 'utf8');
        const leaked = gradeSandbox({ root: ROOT, skill: 'isolation', ledger: false });
        check(
          'sandbox:grade-skills-tree',
          leaked.isolation === 'fail' && leaked.checks.some((c) => c.id === 'skills-untouched' && !c.ok),
          leaked.tally,
        );
      } finally {
        if (existsSync(probe)) unlinkSync(probe);
      }
      const afterProbe = gradeSandbox({ root: ROOT, skill: 'isolation', ledger: false });
      check('sandbox:grade-skills-tree-restored', afterProbe.isolation === 'ok', afterProbe.tally);
      const ledgerPath = join(tmpdir(), 'midas-sandbox-ledger-test.jsonl');
      try {
        const withLedger = gradeSandbox({ root: ROOT, skill: 'idea-intake', ledger: true, ledgerPath });
        const ledgerBody = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
        check(
          'sandbox:grade-ledger-opt-in',
          withLedger.ok === false &&
            /"skill":"idea-intake"/.test(ledgerBody) &&
            /"fail_ids"/.test(ledgerBody) &&
            /stage-advanced/.test(ledgerBody),
        );
      } finally {
        if (existsSync(ledgerPath)) unlinkSync(ledgerPath);
      }
    }
  }
  check('layout:no-legacy-root-product-dir', !existsSync(join(ROOT, 'product')));
  check('layout:no-root-claude-plugin-dir', !existsSync(join(ROOT, '.claude-plugin')));
  check(
    'layout:no-root-dogfood-harness',
    !existsSync(join(ROOT, '.harness', 'state.yaml')) && !existsSync(join(ROOT, '.harness', 'engine', 'VERSION')),
  );
  check(
    'layout:engine-marketplace-json',
    existsSync(join(ROOT, 'harness', '.claude-plugin', 'marketplace.json')),
    'run build-plugin.mjs',
  );
  check(
    'layout:engine-product-stub',
    existsSync(join(ROOT, 'docs', 'product', 'README.md')),
    'docs/product/README.md stub',
  );
  // Engine dev state must never ship in the distributable bundle (cli/index.mjs writes fresh state).
  check('create-template:excludes:harness/state.yaml', !existsSync(join(tplRoot, '.harness', 'engine', 'state.yaml')));
  check(
    'create-template:schema:no-mojibake',
    !/[ÔÃ’]/.test(readFileSync(join(tplRoot, '.harness', 'engine', 'state.schema.md'), 'utf8')),
    'template state.schema.md has UTF-8 mojibake',
  );
}

// --- E2b. build-create strips engine-only harness files (dynamic, not static tree check) -------
const buildCreate = join(ROOT, 'scripts', 'build-create.mjs');
if (existsSync(buildCreate)) {
  execSync(`node "${buildCreate}"`, { cwd: ROOT, stdio: 'pipe' });
  check(
    'build-create:excludes-harness-state-yaml',
    !existsSync(join(ROOT, 'cli', 'template', '.harness', 'engine', 'state.yaml')),
    'harness/state.yaml leaked into cli/template — add to HARNESS_EXCLUDE',
  );
  const srcConv = join(ROOT, 'harness', 'conventions.md');
  const tplConv = join(ROOT, 'cli', 'template', '.harness', 'engine', 'conventions.md');
  if (existsSync(srcConv) && existsSync(tplConv)) {
    check(
      'build-create:conventions-match',
      readFileSync(srcConv, 'utf8') === readFileSync(tplConv, 'utf8'),
      'template harness/conventions.md drifted from source',
    );
  }
  const sourceHarness = join(ROOT, 'harness');
  const templateHarness = join(ROOT, 'cli', 'template', '.harness', 'engine');
  if (existsSync(sourceHarness) && existsSync(templateHarness)) {
    const sourceFiles = walkRelativeFiles(sourceHarness).filter((rel) => {
      const n = rel.replace(/\\/g, '/');
      return !isHarnessEngineOnlyRel(rel) && n !== 'skill-registry.md';
    });
    const templateFiles = walkRelativeFiles(templateHarness)
      .filter((rel) => {
        const n = rel.replace(/\\/g, '/');
        return n !== 'docs/agents-and-models.md' &&
          n !== 'docs/skill-quality-gate.md' &&
          n !== 'docs/skill-flows.md' &&
          n !== 'docs/skills.md' &&
          n !== 'docs/context-digest.md' &&
          n !== 'skill-registry.md';
      });
    const sameShape = JSON.stringify(sourceFiles) === JSON.stringify(templateFiles);
    const sameContent = sameShape && sourceFiles.every(
      (rel) => readFileSync(join(sourceHarness, rel), 'utf8') === readFileSync(join(templateHarness, rel), 'utf8'),
    );
    check(
      'build-create:harness-tree-match',
      sameShape && sameContent,
      'cli/template/harness drifts from harness source (excluding HARNESS_ENGINE_ONLY_RELS)',
    );
    check(
      'build-create:excludes-harness-trace-research',
      !existsSync(join(templateHarness, 'research', 'harness-trace.md')),
      'engine-only research/harness-trace.md leaked into template',
    );
    check(
      'build-create:autonomy-optional-only',
      !existsSync(join(templateHarness, 'autonomy')) &&
        existsSync(join(ROOT, 'cli', 'template', '.optional', 'autonomy', 'metapolicy.json')),
    );
  }
  {
    const sourceClaude = join(ROOT, 'harness');
    const templateClaude = join(ROOT, 'cli', 'template', '.claude');
    if (existsSync(sourceClaude) && existsSync(templateClaude)) {
      const sourceFiles = [
        ...walkRelativeFiles(join(sourceClaude, 'skills'))
          .map((rel) => `skills/${rel.replace(/\\/g, '/')}`)
          .filter((rel) => {
            const name = rel.split('/')[1];
            return name && !ENGINE_ONLY_SKILLS.includes(name) && !isHostMirrorExcluded(name);
          }),
        ...walkRelativeFiles(join(sourceClaude, 'agents')).map((rel) => `agents/${rel.replace(/\\/g, '/')}`),
      ].sort();
      const templateFiles = walkRelativeFiles(templateClaude).map((rel) => rel.replace(/\\/g, '/'));
      const sameShape = JSON.stringify(sourceFiles) === JSON.stringify(templateFiles);
      const sameContent = sameShape && sourceFiles.every(
        (rel) => readFileSync(join(sourceClaude, rel), 'utf8') === readFileSync(join(templateClaude, rel), 'utf8'),
      );
      check(
        'create-template:claude-tree-match',
        sameShape && sameContent,
        'cli/template/.claude drifts from harness skills/agents (excluding engine-only + ADR-013 host exclusions)',
      );
      for (const name of ENGINE_ONLY_SKILLS) {
        check(
          `create-template:excludes-${name}`,
          !existsSync(join(templateClaude, 'skills', name)),
          `engine-only ${name} must not ship in cli/template`,
        );
      }
    }
  }
  {
    const sourcePortableSkills = join(ROOT, 'harness', 'skills');
    const templatePortableSkills = join(ROOT, 'cli', 'template', '.agents', 'skills');
    if (existsSync(sourcePortableSkills) && existsSync(templatePortableSkills)) {
      const sourceNames = dirNames(sourcePortableSkills).filter(
        (n) => !ENGINE_ONLY_SKILLS.includes(n) && !isHostMirrorExcluded(n),
      );
      const templateNames = dirNames(templatePortableSkills);
      const sameShape = JSON.stringify(sourceNames) === JSON.stringify(templateNames);
      let sameContent = sameShape;
      if (sameShape) {
        for (const name of sourceNames) {
          const sourceText = readFileSync(join(sourcePortableSkills, name, 'SKILL.md'), 'utf8');
          const templateText = readFileSync(join(templatePortableSkills, name, 'SKILL.md'), 'utf8');
          const sourceParts = splitSkillDocument(sourceText);
          const templateParts = parsePortableSkill(templateText);
          sameContent = sameContent &&
            !!sourceParts &&
            !!templateParts &&
            templateParts.name === name &&
            templateParts.description === normalizePortableScalar((parseFrontmatter(sourceText) || {}).description) &&
            Object.keys(templateParts).every((k) => ['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata'].includes(k)) &&
            templateParts.metadata['midas-harness-tier'] &&
            sourceParts.body.trim() === (templateText.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/) || [])[1].trim();
          if (!sameContent) break;
        }
      }
      check(
        'build-create:portable-skills-match',
        sameShape && sameContent,
        'cli/template/.agents/skills drifts from harness/skills (excluding engine-only)',
      );
    }
  }
  {
    const sourceAgentsTemplate = join(ROOT, 'harness', 'templates', 'AGENTS.md.tmpl');
    const bundledAgents = join(ROOT, 'cli', 'template', 'AGENTS.md');
    if (existsSync(sourceAgentsTemplate) && existsSync(bundledAgents)) {
      const tmpl = readFileSync(sourceAgentsTemplate, 'utf8');
      const rendered = tmpl.replace(/^[\s\S]*?\}\}\s*(?=# AGENTS\.md)/, '');
      check(
        'create-template:agents-md:match',
        readFileSync(bundledAgents, 'utf8') === rendered,
        'cli/template/AGENTS.md drifted from harness/templates/AGENTS.md.tmpl render',
      );
    }
  }
  {
    const sourcePortableSkills = join(ROOT, 'harness', 'skills');
    const bundledPortableSkills = join(ROOT, 'cli', 'template', '.agents', 'skills');
    if (existsSync(sourcePortableSkills) && existsSync(bundledPortableSkills)) {
      const sourceNames = dirNames(sourcePortableSkills).filter(
        (n) => !ENGINE_ONLY_SKILLS.includes(n) && !isHostMirrorExcluded(n),
      );
      const portableNames = dirNames(bundledPortableSkills);
      const sameShape = JSON.stringify(sourceNames) === JSON.stringify(portableNames);
      let sameContent = sameShape;
      if (sameShape) {
        for (const name of sourceNames) {
          const src = readFileSync(join(sourcePortableSkills, name, 'SKILL.md'), 'utf8');
          const dst = readFileSync(join(bundledPortableSkills, name, 'SKILL.md'), 'utf8');
          const srcParts = splitSkillDocument(src);
          const dstParts = parsePortableSkill(dst);
          sameContent = sameContent && !!srcParts && !!dstParts &&
            dstParts.name === name &&
            dstParts.description === normalizePortableScalar((parseFrontmatter(src) || {}).description) &&
            Object.keys(dstParts).every((k) => ['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata'].includes(k)) &&
            dstParts.metadata['midas-harness-tier'] &&
            srcParts.body.trim() === (dst.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/) || [])[1].trim();
          if (!sameContent) break;
        }
      }
      check(
        'create-template:portable-skills:match',
        sameShape && sameContent,
        'cli/template/.agents/skills drifts from harness/skills (excluding engine-only)',
      );
    }
  }
  {
    const sourcePortableSkills = join(ROOT, 'harness', 'skills');
    const cursorPortableSkills = join(ROOT, 'cli', 'template', '.cursor', 'skills');
    if (existsSync(sourcePortableSkills) && existsSync(cursorPortableSkills)) {
      const sourceNames = dirNames(sourcePortableSkills).filter(
        (n) => !ENGINE_ONLY_SKILLS.includes(n) && !isHostMirrorExcluded(n),
      );
      const cursorNames = dirNames(cursorPortableSkills);
      const sameShape = JSON.stringify(sourceNames) === JSON.stringify(cursorNames);
      let sameContent = sameShape;
      if (sameShape) {
        for (const name of sourceNames) {
          const src = readFileSync(join(sourcePortableSkills, name, 'SKILL.md'), 'utf8');
          const dst = readFileSync(join(cursorPortableSkills, name, 'SKILL.md'), 'utf8');
          const srcParts = splitSkillDocument(src);
          const dstParts = parsePortableSkill(dst);
          sameContent = sameContent && !!srcParts && !!dstParts &&
            dstParts.name === name &&
            dstParts.description === normalizePortableScalar((parseFrontmatter(src) || {}).description) &&
            Object.keys(dstParts).every((k) => ['name', 'description', 'license', 'compatibility', 'allowed-tools', 'metadata'].includes(k)) &&
            dstParts.metadata['midas-harness-tier'] &&
            srcParts.body.trim() === (dst.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/) || [])[1].trim();
          if (!sameContent) break;
        }
      }
      check(
        'create-template:cursor-skills:match',
        sameShape && sameContent,
        'cli/template/.cursor/skills drifts from harness/skills (excluding engine-only + ADR-013 host exclusions)',
      );
    }
  }
  const templateScripts = join(ROOT, 'cli', 'template', '.harness', 'scripts');
  const expectedScripts = scriptBundleFiles();
  if (existsSync(templateScripts)) {
    const templateScriptFiles = walkRelativeFiles(templateScripts)
      .map((rel) => rel.replace(/\\/g, '/'))
      .sort();
    const extraScripts = ['install-diagnose.mjs', 'install-context.mjs', 'lib/install-cmd.mjs'];
    const sameShape = JSON.stringify(templateScriptFiles) === JSON.stringify([...expectedScripts, ...extraScripts].sort());
    const sameContent = sameShape && expectedScripts.every(
      (rel) => readFileSync(join(ROOT, shippedScriptSourcePath(rel)), 'utf8') === readFileSync(join(templateScripts, rel), 'utf8'),
    ) && readFileSync(join(ROOT, 'cli', 'install-diagnose.mjs'), 'utf8') === readFileSync(join(templateScripts, 'install-diagnose.mjs'), 'utf8')
      && readFileSync(join(ROOT, 'cli', 'lib', 'core', 'context.mjs'), 'utf8') === readFileSync(join(templateScripts, 'install-context.mjs'), 'utf8')
      && readFileSync(join(ROOT, 'cli', 'lib', 'core', 'install-cmd.mjs'), 'utf8') === readFileSync(join(templateScripts, 'lib', 'install-cmd.mjs'), 'utf8');
    check(
      'build-create:scripts-tree-match',
      sameShape && sameContent,
      'cli/template/.harness/scripts drifts from source scripts bundle',
    );
  }
}

}
