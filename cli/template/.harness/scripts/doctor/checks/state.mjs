// state.mjs — doctor health checks (state).

export const id = "state";

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
  } = ctx;

// version: state midas_version vs engine VERSION
if (!stateRaw) {
  check('version', 'skip', `no ${paths.state} (engine repo or pre-init)`);
} else {
  const m = stateRaw.match(/^midas_version:\s*([0-9][^\s#]*)/m);
  const sv = m ? m[1] : null;
  if (!sv) check('version', 'warn', 'state.yaml has no midas_version');
  else if (VERSION && sv !== VERSION) {
    check(
      'version',
      'warn',
      `state ${sv} != engine ${VERSION} — run ${formatUpdateCmd({ version: VERSION })} (or /midas-init for the tip)`,
    );
  }
  else check('version', 'ok', sv || '');
  for (const k of ['stage', 'cost_profile', 'routing']) {
    if (!new RegExp(`(^|\\n)${k}:`).test(stateRaw)) check(`state:${k}`, 'warn', 'missing required key');
  }

  // routing: cost_profile + routing_profile resolve an expected map; agent `model:` pins are the
  // runtime binding. Under the Claude profile, state.routing AND pins must match the cost-aware map
  // (max_savings / max_quality are no longer advisory-only).
  const pinned = {
    orchestrate: agentModel('midas-orchestrator'),
    build: agentModel('midas-builder'),
    scout: agentModel('midas-scout'),
  };
  const allow = knownRoutingModelIds();
  if (allow.size === 0) {
    check('routing', 'skip', 'no .claude/agents to reconcile against');
  } else {
    const tiers = ['orchestrate', 'build', 'scout'];
    const { costProfile, routingProfile, routing } = parseRouting(stateRaw);
    const activeProfile = normalizeRoutingProfile(routingProfile) || 'claude';
    const normalizedCost = normalizeCostProfile(costProfile);
    const localModel = (stateRaw.match(/^local_model:\s*\n(?:[^\n]*\n)*?\s*id:\s*([^\s#]+)/m) || [])[1] || 'local_model.id';
    const unknown = tiers.filter((t) => routing[t] && !allow.has(routing[t]));
    if (costProfile && !normalizedCost) {
      check('routing', 'warn', `unknown cost_profile ${costProfile} — expected balanced|max_savings|max_quality`);
    } else if (unknown.length) {
      check('routing', 'warn', `${unknown.map((t) => `${t}=${routing[t]}`).join(', ')} not a known model id — see docs/agents-and-models.md`);
    } else if (activeProfile === 'claude') {
      const expected = resolveCostAwareRouting('claude', normalizedCost || 'balanced');
      const stateMism = tiers.filter((t) => routing[t] && routing[t] !== expected[t]);
      const pinMism = tiers.filter((t) => pinned[t] && pinned[t] !== expected[t]);
      if (stateMism.length) {
        check('routing', 'warn',
          `cost_profile ${normalizedCost || 'balanced'}: ${stateMism.map((t) => `${t}: state ${routing[t]} != expected ${expected[t]}`).join('; ')} — update routing: or run doctor --fix`);
      } else if (pinMism.length) {
        check('routing', 'warn',
          `cost_profile ${normalizedCost || 'balanced'}: ${pinMism.map((t) => `${t}: agent ${pinned[t]} != expected ${expected[t]}`).join('; ')} — run \`${doctorCmd} --fix\` to sync agent pins`);
      } else {
        check('routing', 'ok',
          `cost_profile ${normalizedCost || 'balanced'} matches state.routing + agent pins`);
      }
    } else if (activeProfile === 'openai-mini') {
      const expected = resolveRoutingModels('openai-mini');
      const mism = tiers.filter((t) => routing[t] && routing[t] !== expected[t]);
      check('routing', mism.length ? 'warn' : 'ok',
        mism.length ? mism.map((t) => `${t}: state ${routing[t]} != profile ${expected[t]}`).join('; ') : 'openai-mini profile resolves to gpt-5.4-mini');
    } else if (activeProfile === 'local-hybrid') {
      const expected = resolveRoutingModels('local-hybrid', { localModelId: localModel });
      const mism = tiers.filter((t) => routing[t] && routing[t] !== expected[t]);
      check('routing', mism.length ? 'warn' : 'ok',
        mism.length ? mism.map((t) => `${t}: state ${routing[t]} != profile ${expected[t]}`).join('; ') : `local-hybrid profile resolves to ${localModel}`);
    } else {
      check('routing', 'warn', `unknown routing_profile ${routingProfile || '(unset)'} - see docs/agents-and-models.md`);
    }
  }

  // enforcement: the recommend-don't-wall scaffolding decision must be recorded and honest. A named
  // config file absent on disk is drift; installed:false is allowed but surfaced so the gap is visible.
  const enf = parseEnforcement(stateRaw);
  if (enf.length === 0) {
    check('enforcement', 'skip', 'no enforcement: block (pre-Phase-5 or none scaffolded)');
  } else {
    const missing = enf.filter((e) => e.config && !existsSync(join(ROOT, e.config)));
    if (missing.length) {
      check('enforcement', 'warn', `config named but missing on disk: ${missing.map((e) => `${e.tool}→${e.config}`).join(', ')}`);
    } else {
      const off = enf.filter((e) => !e.installed).map((e) => e.tool);
      check('enforcement', 'ok', off.length
        ? `${enf.length} configured; NOT installed: ${off.join(', ')} (recommend-don't-wall → graded at Phase 8)`
        : `${enf.length} configured + installed`);
    }
  }
}
}
