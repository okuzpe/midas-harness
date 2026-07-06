// mcp-drift.mjs — reconcile state.yaml → mcp: intent and skill mcp-required with .mcp.json wiring.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Browser MCP ids in state.yaml / .mcp.json server keys. */
export const BROWSER_MCP_IDS = ['playwright', 'chrome-devtools'];

/** Declared in state but often left unwired in committed .mcp.json (remote / optional). */
export const OPTIONAL_MCP_IDS = ['context7'];

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
