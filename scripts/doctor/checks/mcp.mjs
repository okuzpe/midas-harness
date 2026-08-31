// mcp.mjs — doctor health checks (mcp).

export const id = "mcp";

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

// critical files
for (const f of ['AGENTS.md', join(paths.engine, 'conventions.md'), join(paths.engine, 'methodology.md')]) {
  check(`file:${f.replace(/\\/g, '/')}`, existsSync(join(ROOT, f)) ? 'ok' : 'warn', existsSync(join(ROOT, f)) ? '' : 'missing');
}

{
  const gi = auditGitignore(ROOT);
  check('gitignore:midas-block', gi.status, gi.note);
}

// .mcp.json must be secret-free (only ${ENV_VAR} placeholders)
const mcp = read('.mcp.json');
if (mcp === null) {
  check('mcp:secret-free', 'skip', 'no .mcp.json');
} else {
  let leak = false;
  const re = /(authorization|token|api[_-]?key|secret|password)"\s*:\s*"([^"]+)"/gi;
  let mm;
  while ((mm = re.exec(mcp))) if (!/^\$\{[A-Z0-9_]+\}$/.test(mm[2])) leak = true;
  if (/\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,})\b/.test(mcp)) leak = true;
  check('mcp:secret-free', leak ? 'warn' : 'ok', leak ? 'a literal secret may be present — use ${ENV_VAR}' : '');
  const governance = evaluateMcpGovernance(mcp);
  const mcpGovernance = (stateRaw?.match(/^mcp_governance:\s*(\S+)/m) || [])[1]?.replace(/['"]/g, '') || 'runlayer';
  let govStatus = governance.status;
  let govNote = governance.note;
  if (mcpGovernance === 'self_managed' && governance.status === 'warn' && governance.shadowServers?.length) {
    govStatus = 'ok';
    govNote = `self_managed — ${governance.note}`;
  }
  check('mcp:governance', govStatus, govNote);
}

// Always emit this name (characterization identity). Skip off Windows; on Windows, bare
// `npx` cannot spawn MCP servers (npx is a .cmd) and must be wrapped in `cmd /c`.
if (process.platform !== 'win32') {
  check('mcp:win-npx', 'skip', 'not Windows');
} else if (mcp === null) {
  check('mcp:win-npx', 'skip', 'no .mcp.json');
} else {
  try {
    const j = JSON.parse(mcp);
    const bare = Object.entries(j.mcpServers || {}).filter(([, s]) => s && s.command === 'npx').map(([k]) => k);
    check('mcp:win-npx', bare.length ? 'warn' : 'ok',
      bare.length ? `${bare.join(', ')}: bare npx won't spawn on Windows — wrap in \`cmd /c\` (re-run the installer with --force)` : '');
  } catch {
    check('mcp:win-npx', 'skip', 'mcp.json not parseable');
  }
}

{
  const tools = stateRaw ? parseToolsFromStateYaml(stateRaw) : null;
  if (tools?.includes('cursor')) {
    const cursorMcp = read('.cursor/mcp.json');
    if (cursorMcp === null) {
      check('mcp:cursor-sync', 'warn', `\`.cursor/mcp.json\` missing — Cursor does not read root \`.mcp.json\`; run \`${doctorCmd} --fix\` or re-run the installer`);
    } else if (mcp !== null) {
      let drifted = false;
      try {
        const rootJson = JSON.parse(mcp);
        const cursorJson = JSON.parse(cursorMcp);
        const expected = JSON.parse(JSON.stringify(rootJson));
        wrapMcpServersForWindows(expected);
        drifted = JSON.stringify(cursorJson) !== JSON.stringify(expected);
      } catch {
        drifted = cursorMcp.replace(/\r\n/g, '\n').trim() !== mcp.replace(/\r\n/g, '\n').trim();
      }
      check('mcp:cursor-sync', drifted ? 'warn' : 'ok',
        drifted ? '`.cursor/mcp.json` drifted from `.mcp.json` — run `' + doctorCmd + ' --fix` to sync' : '');
    } else {
      check('mcp:cursor-sync', 'ok', '');
    }

    const carryoverScript = join(ROOT, paths.scripts, 'carryover-refresh.mjs');
    if (!existsSync(carryoverScript)) {
      check('gate:carryover-hook', 'skip', 'carryover-refresh.mjs not installed in paths.scripts');
    } else {
      const hooksRaw = read('.cursor/hooks.json');
      if (hooksRaw === null) {
        check(
          'gate:carryover-hook',
          'warn',
          '`.cursor/hooks.json` missing — re-run installer with `--tools=cursor` or merge carryover sessionStart hook',
        );
      } else {
        try {
          const hooks = JSON.parse(hooksRaw);
          const list = hooks?.hooks?.sessionStart;
          const hasCarryover = Array.isArray(list) && list.some(
            (h) => h && typeof h.command === 'string' && h.command.includes('carryover-refresh.mjs'),
          );
          check(
            'gate:carryover-hook',
            hasCarryover ? 'ok' : 'warn',
            hasCarryover
              ? ''
              : 'sessionStart missing carryover-refresh.mjs — re-run installer or merge carryover hook',
          );
        } catch {
          check('gate:carryover-hook', 'warn', '`.cursor/hooks.json` invalid JSON');
        }
      }
    }

    const contextCostScript = join(ROOT, paths.scripts, 'context-cost-refresh.mjs');
    if (!existsSync(contextCostScript)) {
      check('gate:context-cost-hook', 'skip', 'context-cost-refresh.mjs not installed in paths.scripts');
    } else {
      const hooksRawCost = read('.cursor/hooks.json');
      if (hooksRawCost === null) {
        check(
          'gate:context-cost-hook',
          'warn',
          '`.cursor/hooks.json` missing — re-run installer with `--tools=cursor` or merge context-cost sessionStart hook',
        );
      } else {
        try {
          const hooks = JSON.parse(hooksRawCost);
          const list = hooks?.hooks?.sessionStart;
          const hasContextCost = Array.isArray(list) && list.some(
            (h) => h && typeof h.command === 'string' && h.command.includes('context-cost-refresh.mjs'),
          );
          check(
            'gate:context-cost-hook',
            hasContextCost ? 'ok' : 'warn',
            hasContextCost
              ? ''
              : 'sessionStart missing context-cost-refresh.mjs — re-run installer or merge context-cost hook',
          );
        } catch {
          check('gate:context-cost-hook', 'warn', '`.cursor/hooks.json` invalid JSON');
        }
      }
    }

    const SAFETY_HOOK_SCRIPTS = ['secrets-prompt.mjs', 'gate-commits.mjs', 'destructive-shell.mjs'];
    const hooksRawSafety = read('.cursor/hooks.json');
    if (hooksRawSafety === null) {
      check('gate:safety-hooks', 'skip', 'no .cursor/hooks.json');
    } else {
      try {
        const hooksDoc = JSON.parse(hooksRawSafety);
        const hookCommands = [
          ...(hooksDoc?.hooks?.beforeSubmitPrompt || []),
          ...(hooksDoc?.hooks?.beforeShellExecution || []),
        ]
          .map((h) => (h && typeof h.command === 'string' ? h.command : ''))
          .filter(Boolean);
        const wantsSafety = hookCommands.some(
          (cmd) => cmd.includes('scripts/safety/') || cmd.includes('.harness/scripts/safety/'),
        );
        if (!wantsSafety) {
          check('gate:safety-hooks', 'skip', 'no safety hook commands in .cursor/hooks.json');
        } else {
          let missing = false;
          for (const script of SAFETY_HOOK_SCRIPTS) {
            const scriptPath = join(ROOT, paths.scripts, 'safety', script);
            const ok = existsSync(scriptPath);
            if (!ok) missing = true;
            check(
              `gate:safety-script:${script}`,
              ok ? 'ok' : 'warn',
              ok ? '' : `missing ${paths.scripts}/safety/${script} — run installer --update`,
            );
          }
          check(
            'gate:safety-hooks',
            missing ? 'warn' : 'ok',
            missing ? 'safety hooks wired but script(s) missing on disk' : '',
          );
        }
      } catch {
        check('gate:safety-hooks', 'warn', '`.cursor/hooks.json` invalid JSON');
      }
    }
  }
}
{
  const templateMcp = read(join('cli', 'template', '.mcp.json'));
  if (templateMcp !== null && mcp !== null) {
    check(
      'mcp:template-sync',
      templateMcp === mcp ? 'ok' : 'warn',
      templateMcp === mcp ? '' : 'cli/template/.mcp.json drifted from root .mcp.json',
    );
  }
}
{
  const pluginRoot = join(ROOT, 'harness', 'plugins', 'midas');
  if (existsSync(pluginRoot) && pluginHelpers) {
    const { computePluginManifest, computePluginReadme, computeMarketplaceJson } = pluginHelpers;
    const pluginJson = read(join('harness', 'plugins', 'midas', '.claude-plugin', 'plugin.json'));
    if (pluginJson !== null) {
      check(
        'plugin:manifest-json',
        pluginJson === JSON.stringify(computePluginManifest(), null, 2) + '\n' ? 'ok' : 'warn',
        pluginJson === JSON.stringify(computePluginManifest(), null, 2) + '\n'
          ? ''
          : 'harness/plugins/midas/.claude-plugin/plugin.json drifted from the generated manifest',
      );
    }
    const pluginReadme = read(join('harness', 'plugins', 'midas', 'README.md'));
    if (pluginReadme !== null) {
      check(
        'plugin:readme',
        pluginReadme === computePluginReadme() ? 'ok' : 'warn',
        pluginReadme === computePluginReadme() ? '' : 'harness/plugins/midas/README.md drifted from the generated README',
      );
    }
    const marketplaceJson = read(join('harness', '.claude-plugin', 'marketplace.json'));
    if (marketplaceJson !== null) {
      check(
        'plugin:marketplace-json',
        marketplaceJson === JSON.stringify(computeMarketplaceJson(), null, 2) + '\n' ? 'ok' : 'warn',
        marketplaceJson === JSON.stringify(computeMarketplaceJson(), null, 2) + '\n'
          ? ''
          : 'harness/.claude-plugin/marketplace.json drifted from the generated marketplace',
      );
    }
  }
}

{
  const mcpDrift = evaluateMcpDeclaredVsWired(stateRaw, mcp);
  check('mcp:declared-vs-wired', mcpDrift.status, mcpDrift.note);
}
{
  const required = collectSkillMcpRequired(join(ROOT, paths.engine, 'skills'));
  const skillMcp = evaluateSkillMcpRequired(required, mcp);
  check('mcp:skill-required', skillMcp.status, skillMcp.note);
}
}
