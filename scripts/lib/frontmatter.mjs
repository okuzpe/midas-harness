// frontmatter.mjs — single YAML-frontmatter parser for skills (portable mirrors + registry).
// Supports nested `metadata:` maps and quoted scalars. Not a full YAML parser.

/**
 * Split a skill file into frontmatter YAML + body.
 * @param {string} text
 * @returns {{ frontmatter: string, body: string } | null}
 */
export function splitSkillDocument(text) {
  const match = String(text ?? '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

/**
 * Strip surrounding YAML quotes from a scalar.
 * @param {string} value
 * @returns {string}
 */
export function stripQuotes(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/**
 * Parse a YAML frontmatter block (no `---` fences). Nested `metadata:` is a nested object.
 * @param {string} yaml
 * @returns {Record<string, unknown>}
 */
export function parseFrontmatterBlock(yaml) {
  const out = {};
  let currentMetadata = null;

  for (const line of String(yaml ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^metadata:\s*$/.test(line)) {
      currentMetadata = {};
      out.metadata = currentMetadata;
      continue;
    }
    const metadataLine = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (currentMetadata && metadataLine) {
      currentMetadata[metadataLine[1]] = stripQuotes(metadataLine[2]);
      continue;
    }
    currentMetadata = null;
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!top) continue;
    out[top[1]] = stripQuotes(top[2]);
  }
  return out;
}

/**
 * Parse YAML frontmatter from a full file (`---` … `---`) or a bare YAML block.
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
export function parseFrontmatter(text) {
  if (text == null || text === '') return null;
  const raw = String(text);
  if (raw.startsWith('---')) {
    const parts = splitSkillDocument(raw);
    if (parts) return parseFrontmatterBlock(parts.frontmatter);
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    return parseFrontmatterBlock(m[1]);
  }
  return parseFrontmatterBlock(raw);
}
