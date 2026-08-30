// layout.mjs — doctor health checks (layout).

export const id = "layout";

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

// layout: state.layout vs disk markers
const declaredLayout = (stateRaw?.match(/^layout:\s*(\S+)/m) || [])[1];
const detected = detectLayout(ROOT);
if (paths.layoutConflict) {
  check('layout:consistent', 'warn', 'canonical and legacy install markers coexist — resolve the partial migration');
} else if (!stateRaw) {
  check('layout:consistent', 'skip', 'no state file');
} else if (declaredLayout && detected && declaredLayout !== detected) {
  check('layout:consistent', 'warn', `state layout=${declaredLayout} but disk=${detected}`);
} else if (detected !== 'harness' && existsSync(join(ROOT, '.harness', 'engine'))) {
  check('layout:consistent', 'warn', `installed engine must use layout=harness, found ${detected || 'unknown'}`);
} else {
  check('layout:consistent', 'ok', `role=${paths.role} (${declaredLayout || detected || paths.layout})`);
}

if (paths.role === 'product') {
  const manifest = readOwnershipManifest(ROOT);
  if (!manifest) {
    check('manifest:integrity', 'warn', `${paths.manifest} missing or invalid`);
  } else {
    const vendorConflicts = findVendorConflicts(ROOT, manifest);
    const invalidRoles = manifest.files.filter((file) => !['vendor', 'generated', 'user'].includes(file.role));
    const missingGenerated = manifest.files
      .filter((file) => file.role === 'generated')
      .filter((file) => !existsSync(join(ROOT, file.path)));
    const problems = [
      vendorConflicts.length ? `vendor drift=${vendorConflicts.length}` : '',
      invalidRoles.length ? `invalid roles=${invalidRoles.length}` : '',
      missingGenerated.length ? `generated missing=${missingGenerated.length}` : '',
      manifest.layout !== 'harness' ? `layout=${manifest.layout || 'unset'}` : '',
      VERSION && manifest.midas_version !== VERSION
        ? `version=${manifest.midas_version || 'unset'} (engine ${VERSION})`
        : '',
    ].filter(Boolean);
    check(
      'manifest:integrity',
      problems.length ? 'warn' : 'ok',
      problems.length ? problems.join(', ') : `${manifest.files.length} owned file(s) classified`,
    );
  }

  // --- update readiness (read-only, network-free) ---
  // `update:remote` compares the installed tree hash against the channel manifest the CLI last
  // cached, so doctor can say "there is something new" without spawning npx or hitting the network.
  const channel = manifest?.channel || 'stable';

  if (!manifest) {
    check('update:remote', 'skip', 'no manifest to compare');
  } else if (!manifest.tree_sha256) {
    check('update:remote', 'skip', 'manifest predates content hashing — the next update records it');
  } else {
    const cachePath = join(ROOT, '.harness', 'cache', 'update', `${channel}.json`);
    let published = null;
    if (existsSync(cachePath)) {
      try {
        published = JSON.parse(readFileSync(cachePath, 'utf8'));
      } catch {
        published = null;
      }
    }
    if (!published?.tree_sha256) {
      check('update:remote', 'skip', `no cached ${channel} manifest — run ${updateCheckCmd}`);
    } else if (published.tree_sha256 === manifest.tree_sha256) {
      check('update:remote', 'ok', `up to date with ${channel} (${manifest.tree_sha256.slice(0, 12)})`);
    } else {
      check(
        'update:remote',
        'warn',
        `${channel} publishes ${published.tree_sha256.slice(0, 12)}, installed ${manifest.tree_sha256.slice(0, 12)} — run ${formatUpdateCmdFromRelease(published, { channel })}`,
      );
    }
  }

  const conflictsDir = join(ROOT, '.harness', 'conflicts');
  const conflicts = existsSync(conflictsDir)
    ? walkFiles(conflictsDir, { relativeTo: ROOT }).filter((rel) => rel.endsWith('.midas-conflict'))
    : [];
  check(
    'update:conflicts',
    conflicts.length ? 'warn' : 'ok',
    conflicts.length
      ? `${conflicts.length} unresolved vendor edit(s) saved by a past update — review and delete .harness/conflicts/`
      : 'no saved vendor conflicts',
  );

  const migrationsDir = join(paths.engine, 'state-migrations');
  const shipped = existsSync(join(ROOT, migrationsDir))
    ? readdirSync(join(ROOT, migrationsDir)).filter((n) => n.endsWith('.mjs')).map((n) => n.replace(/\.mjs$/, '')).sort()
    : [];
  if (!shipped.length) {
    check('update:migrations', 'ok', 'no state migrations shipped');
  } else {
    const appliedMatch = (read(paths.state) || '').match(/^migrations:\s*\[([^\]]*)\]/m);
    const applied = new Set(
      (appliedMatch ? appliedMatch[1].split(',') : [])
        .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean),
    );
    const pending = shipped.filter((id) => !applied.has(id));
    check(
      'update:migrations',
      pending.length ? 'warn' : 'ok',
      pending.length ? `pending: ${pending.join(', ')} — run ${formatUpdateCmd({ version: null })}` : `${shipped.length} applied`,
    );
  }

  const tools = stateRaw ? parseToolsFromStateYaml(stateRaw) || [] : [];
  const skillPlan = resolveSkillMirrorPlan(tools);
  const skillExclude = hostMirrorSkillExcludeSet(join(paths.engine, 'skills'));
  if (skillPlan.claude) {
    const skillsMirror = compareMirror(join(paths.engine, 'skills'), '.claude/skills', (_rel, raw) => raw, {
      excludeTopLevelDirs: skillExclude,
    });
    check('mirror:claude-skills', skillsMirror.status, skillsMirror.note);
    const agentsMirror = compareMirror(join(paths.engine, 'agents'), '.claude/agents');
    check('mirror:claude-agents', agentsMirror.status, agentsMirror.note);
  }
  if (skillPlan.agents) {
    const portableMirror = compareMirror(
      join(paths.engine, 'skills'),
      '.agents/skills',
      (file, raw) => file.endsWith('/SKILL.md') || file === 'SKILL.md'
        ? renderPortableSkillText(raw, file)
        : raw,
      { excludeTopLevelDirs: skillExclude },
    );
    check('mirror:agent-skills', portableMirror.status, portableMirror.note);
  }
  if (skillPlan.cursorSkills) {
    const cursorMirror = compareMirror(
      join(paths.engine, 'skills'),
      '.cursor/skills',
      (file, raw) => file.endsWith('/SKILL.md') || file === 'SKILL.md'
        ? renderPortableSkillText(raw, file)
        : raw,
      { excludeTopLevelDirs: skillExclude },
    );
    check('mirror:cursor-skills', cursorMirror.status, cursorMirror.note);
  }

  const orphans = orphanRootMidasPaths(tools, paths.layout).filter((rel) => {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) return false;
    if (statSync(abs).isFile()) return true;
    // Directories: only orphan if a Midas engine skill/agent name is still present (preserve user neighbors).
    if (rel.includes('skills')) {
      const engineSkills = join(ROOT, paths.engine, 'skills');
      if (!existsSync(engineSkills)) return false;
      return readdirSync(engineSkills).some((name) => existsSync(join(abs, name)));
    }
    if (rel.includes('agents')) {
      const engineAgents = join(ROOT, paths.engine, 'agents');
      if (!existsSync(engineAgents)) return false;
      return readdirSync(engineAgents).some((name) => existsSync(join(abs, name)));
    }
    return readdirSync(abs).length > 0;
  });
  check(
    'layout:root-allowlist',
    orphans.length ? 'warn' : 'ok',
    orphans.length
      ? `orphan Midas host paths (not justified by tools=[${tools.join(', ')}]): ${orphans.join(', ')} — run create-midas --update --tools=…`
      : `root host surfaces match tools=[${tools.join(', ') || 'none'}]`,
  );

  const legacyMarkers = [
    ['harness/state.yaml', null],
    ['harness/VERSION', null],
    ['.midas/state.yaml', null],
    ['.midas/engine/VERSION', null],
    ['scripts/doctor.mjs', /\bMidas\b/i],
    ['product/idea.md', /\bMidas\b/i],
  ].filter(([rel, signature]) => {
    const abs = join(ROOT, rel);
    return existsSync(abs) && statSync(abs).isFile() &&
      (!signature || signature.test(readFileSync(abs, 'utf8').slice(0, 1200)));
  }).map(([rel]) => rel);
  check(
    'layout:legacy-artifacts',
    legacyMarkers.length ? 'warn' : 'ok',
    legacyMarkers.length ? `identifiable Midas files remain: ${legacyMarkers.join(', ')}` : 'none',
  );
}
}
