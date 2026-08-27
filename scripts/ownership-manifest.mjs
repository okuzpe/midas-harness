// ownership-manifest.mjs — classify installed files so update/uninstall never guess ownership.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { walkFiles as walkFilesRel } from './lib/walk.mjs';

export const MANIFEST_SCHEMA_VERSION = 1;

export const USER_PATHS = [
  '.harness/state.yaml',
  '.harness/product',
  '.harness/rules',
  '.harness/runs',
  '.harness/migrations/receipts',
  '.harness/migrations/backups',
  '.harness/autonomy/policy.yaml',
  '.harness/autonomy/authz',
  '.harness/autonomy/control.json',
  '.harness/autonomy/budget-ledger.json',
  '.harness/autonomy/journal-anchor.json',
  '.mcp.json',
  '.gitignore',
];

const GENERATED_PREFIXES = [
  'AGENTS.md',
  'GEMINI.md',
  '.claude/CLAUDE.md',
  '.claude/skills/',
  '.claude/agents/',
  '.agents/skills/',
  '.cursor/skills/',
  '.cursor/rules/00-midas.mdc',
  '.cursor/rules/01-midas-checks.mdc',
  '.cursor/mcp.json',
  '.harness/.windsurf/rules/00-midas.md',
  '.harness/.windsurf/rules/01-midas-checks.md',
  'harness/.windsurf/rules/00-midas.md',
  'harness/.windsurf/rules/01-midas-checks.md',
  '.midas/.windsurf/rules/00-midas.md',
  '.midas/.windsurf/rules/01-midas-checks.md',
  '.windsurf/rules/00-midas.md',
  '.windsurf/rules/01-midas-checks.md',
];

export function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

function walkFiles(root, dir, out = []) {
  out.push(...walkFilesRel(dir, { relativeTo: root, exclude: [] }));
  return out;
}

export function roleForPath(rel) {
  const normalized = rel.replace(/\\/g, '/');
  if (
    normalized === '.harness/autonomy/policy.yaml' ||
    normalized.startsWith('.harness/autonomy/authz/') ||
    normalized === '.harness/autonomy/control.json' ||
    normalized === '.harness/autonomy/budget-ledger.json' ||
    normalized === '.harness/autonomy/journal-anchor.json'
  ) {
    return 'user';
  }
  if (
    normalized.startsWith('.harness/engine/') ||
    normalized.startsWith('.harness/scripts/') ||
    normalized.startsWith('.harness/autonomy/')
  ) {
    return 'vendor';
  }
  if (GENERATED_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? normalized.startsWith(prefix) : normalized === prefix
  )) {
    return 'generated';
  }
  return 'user';
}

/**
 * Compute the installed ownership manifest. User files are represented by path only and never
 * hashed: their contents are outside the update/uninstall authority boundary.
 */
export function computeOwnershipManifest(root, version) {
  const engineSkills = join(root, '.harness', 'engine', 'skills');
  const engineAgents = join(root, '.harness', 'engine', 'agents');
  const candidates = [
    ...walkFiles(root, join(root, '.harness', 'engine')),
    ...walkFiles(root, join(root, '.harness', 'scripts')),
    ...walkFiles(root, join(root, '.harness', 'autonomy')),
    ...GENERATED_PREFIXES.filter((p) => !p.endsWith('/') && existsSync(join(root, p))),
  ];
  for (const rel of walkFiles(engineSkills, engineSkills)) {
    const skillRel = rel.replace(/\\/g, '/');
    for (const prefix of ['.claude/skills', '.agents/skills', '.cursor/skills']) {
      const candidate = `${prefix}/${skillRel}`;
      if (existsSync(join(root, candidate))) candidates.push(candidate);
    }
  }
  for (const rel of walkFiles(engineAgents, engineAgents)) {
    const agentRel = rel.replace(/\\/g, '/');
    const candidate = `.claude/agents/${agentRel}`;
    if (existsSync(join(root, candidate))) candidates.push(candidate);
  }

  const seen = new Set();
  const files = [];
  for (const path of candidates.sort()) {
    if (seen.has(path)) continue;
    seen.add(path);
    const role = roleForPath(path);
    const abs = join(root, path);
    files.push({
      path,
      role,
      sha256: role === 'user' ? null : sha256File(abs),
      size: statSync(abs).size,
    });
  }

  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    midas_version: version,
    layout: 'harness',
    files,
    user_paths: [...USER_PATHS],
  };
}

export function writeOwnershipManifest(root, version) {
  const path = join(root, '.harness', 'manifest.json');
  const manifest = computeOwnershipManifest(root, version);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

export function readOwnershipManifest(root) {
  const path = join(root, '.harness', 'manifest.json');
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed?.schema_version === MANIFEST_SCHEMA_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

/** Return vendor files whose current bytes no longer match the installed manifest. */
export function findVendorConflicts(root, manifest = readOwnershipManifest(root)) {
  if (!manifest) return [];
  return manifest.files
    .filter((file) => file.role === 'vendor')
    .filter((file) => {
      const abs = join(root, file.path);
      return !existsSync(abs) || sha256File(abs) !== file.sha256;
    })
    .map((file) => file.path);
}

/** Generated mirrors are whole-file outputs; modified ones require manual reconciliation. */
export function findGeneratedMirrorConflicts(root, manifest = readOwnershipManifest(root)) {
  if (!manifest) return [];
  return manifest.files
    .filter((file) => file.role === 'generated')
    .filter((file) =>
      file.path.startsWith('.claude/skills/') ||
      file.path.startsWith('.claude/agents/') ||
      file.path.startsWith('.agents/skills/') ||
      file.path === '.cursor/mcp.json'
    )
    .filter((file) => {
      const abs = join(root, file.path);
      return !existsSync(abs) || sha256File(abs) !== file.sha256;
    })
    .map((file) => file.path);
}
