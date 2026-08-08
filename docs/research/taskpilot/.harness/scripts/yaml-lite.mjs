#!/usr/bin/env node
// yaml-lite.mjs — minimal YAML helpers for Midas scripts (no npm dependency).
// Handles the subset of YAML used in harness/state.yaml: scalars, inline lists, inline maps.

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
