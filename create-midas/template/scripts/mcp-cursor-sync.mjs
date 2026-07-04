// mcp-cursor-sync.mjs — Cursor reads `.cursor/mcp.json`, not root `.mcp.json` (Claude Code).
// Sync root → Cursor path on install; wrap bare `npx` on Windows for both files.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseToolsFromStateYaml } from './yaml-lite.mjs';

/** Mutate json in place: bare `npx` → `cmd /c npx …` on Windows. Returns true if changed. */
export function wrapMcpServersForWindows(json) {
  if (process.platform !== 'win32') return false;
  let changed = false;
  for (const server of Object.values(json.mcpServers || {})) {
    if (server && server.command === 'npx') {
      server.args = ['/c', 'npx', ...(server.args || [])];
      server.command = 'cmd';
      changed = true;
    }
  }
  return changed;
}

/** Fix one MCP JSON file on disk when on Windows. */
export function fixMcpFileForWindows(filePath) {
  if (process.platform !== 'win32' || !existsSync(filePath)) return false;
  let json;
  try {
    json = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return false;
  }
  if (!wrapMcpServersForWindows(json)) return false;
  writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  return true;
}

/**
 * Copy root `.mcp.json` → `.cursor/mcp.json` when `cursor` is in tools.
 * @param {string} root — project root
 * @param {string|string[]|null} toolsOrYaml — `tools:` array or raw state.yaml
 * @param {{ wrapRoot?: boolean }} [opts] — wrap root `.mcp.json` on Windows (installer fresh write / --update)
 */
export function syncCursorMcp(root, toolsOrYaml, opts = {}) {
  const { wrapRoot = false } = opts;
  const tools = Array.isArray(toolsOrYaml)
    ? toolsOrYaml
    : parseToolsFromStateYaml(toolsOrYaml || '');
  if (!tools?.includes('cursor')) return { synced: false, reason: 'cursor-not-in-tools' };
  const src = join(root, '.mcp.json');
  if (!existsSync(src)) return { synced: false, reason: 'no-root-mcp' };
  const content = readFileSync(src, 'utf8');
  const dst = join(root, '.cursor', 'mcp.json');
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  if (wrapRoot) fixMcpFileForWindows(src);
  fixMcpFileForWindows(dst);
  return { synced: true };
}
