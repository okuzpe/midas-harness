// portable-skills.mjs — generate portable Agent Skills mirrors from `harness/skills`.
//
// `harness/skills` is the authored source. `.claude/skills`, `.agents/skills`, and `.cursor/skills`
// are generated host discovery trees and may contain only Midas-owned files (ADR-008).

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolvePaths } from './paths.mjs';

const ALLOWED_FRONTMATTER_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const MIDAS_META_PREFIX = 'midas-';

/** Split a skill file into frontmatter + body. */
function splitSkillDocument(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Skill file is missing YAML frontmatter');
  }
  return { frontmatter: match[1], body: match[2] };
}

/** Parse the flat frontmatter used by current skills. */
function parseFrontmatter(text) {
  const out = {};
  const lines = text.split(/\r?\n/);
  let currentMetadata = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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

function stripQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function quoteYaml(value) {
  const text = String(value ?? '');
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function formatYamlScalar(value) {
  if (value === '' || /[:#\n\r\t]/.test(value) || /^\s|\s$/.test(value) || /[{}\[\],&*?!|>'"%@`]/.test(value)) {
    return quoteYaml(value);
  }
  return String(value);
}

function normalizeMetadataValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value == null) return '';
  return String(value);
}

function collectPortableMetadata(source) {
  const metadata = {};
  for (const [key, value] of Object.entries(source)) {
    if (ALLOWED_FRONTMATTER_KEYS.has(key)) continue;
    metadata[`${MIDAS_META_PREFIX}${key}`] = normalizeMetadataValue(value);
  }
  return metadata;
}

function renderPortableFrontmatter(sourcePath, sourceFrontmatter) {
  const metadata = collectPortableMetadata(sourceFrontmatter);
  const lines = [
    '---',
    `name: ${formatYamlScalar(sourceFrontmatter.name)}`,
    `description: ${formatYamlScalar(sourceFrontmatter.description)}`,
  ];

  if (sourceFrontmatter.license) {
    lines.push(`license: ${formatYamlScalar(sourceFrontmatter.license)}`);
  }
  if (sourceFrontmatter.compatibility) {
    lines.push(`compatibility: ${formatYamlScalar(sourceFrontmatter.compatibility)}`);
  }
  if (sourceFrontmatter['allowed-tools']) {
    lines.push(`allowed-tools: ${formatYamlScalar(sourceFrontmatter['allowed-tools'])}`);
  }
  if (Object.keys(metadata).length) {
    lines.push('metadata:');
    for (const [key, value] of Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`  ${key}: ${formatYamlScalar(value)}`);
    }
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

export function renderPortableSkillText(text, sourcePath = 'SKILL.md') {
  const { frontmatter, body } = splitSkillDocument(text);
  const parsed = parseFrontmatter(frontmatter);
  if (!parsed.name || !parsed.description) {
    throw new Error(`Portable skill frontmatter missing name/description: ${sourcePath}`);
  }
  const portable = renderPortableFrontmatter(sourcePath, parsed) + body.replace(/^\r?\n/, '');
  return portable.endsWith('\n') ? portable : `${portable}\n`;
}

function renderPortableSkillFile(sourceFile, targetFile, sourceRoot) {
  const text = readFileSync(sourceFile, 'utf8');
  const rel = sourceFile.slice(sourceRoot.length + 1).replace(/\\/g, '/');
  mkdirSync(dirname(targetFile), { recursive: true });
  writeFileSync(targetFile, renderPortableSkillText(text, rel), 'utf8');
}

function copyRecursive(sourceDir, targetDir, sourceRoot) {
  if (!existsSync(sourceDir)) return [];
  const written = [];
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const src = join(sourceDir, entry.name);
    const dst = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(dst, { recursive: true });
      written.push(...copyRecursive(src, dst, sourceRoot));
      continue;
    }
    if (entry.name === 'SKILL.md') {
      renderPortableSkillFile(src, dst, sourceRoot);
    } else {
      cpSync(src, dst);
    }
    written.push(dst);
  }
  return written;
}

/**
 * Render a portable skills tree (`.agents/skills` or `.cursor/skills`) from the canonical source.
 * Returns a list of written file paths relative to `root`.
 */
export function renderPortableSkillsTree(root, { sourceDir = null, targetDir = '.agents/skills', merge = false } = {}) {
  sourceDir ||= join(resolvePaths(root).engine, 'skills');
  const sourceRoot = join(root, sourceDir);
  const targetRoot = join(root, targetDir);
  if (!existsSync(sourceRoot)) return { wrote: false, files: [] };
  if (existsSync(targetRoot) && !merge) rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });
  const absFiles = copyRecursive(sourceRoot, targetRoot, sourceRoot);
  writeFileSync(
    join(targetRoot, 'README.md'),
    [
      '# Generated skill mirror',
      '',
      '> **GENERATED — do not hand-edit.** Source: `harness/skills/` (or `<paths.engine>/skills/`).',
      '> Rebuild with `npm run build` (engine) or the installer sync path (product).',
      '',
    ].join('\n'),
    'utf8',
  );
  return {
    wrote: true,
    files: absFiles.map((abs) => abs.slice(root.length + 1).replace(/\\/g, '/')).sort(),
  };
}

/**
 * Drop Midas skill dirs removed from the engine but still present in a host mirror.
 * User-owned neighbours (not in `bundledMirrorRoot`) are preserved.
 */
export function pruneObsoleteMidasSkillMirrors(
  root,
  { sourceDir, targetDir, bundledMirrorRoot },
) {
  const sourceRoot = join(root, sourceDir);
  const targetRoot = join(root, targetDir);
  const bundledRoot = join(bundledMirrorRoot, targetDir);
  if (!existsSync(targetRoot) || !existsSync(sourceRoot) || !existsSync(bundledRoot)) {
    return [];
  }
  const engineNames = new Set(
    readdirSync(sourceRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  );
  const bundledNames = new Set(
    readdirSync(bundledRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  );
  const removed = [];
  for (const entry of readdirSync(targetRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (engineNames.has(entry.name)) continue;
    if (!bundledNames.has(entry.name)) continue;
    const abs = join(targetRoot, entry.name);
    rmSync(abs, { recursive: true, force: true });
    removed.push(join(targetDir, entry.name).replace(/\\/g, '/'));
  }
  return removed;
}

export { splitSkillDocument, parseFrontmatter, renderPortableFrontmatter };
