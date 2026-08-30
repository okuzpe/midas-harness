// state-write.mjs — AGENTS fill, state.yaml create/patch, version stamp.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DEFAULT_ROUTING_PROFILE,
  normalizeRoutingProfile,
  resolveRoutingModels,
} from '../shared/model-profiles.mjs';
import { evaluateMcpGovernance } from '../shared/mcp-drift.mjs';
import { DEFAULT_TOOLS } from '../cli/args.mjs';

/**
 * @typedef {{
 *   target: string,
 *   template: string,
 *   name: string,
 *   installAutonomy: boolean,
 *   readMaybe: (p: string) => string | null,
 * }} StateWriteCtx
 */

/** Read `tools:` from existing state.yaml, or null. */
export function readToolsFromState(ctx, paths) {
  const stateFile = join(ctx.target, paths.state);
  const raw = ctx.readMaybe(stateFile);
  if (!raw) return null;
  const m = raw.match(/^tools:\s*\[([^\]]*)\]/m);
  if (!m) return null;
  const tools = m[1].split(',').map((t) => t.trim()).filter(Boolean);
  return tools.length ? tools : null;
}

/** Fill AGENTS.md placeholders / managed block for this project. */
export function fillAgents(ctx, tools, paths) {
  const f = join(ctx.target, 'AGENTS.md');
  const list = (tools || readToolsFromState(ctx, paths) || DEFAULT_TOOLS).join(', ');
  const source = ctx.readMaybe(join(ctx.template, 'AGENTS.md'));
  if (source == null) return;
  const filled = source
    .replace(/\{\{PROJECT_NAME\}\}/g, ctx.name)
    .replace(/\{\{STACK\}\}/g, 'undecided — set in Phase 4 (`/choose-architecture`)')
    .replace(/\{\{TOOLS\}\}/g, list);
  const existing = ctx.readMaybe(f);
  if (existing == null || existing.includes('{{')) {
    writeFileSync(f, filled, 'utf8');
    return;
  }
  const begin = '<!-- midas:begin AGENTS -->';
  const end = '<!-- midas:end AGENTS -->';
  const bi = existing.indexOf(begin);
  const ei = existing.indexOf(end);
  const fbi = filled.indexOf(begin);
  const fei = filled.indexOf(end);
  if (fbi === -1 || fei === -1) return;
  const managed = filled.slice(fbi, fei + end.length);
  if (bi !== -1 && ei > bi) {
    writeFileSync(f, existing.slice(0, bi) + managed + existing.slice(ei + end.length), 'utf8');
  } else {
    writeFileSync(f, `${existing.replace(/\s*$/, '')}\n\n${managed}\n`, 'utf8');
  }
}

export function rewriteStateTools(ctx, paths, tools) {
  const f = join(ctx.target, paths.state);
  const cur = ctx.readMaybe(f);
  if (cur == null) return;
  const toolList = tools.join(', ');
  let next = cur;
  if (/^tools:\s*\[/m.test(next)) {
    next = next.replace(/^tools:\s*\[[^\]]*\]/m, `tools: [${toolList}]`);
  } else {
    next = `${next.replace(/\s*$/, '')}\n\ntools: [${toolList}]\n`;
  }
  if (next !== cur) writeFileSync(f, next, 'utf8');
}

/** After v1→v2 migrate, fill doctor-required keys that classic state may omit. */
export function ensureMigratedStateShape(ctx, paths, routingProfile) {
  const f = join(ctx.target, paths.state);
  const cur = ctx.readMaybe(f);
  if (cur == null) return;
  const routing = resolveRoutingModels(routingProfile);
  const patches = [];
  if (!/^stage:\s*\S+/m.test(cur)) patches.push('stage: idea_intake');
  if (!/^stage_status:\s*\S+/m.test(cur)) patches.push('stage_status: not_started');
  if (!/^cost_profile:\s*\S+/m.test(cur)) patches.push('cost_profile: balanced');
  if (!/^routing_profile:\s*\S+/m.test(cur)) patches.push(`routing_profile: ${routingProfile}`);
  if (!/^routing:/m.test(cur)) {
    patches.push(
      'routing:',
      `  orchestrate: ${routing.orchestrate}`,
      `  build:       ${routing.build}`,
      `  scout:       ${routing.scout}`,
    );
  }
  // v1 installs often declare mcp: servers without Runlayer; default governance is runlayer and
  // doctor --strict then fails migrate/update. Preserve declared / shadow servers as self_managed.
  if (!/^mcp_governance:\s*\S+/m.test(cur)) {
    let needSelfManaged = /^mcp:\s*\[[^\]]*\]/m.test(cur) && !/^mcp:\s*\[\s*\]/m.test(cur);
    if (!needSelfManaged) {
      const mcpPath = join(ctx.target, '.mcp.json');
      if (existsSync(mcpPath)) {
        try {
          const gov = evaluateMcpGovernance(readFileSync(mcpPath, 'utf8'));
          needSelfManaged = (gov.shadowServers || []).length > 0;
        } catch {
          // ignore invalid mcp.json here — doctor surfaces it later
        }
      }
    }
    if (needSelfManaged) {
      patches.push(
        '# Brownfield shadow MCPs — set mcp_governance: runlayer after migrating servers to Runlayer',
        'mcp_governance: self_managed',
      );
    }
  }
  if (!patches.length) return;
  const next = `${cur.replace(/\s*$/, '')}\n\n${patches.join('\n')}\n`;
  writeFileSync(f, next, 'utf8');
}

