// tool-profiles.mjs — supported AI tools: compatibility matrix + install onboarding (dependency-free).

import { resolvePaths } from './paths.mjs';
import { adapterPathsForTool, LEGACY_WINDSURF_ADAPTER_REL, LEGACY_WINDSURF_CHECKS_REL } from './render-adapters.mjs';

/** Order matches create-midas KNOWN_TOOLS. */
export const TOOL_IDS = ['claude-code', 'cursor', 'windsurf', 'gemini', 'codex', 'copilot'];

/** Adapter tools that get a generated file from render-adapters.mjs. */
export const ADAPTER_TOOL_IDS = ['claude-code', 'cursor', 'windsurf', 'gemini'];

/**
 * @type {Record<string, {
 *   label: string,
 *   agentsMd: string,
 *   skills: string,
 *   adapter: string,
 *   mcp: string,
 *   routing: string,
 *   onboarding: string[],
 * }>}>
 */
export const TOOL_PROFILES = {
  'claude-code': {
    label: 'Claude Code',
    agentsMd: 'via @AGENTS.md in CLAUDE.md',
    skills: 'native `.claude/skills/` + portable `.agents/skills/`',
    adapter: 'CLAUDE.md',
    mcp: 'project `.mcp.json`',
    routing: 'per-agent',
    onboarding: [
      'Open the project in Claude Code.',
      'Run `/midas-init` once (guided setup), then `/midas-status` for the next command.',
      'Optional: `/plugin install midas@midas` if you use the Claude marketplace instead of npx install.',
    ],
  },
  cursor: {
    label: 'Cursor',
    agentsMd: 'native `AGENTS.md`',
    skills: 'cursor-only `.cursor/skills/`; else `.agents/skills/` + rules',
    adapter: '.cursor/rules/00-midas.mdc',
    mcp: '`.cursor/mcp.json` sync',
    routing: 'advisory',
    onboarding: [
      'Reload Window after install (Ctrl+Shift+P → “Reload Window”).',
      'Settings → Tools & MCP — enable `sequential-thinking` if you want the optional MCP path.',
      'In Agent chat, type `/midas-init` once, then `/midas-status`; the generated rule file is the main contract.',
      'Use your fastest model for search and your strongest for architecture/audits (see AGENTS.md).',
    ],
  },
  windsurf: {
    label: 'Windsurf',
    agentsMd: 'native `AGENTS.md`',
    skills: 'portable `.agents/skills/` + nested `.harness/.windsurf/rules/` (v2)',
    adapter: '.harness/.windsurf/rules/00-midas.md',
    mcp: 'project `.mcp.json`',
    routing: 'advisory',
    onboarding: [
      'Open the project in Windsurf — the generated rule file is the main surface.',
      'Re-open the editor after `/midas-doctor` re-renders adapters.',
      'Follow AGENTS.md phase commands; skill loading is host-dependent and may be partial.',
    ],
  },
  gemini: {
    label: 'Gemini CLI',
    agentsMd: '`GEMINI.md` + `AGENTS.md`',
    skills: 'portable `.agents/skills/` + Gemini project memory',
    adapter: 'GEMINI.md',
    mcp: 'project `.mcp.json`',
    routing: 'advisory',
    onboarding: [
      'From the project root: `gemini` — GEMINI.md is project memory (conventions + pointer to checks.json).',
      'Register the extension once: `gemini extensions link .` (uses `gemini-extension.json`).',
      'Drive phases via natural language or paste commands from `/midas-status` output.',
    ],
  },
  codex: {
    label: 'OpenAI Codex',
    agentsMd: 'native `AGENTS.md`',
    skills: 'portable `.agents/skills/`',
    adapter: 'none',
    mcp: 'project `.mcp.json`',
    routing: 'advisory',
    onboarding: [
      'Open the project in Codex — AGENTS.md is project law (always-on).',
      'The portable `.agents/skills/` tree is the discovery path for Codex-compatible skills.',
      'Apply routing as intent: fastest for search, strongest for architecture and audits (AGENTS.md).',
    ],
  },
  copilot: {
    label: 'GitHub Copilot',
    agentsMd: 'native `AGENTS.md`',
    skills: 'portable `.agents/skills/`',
    adapter: 'none',
    mcp: 'project `.mcp.json`',
    routing: 'advisory',
    onboarding: [
      'Open the project in your editor with Copilot — AGENTS.md is project law.',
      'The portable `.agents/skills/` tree is the discovery path for Copilot-compatible skills.',
      'Use `/midas-init` workflow via Copilot chat when the host supports the slash-command flow.',
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
  const header = '| Tool | AGENTS.md | Skills | Adapter | MCP | Routing |';
  const divider = '|---|---|---|---|---|---|';
  const rows = TOOL_IDS.map((id) => {
    const p = TOOL_PROFILES[id];
    const name = id === 'claude-code' ? '**Claude Code**' : p.label;
    return `| ${name} | ${p.agentsMd} | ${p.skills} | ${p.adapter} | ${p.mcp} | ${p.routing} |`;
  });
  return `${header}\n${divider}\n${rows.join('\n')}`;
}

/** Compact ASCII table for installer TTY prompt. */
export function printCompatibilityMatrix(selectedIds = TOOL_IDS) {
  console.log('\n  Supported tools — what Midas wires on install');
  console.log('  ───────────────────────────────────────────────────────────────────────────────');
  console.log('  Tool           AGENTS.md           Skills                    Adapter   MCP              Routing');
  for (const id of TOOL_IDS) {
    const p = TOOL_PROFILES[id];
    const mark = selectedIds.includes(id) ? '●' : '○';
    const tool = `${mark} ${id}`.padEnd(16);
    const agents = p.agentsMd.padEnd(20);
    const skills = p.skills.padEnd(26);
    const adapter = p.adapter.padEnd(10);
    const mcp = p.mcp.padEnd(16);
    console.log(`  ${tool}${agents}${skills}${adapter}${mcp}${p.routing}`);
  }
  console.log('  ───────────────────────────────────────────────────────────────────────────────');
  console.log('  Presets: c = cursor only (default) · s = cursor,gemini,codex · a = all adapter tools');
}

/** Per-tool onboarding after install. */
export function printToolOnboarding(activeTools, projectRoot = '.') {
  const tools = activeTools.filter((t) => TOOL_PROFILES[t]);
  if (!tools.length) return;

  const doctorCmd = doctorCommandFor(projectRoot);
  const layout = resolvePaths(projectRoot).layout;

  console.log('\n  ── Tool compatibility ─────────────────────────────────────────────────────────');
  console.log(`  Layout: ${layout}   ·   verify: ${doctorCmd}`);
  console.log('  Tool           AGENTS.md           Skills                    Adapter');
  for (const id of tools) {
    const p = TOOL_PROFILES[id];
    console.log(`  ${p.label.padEnd(16)}${p.agentsMd.padEnd(20)}${p.skills.padEnd(26)}${p.adapter}`);
  }

  for (const id of tools) {
    const p = TOOL_PROFILES[id];
    console.log(`\n  ── ${p.label} — next steps ──`);
    console.log(`     AGENTS.md: ${p.agentsMd}`);
    console.log(`     Skills: ${p.skills}`);
    console.log(`     Adapter: ${p.adapter}`);
    console.log(`     MCP: ${p.mcp}`);
    console.log(`     Routing: ${p.routing}`);
    p.onboarding.forEach((line, i) => console.log(`     ${i + 1}. ${line}`));
  }
}

/** Parse interactive preset shortcuts. */
export function parseToolsPreset(raw) {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t === 'a' || t === 'all') return ['claude-code', 'cursor', 'windsurf', 'gemini'];
  if (t === 'c' || t === 'cursor') return ['cursor'];
  if (t === 's' || t === 'stack' || t === 'cursor,gemini,codex') return ['cursor', 'gemini', 'codex'];
  return null;
}

/** Portable hosts that share `.agents/skills` (not Cursor-native `.cursor/skills`). */
export const PORTABLE_PEER_TOOLS = ['windsurf', 'gemini', 'codex', 'copilot'];

/**
 * Anti-double skills mirror plan (ADR-008).
 * @param {string[]} tools
 * @returns {{ claude: boolean, agents: boolean, cursorSkills: boolean }}
 */
export function resolveSkillMirrorPlan(tools) {
  const list = Array.isArray(tools) ? tools : [];
  const hasClaude = list.includes('claude-code');
  const hasCursor = list.includes('cursor');
  const hasPortablePeer = list.some((t) => PORTABLE_PEER_TOOLS.includes(t));
  return {
    claude: hasClaude,
    agents: hasPortablePeer,
    cursorSkills: hasCursor && !hasPortablePeer,
  };
}

/**
 * Root Midas-owned discovery paths that should exist only when justified by `tools`.
 * Used by doctor `layout:root-allowlist`.
 * @param {string[]} tools
 * @returns {string[]}
 */
export function expectedRootAllowlist(tools, layout = 'harness') {
  const plan = resolveSkillMirrorPlan(tools);
  const out = ['AGENTS.md', '.mcp.json'];
  if (plan.claude) {
    out.push('.claude/CLAUDE.md', '.claude/skills', '.claude/agents');
  }
  if (plan.agents) out.push('.agents/skills');
  if (plan.cursorSkills) out.push('.cursor/skills');
  if (tools.includes('cursor')) out.push(...adapterPathsForTool('cursor', layout));
  if (tools.includes('windsurf')) out.push(...adapterPathsForTool('windsurf', layout));
  if (tools.includes('gemini')) out.push('GEMINI.md');
  return out;
}

/**
 * Known Midas-generated root paths that are orphans when their tool is not selected.
 * @param {string[]} tools
 * @returns {string[]}
 */
export function orphanRootMidasPaths(tools, layout = 'harness') {
  const plan = resolveSkillMirrorPlan(tools);
  const orphans = [];
  if (!plan.claude) {
    orphans.push('.claude/CLAUDE.md', '.claude/skills', '.claude/agents');
  }
  if (!plan.agents) orphans.push('.agents/skills');
  if (!plan.cursorSkills) orphans.push('.cursor/skills');
  if (!tools.includes('cursor')) orphans.push(...adapterPathsForTool('cursor', layout));
  if (!tools.includes('windsurf')) {
    orphans.push(...adapterPathsForTool('windsurf', layout));
    orphans.push(LEGACY_WINDSURF_ADAPTER_REL, LEGACY_WINDSURF_CHECKS_REL);
  } else {
    orphans.push(LEGACY_WINDSURF_ADAPTER_REL, LEGACY_WINDSURF_CHECKS_REL);
  }
  if (!tools.includes('gemini')) orphans.push('GEMINI.md');
  return orphans;
}
