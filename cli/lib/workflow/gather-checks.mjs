// gather-checks.mjs — installer requirement + preflight check lists (no I/O besides reads).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  compareVersions,
  detectLegacyLayout,
  isMidasEngineRepository,
  isV1Install,
  V1_REFUSE_MESSAGE,
  yamlScalar,
} from '../core/context.mjs';
import { formatUpdateCmd } from '../core/install-cmd.mjs';
import { assessUpdateConflicts } from '../core/conflicts.mjs';
import { evaluateMcpGovernance } from '../shared/mcp-drift.mjs';

export function gatherRequirements(cmd, ctx, deps) {
  const out = [];
  const legacy = detectLegacyLayout(ctx.dir);

  if (['install', 'update', 'migrate'].includes(cmd.command) && isMidasEngineRepository(ctx.dir)) {
    out.push({
      id: 'not-engine-repo',
      ok: false,
      message:
        'refusing to install/update/migrate into the midas-harness engine repository — ' +
        'edit harness/ (source) and ship via create-midas; do not nest .harness/engine here. ' +
        'Use a separate product directory or scripts/fixtures/ for install tests.',
    });
  }

  if (cmd.layout && cmd.layout !== 'harness') {
    out.push({
      id: 'layout',
      ok: false,
      message: '3.x writes only --layout=harness. 1.x classic/compact/hub trees are unsupported — pin create-midas@2.10.x, migrate, then upgrade.',
    });
  } else {
    out.push({ id: 'layout', ok: true, message: 'layout=harness' });
  }

  if (cmd.command === 'update') {
    out.push({
      id: 'existing-install',
      ok: ctx.installed,
      message: ctx.installed
        ? 'existing install found'
        : `update found no existing Midas install in ${ctx.dir} — install first: ${deps.installCmd}`,
    });
    out.push({
      id: 'not-legacy',
      ok: !isV1Install(ctx.dir),
      message: isV1Install(ctx.dir)
        ? V1_REFUSE_MESSAGE
        : 'canonical product install',
    });
  }

  if (cmd.command === 'install' && !cmd.force) {
    out.push({
      id: 'not-nested',
      ok: !ctx.ancestorRoot,
      message: ctx.ancestorRoot
        ? `${ctx.dir} is already inside a Midas project (root: ${ctx.ancestorRoot}). Pass --force for a nested install.`
        : 'no ancestor install',
    });
  }

  if (cmd.command === 'install' && ctx.installed && ctx.role === 'product' && ctx.engineVersion) {
    const behind = compareVersions(ctx.engineVersion, deps.bundledVersion) < 0;
    if (behind) {
      out.push({
        id: 'install-vs-update',
        ok: false,
        message:
          `existing install at engine v${ctx.engineVersion}; use ${formatUpdateCmd({ version: deps.bundledVersion })} instead of a fresh install`,
      });
    }
  }

  if (cmd.command === 'migrate') {
    const found = ctx.installed || !!legacy;
    out.push({
      id: 'legacy-or-harness',
      ok: found,
      message: found
        ? `layout=${ctx.layout || legacy}`
        : 'no Midas 1.x install found',
    });
  }

  return out;
}

