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
 * @param {{ wrapRoot?: boolean, preserveExisting?: boolean }} [opts] — optionally wrap the root
 * config on Windows and refuse to overwrite a pre-existing Cursor config that is not owned by Midas
 */
export function syncCursorMcp(root, toolsOrYaml, opts = {}) {
  const { wrapRoot = false, preserveExisting = false } = opts;
  const tools = Array.isArray(toolsOrYaml)
    ? toolsOrYaml
    : parseToolsFromStateYaml(toolsOrYaml || '');
  if (!tools?.includes('cursor')) return { synced: false, reason: 'cursor-not-in-tools' };
  const src = join(root, '.mcp.json');
  if (!existsSync(src)) return { synced: false, reason: 'no-root-mcp' };
  if (wrapRoot) fixMcpFileForWindows(src);
  const content = readFileSync(src, 'utf8');
  const dst = join(root, '.cursor', 'mcp.json');
  const desired = content.endsWith('\n') ? content : `${content}\n`;
  if (preserveExisting && existsSync(dst) && !sameJson(readFileSync(dst, 'utf8'), desired)) {
    return { synced: false, reason: 'cursor-mcp-conflict', conflict: true };
  }
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, desired, 'utf8');
  fixMcpFileForWindows(dst);
  return { synced: true };
}

function sameJson(left, right) {
  try {
    return stableJson(JSON.parse(left)) === stableJson(JSON.parse(right));
  } catch {
    return left.replace(/\r\n/g, '\n') === right.replace(/\r\n/g, '\n');
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