/**
 * Coarse greenfield/brownfield guess for default state.yaml.
 * @param {{ target: string, skipped: string[] }} ctx
 */
export function detectMode(ctx) {
  const manifests = ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'composer.json', 'Gemfile', 'requirements.txt'];
  const hasManifest = manifests.some((m) => existsSync(join(ctx.target, m)));
  const hasSrc = ['src', 'lib', 'app'].some((d) => existsSync(join(ctx.target, d)));
  const keptAgentFiles = ctx.skipped.some((f) => /^(AGENTS\.md|CLAUDE\.md)$/.test(f));
  return hasManifest || hasSrc || keptAgentFiles ? 'brownfield' : 'greenfield';
}

/** Write a default .harness/state.yaml (never clobber an existing one). Returns the mode, or null. */
export function writeState(ctx, tools, paths, routingProfile) {
  const stateFile = join(ctx.target, paths.state);
  if (existsSync(stateFile)) return null;
  const version = (ctx.readMaybe(join(ctx.target, paths.version)) || '0.0.0').trim();
  const mode = detectMode(ctx);
  const today = new Date().toISOString().slice(0, 10);
  const stage = mode === 'brownfield' ? 'tech_architecture' : 'idea_intake';
  const toolList = (tools || DEFAULT_TOOLS).join(', ');
  const routingProfileName = normalizeRoutingProfile(routingProfile) || DEFAULT_ROUTING_PROFILE;
  const routing = resolveRoutingModels(routingProfileName);
  const executionMode = routingProfileName === 'local-hybrid' ? 'hybrid' : 'cloud';
  const layoutLines = [
    'role: product',
    'layout: harness',
    'paths:',
    '  root: .harness',
    '  engine: .harness/engine',
    '  scripts: .harness/scripts',
    '  state: .harness/state.yaml',
    '  product: .harness/product',
    '  rules: .harness/rules',
    '  runs: .harness/runs',
    '  cache: .harness/cache',
    '',
  ];
  const yaml = [
    `midas_version: ${version}`,
    ...layoutLines,
    `name: ${ctx.name}`,
    `mode: ${mode}`,
    'language: en',
    `created: ${today}`,
    `updated: ${today}`,
    'setup_complete: false        # /midas-init sets this true; until then it is the next step',
    `channel: ${ctx.channel || 'stable'}        # release channel \`update\` follows (stable | edge)`,
    '',
    `stage: ${stage}`,
    'stage_status: not_started',
    `entry_stage: ${stage}`,
    '',
    'cost_profile: balanced',
    `routing_profile: ${routingProfileName}`,
    'routing:',
    `  orchestrate: ${routing.orchestrate}`,
    `  build:       ${routing.build}`,
    `  scout:       ${routing.scout}`,
    '',
    `execution_mode: ${executionMode}`,
    ...(routingProfileName === 'local-hybrid'
      ? [
          '',
          'local_model:',
          '  id: local_model.id',
          '  runtime: ollama',
          '  vram_gb: 24',
        ]
      : []),
    '',
    `tools: [${toolList}]`,
    'mcp:   []',
    '',
    'phases: {}',
    'sprints: []',
    '',
    ...(ctx.installAutonomy
      ? [
          '# Optional autonomy pointers (ADR-009) — disabled until policy enabled',
          'autonomy:',
          '  enabled: false',
          '  mode: disabled',
          '  status: idle',
          '  policy_digest: ""',
          '  active_agent_id: null',
          '  active_run_id: null',
          '  active_sha: null',
          '  journal_path: .harness/runs/autonomy/journal.jsonl',
          '  next_attempt_at: null',
          '',
        ]
      : []),
  ].join('\n');
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, yaml, 'utf8');
  return mode;
}

/** On --update/--migrate, bump midas_version in preserved state.yaml. */
export function bumpVersionStamp(ctx, paths) {
  const f = join(ctx.target, paths.state);
  const cur = ctx.readMaybe(f);
  if (cur == null) return null;
  const version = (ctx.readMaybe(join(ctx.target, paths.version)) || '').trim();
  if (!version) return null;
  const today = new Date().toISOString().slice(0, 10);
  let next = cur.replace(/^midas_version:\s*[^\s#]+/m, `midas_version: ${version}`);
  if (/^updated:/m.test(next)) {
    next = next.replace(/^updated:\s*[^\s#]+/m, `updated: ${today}`);
  }
  // An explicit `--channel` on this run becomes the channel the project tracks from now on;
  // without it, whatever the state already records stands.
  if (ctx.channel && /^channel:\s*[^\s#]+/m.test(next)) {
    next = next.replace(/^channel:\s*[^\s#]+/m, `channel: ${ctx.channel}`);
  }
  if (next !== cur) writeFileSync(f, next, 'utf8');
  return version;
}
