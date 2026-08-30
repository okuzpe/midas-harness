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
check('routing-profile:claude', resolveRoutingModels('claude').orchestrate === 'claude-opus-4-8');
check('routing-profile:openai-mini', Object.values(resolveRoutingModels('openai-mini')).every((id) => id === 'gpt-5.4-mini'));
check('routing-profile:local-hybrid', resolveRoutingModels('local-hybrid', { localModelId: 'ollama/qwen' }).build === 'ollama/qwen');
check('routing-profile:legacy-alias', normalizeRoutingProfile('openai') === 'openai-mini');
check('routing-profile:unknown-rejected', !isKnownRoutingProfile('invented'));
check('cost-profile:known', isKnownCostProfile('max_savings') && normalizeCostProfile('max_quality') === 'max_quality');
check('cost-profile:unknown-rejected', !isKnownCostProfile('cheap'));
check(
  'cost-aware:max_savings-claude',
  resolveCostAwareRouting('claude', 'max_savings').orchestrate === 'claude-sonnet-4-6' &&
    resolveCostAwareRouting('claude', 'max_savings').build === 'claude-sonnet-4-6',
);
check(
  'cost-aware:max_quality-build-opus',
  resolveCostAwareRouting('claude', 'max_quality').build === 'claude-opus-4-8',
);
check(
  'cost-aware:openai-mini-ignores-cost',
  resolveCostAwareRouting('openai-mini', 'max_quality').orchestrate === 'gpt-5.4-mini',
);
check(
  'cost-aware:max_savings-escalate-stages',
  MAX_SAVINGS_ORCHESTRATE_ESCALATE_STAGES.includes('tech_architecture') &&
    MAX_SAVINGS_ORCHESTRATE_ESCALATE_STAGES.includes('audit_adjust'),
);
{
  const sample = 'cost_profile: max_savings\nrouting:\n  orchestrate: claude-opus-4-8\n  build: claude-sonnet-4-6\n  scout: claude-haiku-4-5\n';
  const expected = resolveCostAwareRouting('claude', 'max_savings');
  const next = rewriteRoutingMap(sample, expected);
  check('cost-aware:rewrite-routing-map', !!next && /orchestrate:\s*claude-sonnet-4-6/.test(next));
}

// --- B. skill frontmatter + ritual guard -------------------------------------------------------
for (const name of dirNames(skillsDir)) {
  const file = join(skillsDir, name, 'SKILL.md');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const fm = parseFrontmatter(text);
  check(`skill:${name}:has-frontmatter`, !!fm);
  if (!fm) continue;
  check(`skill:${name}:name-matches-dir`, fm.name === name, `name=${fm.name}`);
  check(`skill:${name}:has-description`, !!fm.description && fm.description.length > 10);
  check(`skill:${name}:tier`, ['orchestrate', 'build', 'scout'].includes(fm['harness-tier']), `tier=${fm['harness-tier']}`);
  check(
    `skill:${name}:tier-delegation`,
    /## Tier & (delegation|cost)\b/i.test(text) ||
      (/\*\*orchestrate\*\*|\*\*scout\*\*|\*\*build\*\*/i.test(text) && /midas-(orchestrator|builder|scout)/.test(text)),
    'missing ## Tier & delegation (or equivalent agent routing)',
  );
  if (fm['disable-model-invocation'] === 'true') {
    const hasGuard = text.includes(RITUAL_GUARD) || text.includes(RITUAL_CITE);
    check(`skill:${name}:ritual-guard`, hasGuard, 'missing body guard or skill-state-ritual.md cite');
  }
}

