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

/** Parse `cost_profile` + `routing:` tier map from state.yaml. */
export function parseRouting(yaml) {
  const profile = (yaml.match(/^cost_profile:\s*([^\s#]+)/m) || [])[1] || null;
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
  return { profile, routing };
}

/** Read `midas_version` scalar from state.yaml. */
export function parseMidasVersion(yaml) {
  const m = yaml.match(/^midas_version:\s*([0-9][^\s#]*)/m);
  return m ? m[1] : null;
}
