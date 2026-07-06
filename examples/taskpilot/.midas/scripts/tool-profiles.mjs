// tool-profiles.mjs — supported AI tools: compatibility matrix + install onboarding (dependency-free).

import { resolvePaths } from './paths.mjs';

/** @typedef {'Full'|'Good'|'Basic'} ToolLevel */

/** Order matches create-midas KNOWN_TOOLS. */
export const TOOL_IDS = ['claude-code', 'cursor', 'windsurf', 'gemini', 'codex', 'copilot'];

/** Adapter tools that get a generated file from render-adapters.mjs. */
export const ADAPTER_TOOL_IDS = ['claude-code', 'cursor', 'windsurf', 'gemini'];

/**
 * @type {Record<string, {
 *   label: string,
 *   level: ToolLevel,
 *   agentsMd: string,
 *   skills: string,
 *   routing: string,
 *   adapters: string[],
 *   extras: string[],
 *   onboarding: string[],
 * }>}
 */
export const TOOL_PROFILES = {
  'claude-code': {
    label: 'Claude Code',
    level: 'Full',
    agentsMd: 'via @AGENTS.md in CLAUDE.md',
    skills: 'native (.claude/skills/) + subagents',
    routing: '✅ per-agent',
    adapters: ['CLAUDE.md'],
    extras: ['.claude/agents/'],
    onboarding: [
      'Open the project in Claude Code.',
      'Run `/midas-init` once (guided setup), then `/midas-status` for the next command.',
      'Optional: `/plugin install midas@midas` if you use the Claude marketplace instead of npx install.',
    ],
  },
  cursor: {
    label: 'Cursor',
    level: 'Good',
    agentsMd: 'native',
    skills: '.claude/skills/ + .cursor/rules/ + .cursor/mcp.json',
    routing: 'advisory',
    adapters: ['.cursor/rules/00-midas.mdc'],
    extras: ['.cursor/mcp.json', '.claude/skills/', 'AGENTS.md'],
    onboarding: [
      'Reload Window after install (Ctrl+Shift+P → “Reload Window”).',
      'Settings → Tools & MCP — enable `sequential-thinking` (from `.cursor/mcp.json`).',
      'In Agent chat, type `/midas-init` once, then `/midas-status` (skills load from `.claude/skills/`).',
      'Use your strongest model for architecture/audits; fastest for research (see AGENTS.md).',
    ],
  },
  windsurf: {
    label: 'Windsurf',
    level: 'Basic',
    agentsMd: 'native',
    skills: '.windsurf/rules/ + AGENTS.md',
    routing: 'advisory',
    adapters: ['.windsurf/rules/00-midas.md'],
    extras: ['AGENTS.md'],
    onboarding: [
      'Open the project in Windsurf — rules load from `.windsurf/rules/00-midas.md`.',
      'Re-open the editor after `/midas-doctor` re-renders adapters.',
      'Run `/midas-init` if your host exposes Midas skills; otherwise follow AGENTS.md phase commands.',
    ],
  },
  gemini: {
    label: 'Gemini CLI',
    level: 'Good',
    agentsMd: 'GEMINI.md + AGENTS.md',
    skills: 'GEMINI.md context + gemini-extension.json',
    routing: 'advisory',
    adapters: ['GEMINI.md'],
    extras: ['gemini-extension.json', 'AGENTS.md'],
    onboarding: [
      'From the project root: `gemini` — GEMINI.md is project memory (rules + CHECK digest).',
      'Register the extension once: `gemini extensions link .` (uses `gemini-extension.json`).',
      'Drive phases via natural language or paste commands from `/midas-status` output.',
    ],
  },
  codex: {
    label: 'OpenAI Codex',
    level: 'Good',
    agentsMd: 'native',
    skills: '.claude/skills/ (Agent Skills) + AGENTS.md',
    routing: 'advisory',
    adapters: [],
    extras: ['AGENTS.md', '.claude/skills/'],
    onboarding: [
      'Open the project in Codex — AGENTS.md is project law (always-on).',
      'Agent Skills in `.claude/skills/` are discovered where your Codex build supports them.',
      'Apply routing as intent: strongest model for gates/audits, fastest for search (AGENTS.md).',
    ],
  },
  copilot: {
    label: 'GitHub Copilot',
    level: 'Good',
    agentsMd: 'native',
    skills: '.claude/skills/ (Agent Skills) + AGENTS.md',
    routing: 'advisory',
    adapters: [],
    extras: ['AGENTS.md', '.claude/skills/'],
    onboarding: [
      'Open the project in your editor with Copilot — AGENTS.md is project law.',
      'Agent Skills in `.claude/skills/` load where Copilot Agent Skills are enabled.',
      'Use `/midas-init` workflow via Copilot chat when skills are available.',
    ],
  },
};

