// mcp-drift.mjs — reconcile state.yaml → mcp: intent and skill mcp-required with .mcp.json wiring.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Browser MCP ids in state.yaml / .mcp.json server keys. */
export const BROWSER_MCP_IDS = ['playwright', 'chrome-devtools'];

/** Declared in state but often left unwired in committed .mcp.json (remote / optional). */
export const OPTIONAL_MCP_IDS = ['context7', 'maestro'];

/** Parse `mcp: [a, b]` from state.yaml → string[] (no YAML dependency). */
export function parseMcpList(yaml) {
  const m = yaml.match(/^mcp:\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** MCP server keys from `.mcp.json`, ignoring template comment keys (`{{!…}}`). */
export function mcpServerKeys(jsonText) {
  try {
    const j = JSON.parse(jsonText);
    return Object.keys(j.mcpServers || {}).filter((k) => !k.startsWith('{{!'));
  } catch {
    return [];
  }
}

function isRunlayerManaged(server) {
  if (typeof server?.url === 'string') {
    try {
      const host = new URL(server.url).hostname.toLowerCase();
      if (host === 'runlayer.com' || host.endsWith('.runlayer.com')) return true;
    } catch {
      return false;
    }
  }

  const invocation = [server?.command, ...(Array.isArray(server?.args) ? server.args : [])]
    .filter((part) => typeof part === 'string')
    .map((part) => part.toLowerCase());
  const runlayer = invocation.findIndex((part) => part === 'runlayer' || /(?:^|[\\/])runlayer(?:\.cmd|\.exe)?$/.test(part));
  return runlayer !== -1 &&
    invocation[runlayer + 1] === 'run' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invocation[runlayer + 2] || '');
}

function npmPackageSpec(server) {
  const command = String(server?.command || '').toLowerCase();
  const args = Array.isArray(server?.args) ? server.args.map(String) : [];
  let start = -1;
  if (command === 'npx' || command.endsWith('npx.cmd')) start = 0;
  if (command === 'npm' || command.endsWith('npm.cmd')) {
    const exec = args.findIndex((arg) => arg === 'exec' || arg === 'x');
    if (exec !== -1) start = exec + 1;
  }
  if (start === -1) return null;
  return args.slice(start).find((arg) => !arg.startsWith('-')) || null;
}

function isExactPackageVersion(spec) {
  if (!spec) return true;
  const versionAt = spec.startsWith('@') ? spec.lastIndexOf('@') : spec.indexOf('@');
  if (versionAt <= 0) return false;
  const version = spec.slice(versionAt + 1);
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
}

/**
 * Enforce organization MCP governance for active servers.
 * Runlayer-managed servers pass; direct servers are shadow MCPs even when version-pinned.
 */
export function evaluateMcpGovernance(jsonText) {
  if (!jsonText) return { status: 'skip', shadowServers: [], unpinnedServers: [], note: 'no .mcp.json' };
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { status: 'warn', shadowServers: [], unpinnedServers: [], note: 'invalid .mcp.json' };
  }

  const servers = Object.entries(parsed.mcpServers || {}).filter(([id]) => !id.startsWith('{{!'));
  const shadowServers = [];
  const unpinnedServers = [];
  for (const [id, server] of servers) {
    if (!isRunlayerManaged(server)) shadowServers.push(id);
    const spec = npmPackageSpec(server);
    if (spec && !isExactPackageVersion(spec)) unpinnedServers.push(id);
  }

  if (!shadowServers.length && !unpinnedServers.length) {
    return {
      status: 'ok',
      shadowServers,
      unpinnedServers,
      note: servers.length ? 'all active MCP servers are Runlayer-managed' : 'no active MCP servers',
    };
  }
  const notes = [];
  if (shadowServers.length) notes.push(`shadow MCPs: ${shadowServers.join(', ')}`);
  if (unpinnedServers.length) notes.push(`unpinned MCP packages: ${unpinnedServers.join(', ')}`);
  return { status: 'warn', shadowServers, unpinnedServers, note: notes.join('; ') };
}

