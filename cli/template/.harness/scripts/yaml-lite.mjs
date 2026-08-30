#!/usr/bin/env node
// yaml-lite.mjs — minimal YAML helpers for Midas scripts (no npm dependency).
// Handles the subset of YAML used in harness/state.yaml: scalars, inline lists, inline maps.

import { maybeHelp } from './lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

/** Strip surrounding quotes from a YAML scalar. */
export function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Parse `key: [a, b, "c"]` style inline list from a line or capture group. */
export function parseInlineList(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => stripQuotes(s.trim()))
    .filter(Boolean);
}

/** Parse the `paths:` block from state.yaml → flat map of path keys. */
export function parsePathsBlock(yaml) {
  const out = {};
  const lines = yaml.split(/\r?\n/);
  let inPaths = false;
  for (const line of lines) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      inPaths = /^paths:/.test(line);
      continue;
    }
    if (!inPaths) continue;
    if (/^\S/.test(line)) break;
    if (!/^\s{2,}\S/.test(line)) continue;
    const m = line.match(/^\s{2,}([\w-]+):\s*(.+)$/);
    if (!m) continue;
    out[m[1]] = stripQuotes(m[2].replace(/#.*$/, '').trim());
  }
  return out;
}

/** Parse `tools: [a, b]` from state.yaml text. */
export function parseToolsFromStateYaml(yaml) {
  const m = yaml.match(/^tools:\s*\[([^\]]*)\]/m);
  if (!m) return null;
  const tools = parseInlineList(m[1]);
  return tools.length ? tools : null;
}

/** Parse `mcp: [a, b]` from state.yaml text. */
export function parseMcpList(yaml) {
  const m = yaml.match(/^mcp:\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return parseInlineList(m[1]);
}

/** Parse the sprints block → Map(id → status). */
export function parseSprints(yaml) {
  const out = new Map();
  let inSprints = false;
  let id = null;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      inSprints = /^sprints:/.test(line);
      id = null;
      continue;
    }
    if (!inSprints) continue;
    const idM = line.match(/^\s*-\s*id:\s*"?([\w.-]+)"?/);
    if (idM) {
      id = idM[1];
      out.set(id, '');
      continue;
    }
    const stM = line.match(/^\s*status:\s*"?(\w+)"?/);
    if (stM && id !== null) out.set(id, stM[1]);
  }
  return out;
}

/**
 * Parse sprints[].last_touched → Map(id → ISO date string | null).
 * Missing last_touched yields null for that id (still present in the map once id is seen).
 */
export function parseSprintLastTouched(yaml) {
  const out = new Map();
  let inSprints = false;
  let id = null;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      inSprints = /^sprints:/.test(line);
      id = null;
      continue;
    }
    if (!inSprints) continue;
    const idM = line.match(/^\s*-\s*id:\s*"?([\w.-]+)"?/);
    if (idM) {
      id = idM[1];
      out.set(id, null);
      continue;
    }
    const ltM = line.match(/^\s*last_touched:\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})"?/);
    if (ltM && id !== null) out.set(id, ltM[1]);
  }
  return out;
}

/**
 * Parse the phases block → Map(phaseName → { gate, artifacts, assumption }).
 * Supports inline flow-maps (`phase: { gate: passed, assumption: "…" }`) and
 * multi-line blocks with `artifacts:` as an inline list or dashed list.
 */