export function gatherChecks(cmd, ctx, deps, channelStatus = null) {
  const out = [];
  const legacy = detectLegacyLayout(ctx.dir);
  out.push({
    id: 'template',
    ok: true,
    message: `bundled template v${deps.bundledVersion}`,
  });

  if (cmd.command === 'update' || cmd.command === 'migrate') {
    const dirty = spawnSync('git', ['status', '--porcelain'], {
      cwd: ctx.dir,
      encoding: 'utf8',
    });
    if (dirty.status === 0 && (dirty.stdout || '').trim()) {
      const lines = (dirty.stdout || '').trim().split(/\r?\n/).length;
      out.push({
        id: 'git-dirty',
        ok: true,
        message: `working tree has ${lines} dirty path(s) — commit or stash before migrate/update if you need a clean restore point (not blocking)`,
      });
    }
  }

  if (cmd.command === 'migrate') {
    if (legacy === 'conflict') {
      out.push({
        id: 'layout-conflict',
        ok: false,
        message:
          'layout markers conflict (classic/hub and .harness coexist) — resolve manually or restore from git before migrate',
      });
    } else {
      out.push({
        id: 'layout',
        ok: true,
        message: legacy ? `will migrate ${legacy} → harness` : 'no legacy layout markers',
      });
    }

    const stateRaw = ctx.stateRaw || '';
    const hasGov = !!yamlScalar(stateRaw, 'mcp_governance');
    const mcpPath = join(ctx.dir, '.mcp.json');
    if (existsSync(mcpPath)) {
      try {
        const gov = evaluateMcpGovernance(readFileSync(mcpPath, 'utf8'));
        const shadows = gov.shadowServers || [];
        if (shadows.length && !hasGov) {
          out.push({
            id: 'mcp-self-managed',
            ok: true,
            message:
              `shadow MCP(s) ${shadows.join(', ')} — will set mcp_governance: self_managed on apply ` +
              `(switch to runlayer after moving servers to Runlayer-managed URLs)`,
          });
        } else if (shadows.length && hasGov) {
          out.push({
            id: 'mcp-governance',
            ok: true,
            message: `mcp_governance=${yamlScalar(stateRaw, 'mcp_governance')} with shadow MCP(s): ${shadows.join(', ')}`,
          });
        }
      } catch {
        out.push({
          id: 'mcp-json',
          ok: true,
          message: '.mcp.json present but not valid JSON — doctor will report after apply',
        });
      }
    }
  }

  if (cmd.command === 'update') {
    const assessment = assessUpdateConflicts(ctx.dir);
    out.push({
      id: 'manifest',
      ok: !!assessment.manifest,
      message: assessment.manifest
        ? `manifest midas_version=${assessment.manifest.midas_version}`
        : 'canonical install has no valid .harness/manifest.json — run --migrate for a legacy layout, or repair the manifest before updating',
    });
    if (assessment.manifest) {
      const isUpgrade = compareVersions(assessment.manifest.midas_version || '0.0.0', deps.bundledVersion) < 0;
      out.push({
        id: 'version',
        ok: true,
        message: isUpgrade
          ? `upgrade ${assessment.manifest.midas_version} → ${deps.bundledVersion}`
          : `refresh at ${deps.bundledVersion}`,
      });
      out.push({
        id: 'vendor-conflicts',
        ok: true,
        message: assessment.vendorConflicts.length === 0
          ? 'no vendor conflicts'
          : `${assessment.vendorConflicts.length} locally-modified vendor file(s) will be overwritten` +
            ' (local versions saved to .harness/conflicts/) — project overrides belong in .harness/rules',
      });
      out.push({
        id: 'mirror-conflicts',
        ok: true,
        message: assessment.mirrorConflicts.length === 0
          ? 'no generated-mirror conflicts'
          : `${assessment.mirrorConflicts.length} modified generated mirror(s) will be regenerated: ${assessment.mirrorConflicts.join(', ')}`,
      });
    }
    if (channelStatus) {
      out.push({
        id: 'channel',
        ok: true,
        message: channelStatus.fetched.manifest
          ? `channel ${channelStatus.channel} (${channelStatus.fetched.source}) — ${channelStatus.comparison.reason}`
          : `channel ${channelStatus.channel} unavailable — ${channelStatus.fetched.error || 'no manifest'}; refreshing from the bundle`,
      });
      if (channelStatus.integrity.ok === false) {
        const publishedVer = channelStatus.fetched.manifest?.version;
        const stableReleaseMismatch =
          channelStatus.channel === 'stable' &&
          publishedVer &&
          publishedVer === deps.bundledVersion;
        out.push({
          id: 'bundle-integrity',
          ok: !stableReleaseMismatch,
          message: stableReleaseMismatch
            ? `${channelStatus.integrity.reason} — this bundle is not the published stable release`
            : `${channelStatus.integrity.reason} — expected on unpinned main, edge, or a local build`,
        });
      }
    }
  }

  return out;
}