/**
 * Advisory drift check — returns { status: 'ok'|'warn'|'skip', note }.
 * @param {string|null|undefined} stateYaml
 * @param {string|null|undefined} mcpJsonText
 */
export function evaluateMcpDeclaredVsWired(stateYaml, mcpJsonText) {
  if (!stateYaml) {
    return { status: 'skip', note: 'no state.yaml' };
  }
  const declared = parseMcpList(stateYaml);
  if (declared.length === 0) {
    return { status: 'skip', note: 'no mcp: list in state.yaml' };
  }
  const wired = mcpJsonText ? mcpServerKeys(mcpJsonText) : [];
  const missingOptional = declared.filter((id) => OPTIONAL_MCP_IDS.includes(id) && !wired.includes(id));
  const missingRequired = declared.filter((id) => !OPTIONAL_MCP_IDS.includes(id) && !wired.includes(id));

  if (missingRequired.length === 0) {
    const note = missingOptional.length
      ? `required wired; optional not in .mcp.json: ${missingOptional.join(', ')}`
      : 'all declared MCPs wired';
    return { status: 'ok', note };
  }

  if (!mcpJsonText) {
    return {
      status: 'warn',
      note: `state.yaml declares ${missingRequired.join(', ')} but no .mcp.json — render from harness/templates/mcp.json.tmpl`,
    };
  }

  const missingBrowser = missingRequired.filter((id) => BROWSER_MCP_IDS.includes(id));
  const missingOther = missingRequired.filter((id) => !BROWSER_MCP_IDS.includes(id));
  const parts = [];
  if (missingBrowser.length) {
    parts.push(`${missingBrowser.join(', ')}: uncomment harness/templates/mcp.json.tmpl browser blocks`);
  }
  if (missingOther.length) {
    parts.push(`${missingOther.join(', ')}: missing from .mcp.json mcpServers`);
  }
  return { status: 'warn', note: parts.join('; ') };
}

/** Parse `mcp-required: [a, b]` from a SKILL.md frontmatter block. */
export function parseSkillMcpRequired(skillMarkdown) {
  const m = skillMarkdown.match(/^mcp-required:\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** Collect union of all `mcp-required` ids from each `.claude/skills/<name>/SKILL.md`. */
export function collectSkillMcpRequired(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  const ids = new Set();
  for (const e of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = join(skillsDir, e.name, 'SKILL.md');
    if (!existsSync(file)) continue;
    for (const id of parseSkillMcpRequired(readFileSync(file, 'utf8'))) ids.add(id);
  }
  return [...ids];
}

function formatMcpMissingNote(missingRequired, mcpJsonText) {
  if (!mcpJsonText) {
    return `declares ${missingRequired.join(', ')} but no .mcp.json — render from harness/templates/mcp.json.tmpl`;
  }
  const missingBrowser = missingRequired.filter((id) => BROWSER_MCP_IDS.includes(id));
  const missingOther = missingRequired.filter((id) => !BROWSER_MCP_IDS.includes(id));
  const parts = [];
  if (missingBrowser.length) {
    parts.push(`${missingBrowser.join(', ')}: uncomment harness/templates/mcp.json.tmpl browser blocks`);
  }
  if (missingOther.length) {
    parts.push(`${missingOther.join(', ')}: missing from .mcp.json mcpServers`);
  }
  return parts.join('; ');
}

/**
 * Advisory: skill frontmatter `mcp-required` must be wired in `.mcp.json` (stricter than state intent).
 * @param {string[]} requiredIds
 * @param {string|null|undefined} mcpJsonText
 */
export function evaluateSkillMcpRequired(requiredIds, mcpJsonText) {
  if (!requiredIds.length) {
    return { status: 'skip', note: 'no skill mcp-required frontmatter' };
  }
  const wired = mcpJsonText ? mcpServerKeys(mcpJsonText) : [];
  const missing = requiredIds.filter((id) => !wired.includes(id));
  if (missing.length === 0) {
    return { status: 'ok', note: `skill mcp-required wired: ${requiredIds.join(', ')}` };
  }
  return {
    status: 'warn',
    note: `skill mcp-required ${formatMcpMissingNote(missing, mcpJsonText)}`,
  };
}