export function parsePhases(yaml) {
  const out = new Map();
  const lines = yaml.split(/\r?\n/);
  let inPhases = false;
  let phase = null;
  let inArtifacts = false;

  const ensure = (name) => {
    if (!out.has(name)) out.set(name, { gate: null, artifacts: [], assumption: null });
    return out.get(name);
  };

  for (const line of lines) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      inPhases = /^phases:/.test(line);
      phase = null;
      inArtifacts = false;
      continue;
    }
    if (!inPhases) continue;

    // New phase key at one indent (2 spaces typical): "  idea_intake:" or inline map
    const phaseHead = line.match(/^\s{1,2}([A-Za-z_][\w-]*):\s*(.*)$/);
    if (phaseHead && !/^\s{3,}/.test(line)) {
      phase = phaseHead[1];
      inArtifacts = false;
      const entry = ensure(phase);
      const rest = phaseHead[2].trim();
      if (rest.startsWith('{') && rest.endsWith('}')) {
        const body = rest.slice(1, -1);
        const gateM = body.match(/gate:\s*([^,}]+)/);
        if (gateM) entry.gate = stripQuotes(gateM[1].trim());
        const assM = body.match(/assumption:\s*"([^"]*)"|assumption:\s*'([^']*)'|assumption:\s*([^,}]+)/);
        if (assM) entry.assumption = stripQuotes((assM[1] ?? assM[2] ?? assM[3] ?? '').trim());
        const artM = body.match(/artifacts:\s*\[([^\]]*)\]/);
        if (artM) {
          entry.artifacts = parseInlineList(artM[1]);
        }
      }
      continue;
    }

    if (!phase) continue;
    const entry = ensure(phase);

    if (/^\s+gate:\s*/.test(line)) {
      entry.gate = stripQuotes(line.replace(/^\s+gate:\s*/, '').replace(/#.*$/, '').trim());
      inArtifacts = false;
      continue;
    }
    if (/^\s+assumption:\s*/.test(line)) {
      entry.assumption = stripQuotes(line.replace(/^\s+assumption:\s*/, '').replace(/#.*$/, '').trim());
      inArtifacts = false;
      continue;
    }
    if (/^\s+artifacts:/.test(line)) {
      inArtifacts = true;
      const inline = line.match(/artifacts:\s*\[([^\]]*)\]/);
      if (inline) {
        entry.artifacts.push(...parseInlineList(inline[1]));
        inArtifacts = false;
      }
      continue;
    }
    if (inArtifacts) {
      if (!/^\s+-\s+/.test(line)) {
        inArtifacts = false;
        continue;
      }
      entry.artifacts.push(stripQuotes(line.replace(/^\s+-\s+/, '').trim()));
    }
  }
  return out;
}

/** Parse inline `enforcement:` maps from state.yaml. */
export function parseEnforcement(yaml) {
  const out = [];
  const lines = yaml.split(/\r?\n/);
  const i = lines.findIndex((l) => /^enforcement:/.test(l));
  if (i === -1) return out;
  for (let j = i + 1; j < lines.length; j++) {
    if (!/^\s+\S/.test(lines[j])) break;
    const m = lines[j].match(/^\s+([\w-]+):\s*\{([^}]*)\}/);
    if (!m) continue;
    const cfg = (m[2].match(/config:\s*([^,}]+)/) || [])[1];
    out.push({
      tool: m[1],
      config: cfg ? stripQuotes(cfg.trim()) : null,
      installed: /installed:\s*true/.test(m[2]),
    });
  }
  return out;
}

