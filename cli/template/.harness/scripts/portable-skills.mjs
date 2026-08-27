// portable-skills.mjs — generate portable Agent Skills mirrors from `harness/skills`.
//
// `harness/skills` is the authored source. `.claude/skills`, `.agents/skills`, and `.cursor/skills`
// are generated host discovery trees and may contain only Midas-owned files (ADR-008).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolvePaths } from './paths.mjs';
import { isHostMirrorExcluded } from './skill-registry.mjs';
import { parseFrontmatter, splitSkillDocument } from './lib/frontmatter.mjs';

const ALLOWED_FRONTMATTER_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const MIDAS_META_PREFIX = 'midas-';

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
  const parts = splitSkillDocument(text);
  if (!parts) {
    throw new Error('Skill file is missing YAML frontmatter');
  }
  const { frontmatter, body } = parts;
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
      // Top-level skill dirs: skip internal/deprecated from host pickers (ADR-013).
      if (sourceDir === sourceRoot && isHostMirrorExcluded(entry.name)) continue;
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
      '> Omits `user-surface: internal|deprecated` skills (ADR-013) — those stay under `<paths.engine>/skills/` for path-pass.',
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
 * Drop obsolete or host-picker-excluded Midas skill dirs from a host mirror.
 * User-owned neighbours (not in the bundled template) are preserved.
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
    const name = entry.name;
    const wasMidasBundled = bundledNames.has(name);
    const surfaceExcluded = isHostMirrorExcluded(name);
    const removedFromEngine = !engineNames.has(name);
    // Keep user-owned dirs that were never in the Midas bundled mirror.
    if (!wasMidasBundled && !surfaceExcluded) continue;
    // Prune: obsolete Midas skill, or internal/deprecated that should not live in host pickers.
    if (!(surfaceExcluded || (wasMidasBundled && removedFromEngine))) continue;
    const abs = join(targetRoot, name);
    rmSync(abs, { recursive: true, force: true });
    removed.push(join(targetDir, name).replace(/\\/g, '/'));
  }
  return removed;
}