// --- B2. skill-quality-check (mechanical hard fails) -------------------------------------------
{
  const sample = inspectArtifact({
    kind: 'skill',
    id: 'demo',
    relPath: 'harness/skills/demo/SKILL.md',
    text: `---
name: demo
description: Short demo skill for unit tests only.
user-surface: primary
harness-tier: scout
---
# demo
`,
  });
  check('skill-quality:parse-frontmatter', !!parseFrontmatter('---\nname: x\ndescription: y\n---\n'));
  check(
    'frontmatter:nested-metadata',
    parseFrontmatter('---\nname: x\nmetadata:\n  midas-tier: scout\n---\nbody\n')?.metadata?.['midas-tier'] === 'scout',
  );
  check('skill-quality:steps-link-count', stepsMarkdownLinkCount('## Steps\n1. [a](one.md)\n2. [b](two.md)\n3. [c](three.md)\n') === 3);
  check('skill-quality:sample-no-fails', sample.fails.length === 0, sample.fails.join('; '));

  // Mechanized model-routing.md CHECKs (previously `manual:`): recommended-model/harness-tier
  // drift and the `## Tier & delegation` section — see skill-quality-check.mjs header note.
  const mismatched = inspectArtifact({
    kind: 'skill',
    id: 'demo',
    relPath: 'harness/skills/demo/SKILL.md',
    text: `---
name: demo
description: Short demo skill for unit tests only.
harness-tier: scout
recommended-model: claude-opus-4-8
---
# demo
No tier section here.
`,
  });
  check(
    'skill-quality:tier-model-mismatch-warns',
    mismatched.warns.some((w) => w.includes('does not match harness-tier')),
    mismatched.warns.join('; '),
  );
  check(
    'skill-quality:missing-tier-section-warns',
    mismatched.warns.some((w) => w.includes('## Tier & delegation')),
    mismatched.warns.join('; '),
  );

  const engineSummary = summarizeReports(collectReports(ROOT));
  check('skill-quality:engine-zero-fails', engineSummary.fails === 0, `fails=${engineSummary.fails}`);
  check('skill-quality:engine-zero-warns', engineSummary.warns === 0, `warns=${engineSummary.warns}`);
  check('skill-quality:engine-skill-count', engineSummary.skills >= 28, `skills=${engineSummary.skills}`);
  check(
    'skill-quality:warns-sum-not-last-report-only',
    summarizeReports([
      { kind: 'skill', id: 'a', path: 'a', lines: 1, fails: [], warns: ['w1'] },
      { kind: 'skill', id: 'b', path: 'b', lines: 1, fails: [], warns: ['w2', 'w3'] },
    ]).warns === 3,
  );

  // Catalog membership (docs/skills.md) — mechanized change-propagation.md / skill-quality.md CHECK.
  const catalog = readCatalogText(ROOT, { engine: 'harness' });
  check('skill-quality:catalog-found', !!catalog);
  if (catalog) {
    check('skill-quality:catalog-has-midas-status', /\/midas-status\b/.test(catalog));
    check('skill-quality:catalog-rejects-unknown-id', !/\/definitely-not-a-real-skill\b/.test(catalog));
  }

  check(
    'skill-quality:parse-canonical-skill',
    parseCanonicalArtifactPath('harness/skills/midas-status/SKILL.md')?.id === 'midas-status',
  );
  check(
    'skill-quality:parse-canonical-agent',
    parseCanonicalArtifactPath('harness/agents/midas-scout.md')?.id === 'midas-scout',
  );
  check('skill-quality:ignores-mirror-path', parseCanonicalArtifactPath('.cursor/skills/midas-status/SKILL.md') === null);

  const strictSample = applyStrictWarns(
    [{ kind: 'skill', id: 'x', path: 'p', lines: 1, fails: [], warns: ['tier drift'] }],
    { strictWarns: true },
  );
  check('skill-quality:strict-warns-promotes', strictSample[0].fails.length === 1 && strictSample[0].warns.length === 0);

  const filtered = collectReports(ROOT, { onlyArtifacts: [{ kind: 'skill', id: 'midas-status' }] });
  check('skill-quality:filter-single-skill', filtered.length === 1 && filtered[0].id === 'midas-status');
}

// --- C. agent frontmatter ----------------------------------------------------------------------
for (const f of walk(agentsDir).filter((p) => extname(p) === '.md')) {
  const fm = parseFrontmatter(readFileSync(f, 'utf8'));
  const base = basename(f, '.md');
  check(`agent:${base}:has-frontmatter`, !!fm);
  if (!fm) continue;
  check(`agent:${base}:name-matches-file`, fm.name === base, `name=${fm.name}`);
  check(`agent:${base}:valid-model`, MODELS.includes(fm.model), `model=${fm.model}`);
}

}