/** Parse routing-related fields from state.yaml. */
export function parseRouting(yaml) {
  const costProfile = (yaml.match(/^cost_profile:\s*([^\s#]+)/m) || [])[1] || null;
  const routingProfile = (yaml.match(/^routing_profile:\s*([^\s#]+)/m) || [])[1] || null;
  const routing = {};
  const lines = yaml.split(/\r?\n/);
  const i = lines.findIndex((l) => /^routing:/.test(l));
  if (i !== -1) {
    for (let j = i + 1; j < lines.length; j++) {
      if (!/^\s+\S/.test(lines[j])) break;
      const m = lines[j].match(/^\s+(orchestrate|build|scout):\s*([^\s#]+)/);
      if (m) routing[m[1]] = m[2];
    }
  }
  return { costProfile, routingProfile, profile: routingProfile || costProfile, routing };
}

/** Replace the `routing:` map body in state.yaml with expected tier ids. Returns next yaml or null. */
export function rewriteRoutingMap(yaml, expected) {
  if (!yaml || !expected) return null;
  const lines = yaml.split(/\r?\n/);
  const i = lines.findIndex((l) => /^routing:/.test(l));
  if (i === -1) return null;
  let end = i + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1;
  const block = [
    'routing:',
    `  orchestrate: ${expected.orchestrate}`,
    `  build:       ${expected.build}`,
    `  scout:       ${expected.scout}`,
  ];
  const next = [...lines.slice(0, i), ...block, ...lines.slice(end)].join('\n');
  return next === yaml ? null : next;
}

/** Read `midas_version` scalar from state.yaml. */
export function parseMidasVersion(yaml) {
  const m = yaml.match(/^midas_version:\s*([0-9][^\s#]*)/m);
  return m ? m[1] : null;
}

/** Parse a top-level scalar (`key: value`) from state.yaml. */
export function parseStateScalar(yaml, key) {
  const m = yaml.match(new RegExp(`^${key}:\\s*([^#\\n]+)`, 'm'));
  return m ? stripQuotes(m[1].trim()) : null;
}

/** Artifact paths listed under a phase in state.yaml. */
export function parsePhaseArtifacts(yaml, phase) {
  const lines = yaml.split(/\r?\n/);
  let inPhase = false;
  let inArtifacts = false;
  const out = [];
  for (const line of lines) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      inPhase = new RegExp(`^${phase}:`).test(line);
      inArtifacts = false;
      continue;
    }
    if (!inPhase) continue;
    if (/^\s+artifacts:/.test(line)) {
      inArtifacts = true;
      const inline = line.match(/artifacts:\s*\[([^\]]*)\]/);
      if (inline) {
        for (const part of inline[1].split(',')) {
          const s = stripQuotes(part.trim());
          if (s) out.push(s);
        }
        inArtifacts = false;
      }
      continue;
    }
    if (!inArtifacts) continue;
    if (!/^\s+-\s+/.test(line)) {
      inArtifacts = false;
      continue;
    }
    const item = line.replace(/^\s+-\s+/, '').trim();
    out.push(stripQuotes(item));
  }
  return out;
}

/** First sprint id whose status is `active`. */
export function findActiveSprintId(yaml) {
  const sprints = parseSprints(yaml);
  for (const [id, status] of sprints) {
    if (status === 'active') return id;
  }
  return null;
}

/**
 * Minimal YAML parser for the flat stage-command-table shape.
 * @param {string} text
 * @returns {{ stages: Record<string, {
 *   command: string | null,
 *   recall: string[],
 *   commandWhenDone?: string | null,
 *   verifyUi?: string,
 *   redesignUi?: string,
 *   qaInternal?: string,
 *   note?: string,
 * }> }}
 */
export function parseStageCommandTableYaml(text) {
  /** @type {Record<string, { command: string | null, recall: string[] } & Record<string, unknown>>} */
  const stages = {};
  let current = null;
  let inRecall = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const stageMatch = line.match(/^  (\w+):$/);
    if (stageMatch) {
      current = stageMatch[1];
      stages[current] = { command: null, recall: [] };
      inRecall = false;
      continue;
    }
    if (!current) continue;
    const cmd = line.match(/^    command(_when_done)?: (.+)$/);
    if (cmd) {
      const val = stripQuotes(cmd[2]);
      const parsed = val === 'null' ? null : val;
      if (cmd[1] === '_when_done') stages[current].commandWhenDone = parsed;
      else stages[current].command = parsed;
      inRecall = false;
      continue;
    }
    const verify = line.match(/^    verify_ui: (.+)$/);
    if (verify) {
      stages[current].verifyUi = stripQuotes(verify[1]);
      inRecall = false;
      continue;
    }
    const redesign = line.match(/^    redesign_ui: (.+)$/);
    if (redesign) {
      stages[current].redesignUi = stripQuotes(redesign[1]);
      inRecall = false;
      continue;
    }
    const qa = line.match(/^    qa_internal: (.+)$/);
    if (qa) {
      stages[current].qaInternal = stripQuotes(qa[1]);
      inRecall = false;
      continue;
    }
    const qaLegacy = line.match(/^    qa_adhoc: (.+)$/);
    if (qaLegacy) {
      stages[current].qaInternal = stripQuotes(qaLegacy[1]);
      inRecall = false;
      continue;
    }
    const note = line.match(/^    note: (.+)$/);
    if (note) {
      stages[current].note = stripQuotes(note[1]);
      inRecall = false;
      continue;
    }
    if (line.match(/^    recall:$/)) {
      inRecall = true;
      continue;
    }
    const recallItem = line.match(/^      - (.+)$/);
    if (inRecall && recallItem) {
      stages[current].recall.push(stripQuotes(recallItem[1]));
    }
  }
  return { stages };
}
