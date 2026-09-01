// gates.mjs — doctor health checks (gates).

export const id = "gates";

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

// skills carry valid frontmatter with a name
const skillsDir = join(ROOT, paths.engine, 'skills');
if (!existsSync(skillsDir)) {
  check('skills:frontmatter', 'skip', `no ${paths.engine}/skills`);
} else {
  let bad = 0, total = 0;
  for (const d of readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const skillPath = join(skillsDir, d.name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    total++;
    const s = readFileSync(skillPath, 'utf8');
    if (!/^---\r?\n[\s\S]*?\bname:\s*\S/m.test(s)) bad++;
  }
  check('skills:frontmatter', bad ? 'warn' : 'ok', `${total - bad}/${total} valid`);
}

// frozen gate records vs state: the first check OUTSIDE the model that validates a verdict.
// A producing model can write "PASS" into an audit/verify record and advance the sprint; this
// catches the mismatch — a record whose tally shows unresolved CRITs while state marks the sprint
// done. Per-sprint records only (audit/verify); the tribunal is advisory by design and not gated.
const harnessDir = join(ROOT, paths.runs);
if (!stateRaw) {
  check('gate:records', 'skip', 'no state.yaml');
} else if (!existsSync(harnessDir)) {
  check('gate:records', 'skip', `no ${paths.runs} records yet`);
} else {
  const sprintStatus = parseSprints(stateRaw);
  const shipped = /^stage:\s*shipped\b/m.test(stateRaw);
  const isClosed = (nn) => shipped || sprintStatus.get(nn) === 'done';
  let scanned = 0, flagged = 0;

  const audits = join(harnessDir, 'audits');
  if (existsSync(audits)) for (const f of readdirSync(audits)) {
    const nn = (f.match(/^audit-([\w.-]+)\.md$/) || [])[1];
    if (!nn) continue;
    const line = (read(join(paths.runsPath('audits'), f)) || '').match(/MIDAS_AUDIT_RESULT:[^\n\r]*/);
    if (!line) continue;
    scanned++;
    const unresolved = tallyNum(line[0], 'unresolved');
    const blocked = /verdict=blocked/.test(line[0]);
    const passClaimed = /verdict=pass/.test(line[0]);
    const unattested = /attestation=un-attested/.test(line[0]);
    if (passClaimed && unresolved > 0) {
      // self-inconsistent: the record grades itself pass while carrying unresolved fails
      flagged++;
      check(`gate:audit-${nn}`, 'warn', `record claims verdict=pass but unresolved=${unresolved} — self-inconsistent`);
    } else if (isClosed(nn) && (unresolved > 0 || blocked)) {
      flagged++;
      check(`gate:audit-${nn}`, 'warn', `record has unresolved=${unresolved}${blocked ? ' verdict=blocked' : ''} but sprint ${nn} is closed in state.yaml`);
    } else if (isClosed(nn) && passClaimed && unattested) {
      // Advisory only (not gate:* — must not fail --strict). Binding close still owed on orchestrate.
      check(
        `audit:attestation-${nn}`,
        'warn',
        `sprint ${nn} is done but audit is un-attested — re-run /close-sprint on midas-orchestrator`,
      );
    }
  }

  const verifs = join(harnessDir, 'verifications');
  if (existsSync(verifs)) for (const f of readdirSync(verifs)) {
    const nn = (f.match(/^verify-([\w.-]+)\.md$/) || [])[1];
    if (!nn) continue;
    const line = (read(join(paths.runsPath('verifications'), f)) || '').match(/MIDAS_VERIFY_RESULT:[^\n\r]*/);
    if (!line) continue;
    scanned++;
    const criticals = tallyNum(line[0], 'criticals');
    const fails = tallyNum(line[0], 'fails');
    const passClaimed = /verdict=pass/.test(line[0]);
    if (passClaimed && (criticals > 0 || fails > 0)) {
      flagged++;
      check(`gate:verify-${nn}`, 'warn', `record claims verdict=pass but fails=${fails} criticals=${criticals} — self-inconsistent`);
    } else if (isClosed(nn) && criticals > 0) {
      flagged++;
      check(`gate:verify-${nn}`, 'warn', `verify criticals=${criticals} but sprint ${nn} is closed in state.yaml`);
    }
  }

  if (scanned === 0) check('gate:records', 'skip', 'no parseable MIDAS_*_RESULT tally lines');
  else if (flagged === 0) check('gate:records', 'ok', `${scanned} record(s) consistent with state`);
}

// Phase gate evidence: a phase marked gate:passed must carry either a non-empty assumption
// (engine dogfood / deferred phases) or on-disk artifacts: paths (product installs).
if (!stateRaw) {
  check('gate:phase-artifacts', 'skip', 'no state.yaml');
} else {
  const phases = parsePhases(stateRaw);
  let scanned = 0;
  let flagged = 0;
  for (const [name, entry] of phases) {
    if (entry.gate !== 'passed') continue;
    scanned++;
    if (entry.assumption && entry.assumption.length > 0) continue;
    // Listed artifacts: stay the explicit ledger (partial fixtures like product-closed).
    // When a passed phase lists none, consume gates.json evidence_required with layout-aware paths.
    if (!entry.artifacts.length) {
      const gatesFile = join(ROOT, paths.engine, 'gates.json');
      let registryRow = null;
      if (existsSync(gatesFile)) {
        try {
          const registry = JSON.parse(readFileSync(gatesFile, 'utf8'));
          registryRow = (registry.gates || []).find((g) => g.phase === name);
        } catch {
          registryRow = null;
        }
      }
      if (registryRow?.evidence_required?.length) {
        const tools = parseToolsFromStateYaml(stateRaw) || [];
        const missingEv = missingEvidenceRequired(ROOT, paths, registryRow.evidence_required, { tools });
        if (missingEv.length) {
          flagged++;
          check(`gate:phase-${name}`, 'warn', `gate=passed but missing evidence_required: ${missingEv.join(', ')}`);
        }
        continue;
      }
      flagged++;
      check(`gate:phase-${name}`, 'warn', `gate=passed but no assumption: and no artifacts: listed`);
      continue;
    }
    const missing = entry.artifacts.filter((rel) => !existsSync(join(ROOT, rel)));
    if (missing.length) {
      flagged++;
      check(`gate:phase-${name}`, 'warn', `gate=passed but missing on disk: ${missing.join(', ')}`);
    }
  }
  if (scanned === 0) check('gate:phase-artifacts', 'skip', 'no phases with gate=passed');
  else if (flagged === 0) check('gate:phase-artifacts', 'ok', `${scanned} passed phase(s) have assumption or on-disk artifacts`);
}

// Active-sprint STM continuity: progress file required when last_touched is stale/absent.
if (!stateRaw) {
  check('gate:sprint-continuity', 'skip', 'no state.yaml');
} else {
  const sprintStatus = parseSprints(stateRaw);
  const lastTouched = parseSprintLastTouched(stateRaw);
  const active = [...sprintStatus.entries()].filter(([, st]) => st === 'active');
  if (!active.length) {
    check('gate:sprint-continuity', 'skip', 'no active sprint');
  } else {
    const STALE_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let flagged = 0;
    for (const [id] of active) {
      const progressRel = join(paths.runsPath('sprints'), `${id}-progress.md`);
      const progressAbs = join(ROOT, progressRel);
      if (existsSync(progressAbs)) continue;
      const lt = lastTouched.get(id);
      const stale = !lt || Number.isNaN(Date.parse(lt)) || (now - Date.parse(lt) > STALE_MS);
      if (stale) {
        flagged++;
        check(
          'gate:sprint-continuity',
          'warn',
          `active sprint ${id} missing ${progressRel.replace(/\\/g, '/')}` +
            (lt ? ` and last_touched=${lt} is stale/absent` : ' and last_touched is absent'),
        );
      }
    }
    if (flagged === 0) {
      check('gate:sprint-continuity', 'ok', `${active.length} active sprint(s) have progress or fresh last_touched`);
    }
  }
}

// Diff-scoped gate receipts (ADR-012): scripts present; warn when active sprint + production diff lacks passing aggregate.
{
  const scriptsDir = join(ROOT, paths.scripts);
  const testGate = join(scriptsDir, 'gates', 'test-gate.mjs');
  const qualityGate = join(scriptsDir, 'gates', 'quality-gate.mjs');
  if (!existsSync(testGate) || !existsSync(qualityGate)) {
    check('gate:diff-receipts', 'skip', 'gate runners not installed in paths.scripts');
  } else if (!stateRaw) {
    check('gate:diff-receipts', 'skip', 'no state.yaml');
  } else {
    const sprintStatus = parseSprints(stateRaw);
    const active = [...sprintStatus.entries()].filter(([, st]) => st === 'active');
    if (!active.length) {
      check('gate:diff-receipts', 'ok', 'gate runners present; no active sprint');
    } else {
      let hasProd = false;
      try {
        const { hasProductionPaths, listChangedPaths } = await import('../../gates/lib/diff-paths.mjs');
        hasProd = hasProductionPaths(listChangedPaths(ROOT));
      } catch {
        hasProd = false;
      }
      if (!hasProd) {
        check('gate:diff-receipts', 'ok', 'gate runners present; no production paths in working diff');
      } else {
        const { listGateRunDir, isPassingReceipt, readGateResult, findPassingGateRunForDiff } = await import('../../lib/gate-result.mjs');
        const { listChangedPaths } = await import('../../gates/lib/diff-paths.mjs');
        const changed = listChangedPaths(ROOT);
        const match = findPassingGateRunForDiff(ROOT, changed);
        if (match) {
          check(
            'gate:diff-receipts',
            'ok',
            `passing receipts for current diff under cache/gates/${match.runId}/`,
          );
        } else {
          const cacheGates = dirname(listGateRunDir(ROOT, '_probe'));
          let staleOnly = false;
          if (existsSync(cacheGates)) {
            for (const runId of readdirSync(cacheGates)) {
              if (runId.startsWith('_')) continue;
              const testR = readGateResult(ROOT, runId, 'test');
              const qualityR = readGateResult(ROOT, runId, 'quality');
              if (isPassingReceipt(testR) && isPassingReceipt(qualityR)) {
                staleOnly = true;
                break;
              }
            }
          }
          check(
            'gate:diff-receipts',
            'warn',
            staleOnly
              ? 'passing gate receipts exist but changed_paths do not match current production diff — re-run /midas-diff-gates'
              : 'active sprint + production diff: missing passing cache/gates/<run>/{test,quality}.json — run /midas-diff-gates before /close-sprint',
          );
        }
      }
    }
  }
}

// Close-ready preflight (ADR-012 A3): warn when active sprint fails readiness checks.
{
  const closeReadyScript = join(ROOT, paths.scripts, 'close-ready.mjs');
  if (!existsSync(closeReadyScript)) {
    check('gate:close-ready', 'skip', 'close-ready.mjs not installed in paths.scripts');
  } else if (!stateRaw) {
    check('gate:close-ready', 'skip', 'no state.yaml');
  } else {
    try {
      const { evaluateCloseReady } = await import('../../lib/close-ready.mjs');
      const report = evaluateCloseReady(ROOT);
      if (report.checks[0]?.id === 'active-sprint' && report.checks[0]?.status === 'skip') {
        check('gate:close-ready', 'ok', 'no active sprint');
      } else if (report.ok) {
        check(
          'gate:close-ready',
          'ok',
          report.sprint_id ? `sprint ${report.sprint_id} ready for /close-sprint` : 'ready',
        );
      } else {
        const warns = report.checks.filter((c) => c.status === 'warn').map((c) => c.id);
        check(
          'gate:close-ready',
          'warn',
          `sprint ${report.sprint_id ?? '?'} not ready — ${warns.join(', ')} (run close-ready.mjs)`,
        );
      }
    } catch (err) {
      check('gate:close-ready', 'warn', err instanceof Error ? err.message : String(err));
    }
  }
}
}