/** Layout-aware doctor command for install onboarding (classic vs compact). */
export function doctorCommandFor(projectRoot = '.') {
  const paths = resolvePaths(projectRoot);
  const scripts = paths.scripts.replace(/\\/g, '/');
  return `node ${scripts}/doctor.mjs`;
}

/** Markdown table for README / docs (pipe table). */
export function formatSupportedToolsMarkdown() {
  const header =
    '| Tool | Reads `AGENTS.md` | Skills / commands | Model routing | Level |\n|---|---|---|---|---|';
  const rows = TOOL_IDS.map((id) => {
    const p = TOOL_PROFILES[id];
    const name = id === 'claude-code' ? '**Claude Code**' : p.label === 'Cursor' ? 'Cursor' : p.label;
    const boldLevel = p.level === 'Full' || id === 'cursor' || id === 'gemini' || id === 'codex'
      ? `**${p.level}**`
      : p.level;
    return `| ${name} | ${p.agentsMd} | ${p.skills} | ${p.routing} | ${boldLevel} |`;
  });
  return `${header}\n${rows.join('\n')}`;
}

/** Compact ASCII table for installer TTY prompt. */
export function printCompatibilityMatrix(selectedIds = TOOL_IDS) {
  console.log('\n  Supported tools — what Midas wires on install');
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log('  Tool           Level   Skills / commands');
  for (const id of TOOL_IDS) {
    const p = TOOL_PROFILES[id];
    const mark = selectedIds.includes(id) ? '●' : '○';
    const tool = `${mark} ${id}`.padEnd(16);
    const level = p.level.padEnd(7);
    console.log(`  ${tool}${level}${p.skills}`);
  }
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log('  ● = selected   ○ = not selected');
  console.log('  Presets: c = cursor only · s = cursor,gemini,codex · a = all adapter tools (default)');
}

/** Per-tool onboarding after install. */
export function printToolOnboarding(activeTools, projectRoot = '.') {
  const tools = activeTools.filter((t) => TOOL_PROFILES[t]);
  if (!tools.length) return;

  const doctorCmd = doctorCommandFor(projectRoot);
  const layout = resolvePaths(projectRoot).layout;

  console.log('\n  ── Tool compatibility ───────────────────────────────────────');
  console.log(`  Layout: ${layout}   ·   verify: ${doctorCmd}`);
  console.log('  Tool           Level   Wired by this install');
  for (const id of tools) {
    const p = TOOL_PROFILES[id];
    const wired = [...p.adapters, ...p.extras].join(' · ') || 'AGENTS.md · .claude/skills/';
    console.log(`  ${p.label.padEnd(16)}${p.level.padEnd(8)}${wired}`);
  }

  for (const id of tools) {
    const p = TOOL_PROFILES[id];
    console.log(`\n  ── ${p.label} — next steps ──`);
    p.onboarding.forEach((line, i) => console.log(`     ${i + 1}. ${line}`));
  }
}

/** Parse interactive preset shortcuts. */
export function parseToolsPreset(raw) {
  const t = raw.trim().toLowerCase();
  if (!t || t === 'a' || t === 'all') return null;
  if (t === 'c' || t === 'cursor') return ['cursor'];
  if (t === 's' || t === 'stack' || t === 'cursor,gemini,codex') return ['cursor', 'gemini', 'codex'];
  return null;
}
