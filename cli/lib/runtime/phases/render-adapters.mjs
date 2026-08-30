// render-adapters.mjs — install phase: render host adapters, MCP, hooks, gitignore.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readOwnershipManifest, sha256File } from '../../shared/ownership-manifest.mjs';

/**
 * @param {object} bag
 * @param {object} session
 */
export async function applyRenderAdapters(bag, session) {
  const paths = session.paths || await bag.loadPaths(bag.TARGET);
  session.paths = paths;
  const activeTools = session.activeTools || session.selectedTools || bag.readToolsFromState(paths) || bag.DEFAULT_TOOLS;
  session.activeTools = activeTools;
  try {
    const mod = await bag.importTrustedScript('render-adapters.mjs');
    if (typeof mod.renderAdapters === 'function') {
      mod.renderAdapters(bag.TARGET);
      bag.rendered = true;
    }
    if (typeof mod.writeEngineRegistries === 'function') {
      const reg = mod.writeEngineRegistries(bag.TARGET, paths.engine);
      bag.written.push(reg.gates, reg.checks);
    }
  } catch (err) {
    throw new Error(`adapter render failed: ${err.message || err}`);
  }
  bag.pruneOrphanAdapters(activeTools, paths.layout);
  bag.pruneLegacyRootArtifacts(activeTools);
  bag.fillAgents(session.selectedTools, paths);
  {
    const mcpSyncPath = bag.trustedScriptPath('mcp-cursor-sync.mjs');
    if (existsSync(mcpSyncPath)) {
      const { fixMcpFileForWindows, syncCursorMcp } = await bag.importTrustedScript('mcp-cursor-sync.mjs');
      const rootMcp = join(bag.TARGET, '.mcp.json');
      if (existsSync(rootMcp) && bag.written.includes('.mcp.json')) {
        if (fixMcpFileForWindows(rootMcp)) bag.written.push('.mcp.json');
      }
      const priorManifest = readOwnershipManifest(bag.TARGET);
      const priorCursorMcp = priorManifest?.files?.find((file) => file.path === '.cursor/mcp.json');
      const ownedCursorMcp = priorCursorMcp &&
        existsSync(join(bag.TARGET, '.cursor', 'mcp.json')) &&
        sha256File(join(bag.TARGET, '.cursor', 'mcp.json')) === priorCursorMcp.sha256;
      const r = syncCursorMcp(bag.TARGET, activeTools, {
        wrapRoot: bag.written.includes('.mcp.json'),
        preserveExisting: !ownedCursorMcp,
      });
      if (r.conflict) {
        throw new Error(
          '.cursor/mcp.json differs from .mcp.json; reconcile the user-owned Cursor config before installing',
        );
      }
      if (r.synced && !bag.written.includes('.cursor/mcp.json')) bag.written.push('.cursor/mcp.json');
    }
  }
  if (activeTools.includes('cursor')) {
    bag.mergeTraceHooks(bag.TARGET);
    bag.mergeSafetyHooks(bag.TARGET);
    bag.mergeCarryoverHooks(bag.TARGET);
    bag.mergeContextCostHooks(bag.TARGET);
  }
  bag.gitignoreResult = await bag.ensureGitignore(paths);
}
