// registries.mjs — doctor health checks (registries).

export const id = "registries";

/**
 * @param {object} ctx doctor check context
 */
export async function run(ctx) {
  const {
    ROOT, paths, VERSION, doctorCmd, updateCheckCmd, pluginHelpers,
    stateRaw, check, read, tallyNum, agentModel, compareMirror, hostMirrorSkillExcludeSet,
    existsSync, join, resolve, dirname, readFileSync, readdirSync, statSync,
    parseSprints, parseSprintLastTouched, parsePhases, parseEnforcement, parseRouting,
    parseToolsFromStateYaml, detectLayout, readOwnershipManifest, findVendorConflicts,
    sha256File, walkFiles, formatUpdateCmd, formatUpdateCmdFromRelease,
    normalizeRoutingProfile, normalizeCostProfile, resolveRoutingModels,
    resolveCostAwareRouting, knownRoutingModelIds,
    evaluateMcpDeclaredVsWired, evaluateMcpGovernance, evaluateSkillMcpRequired,
    collectSkillMcpRequired, wrapMcpServersForWindows, auditGitignore,
    orphanRootMidasPaths, resolveSkillMirrorPlan, renderPortableSkillText,
    checkSkillRegistry, missingEvidenceRequired,
    computeStageCommandTableYaml, computeDesignSystemCss,
    computeChecksIndex, computeGatesIndex,
  } = ctx;

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
      'not installed — optional: npx … update --autonomy then /midas-auto-pilot setup (CLI: midas-autopilot setup)',
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
}
