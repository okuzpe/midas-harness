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

export const MANIFEST_SCHEMA_VERSION = 2;

/** Schema versions this reader accepts; older ones are normalized on read. */
export const MANIFEST_READABLE_SCHEMA_VERSIONS = [1, 2];

/**
 * Trees whose contents are owned by the bundled engine. Uninstall and the per-file manifest cover
 * all three; the published content hash does not — see CHANNEL_TREE_ROOTS.
 */
export const VENDOR_ROOTS = ['.harness/engine', '.harness/scripts', '.harness/autonomy'];

/**
 * Roots that participate in `tree_sha256` (the channel identity) and in reconcile.
 * `.harness/autonomy` is vendor when present, but it is an opt-in copy from `.optional/autonomy`,
 * so folding it into the published hash would make every `--autonomy` install look out of date.
 */
export const CHANNEL_TREE_ROOTS = Object.freeze(['.harness/engine', '.harness/scripts']);

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

/** True when `rel` lives under a vendor root (regardless of the user-owned exceptions inside it). */
export function isUnderVendorRoot(rel) {
  const n = rel.replace(/\\/g, '/');
  return VENDOR_ROOTS.some((root) => n === root || n.startsWith(`${root}/`));
}

/** True when `rel` participates in the published/installed content hash. */
export function isUnderChannelTree(rel) {
  const n = String(rel).replace(/\\/g, '/');
  return CHANNEL_TREE_ROOTS.some((root) => n === root || n.startsWith(`${root}/`));
}

/**
 * Content hash of a vendor file set: sha256 over sorted `path\0sha256` lines.
 * Stable across platforms (`.gitattributes` pins LF) and independent of file order or mtimes.
 * @param {{ path: string, sha256: string|null }[]} files
 */
export function treeSha256(files) {
  const lines = files
    .filter((file) => file.sha256)
    .map((file) => `${file.path.replace(/\\/g, '/')}\0${file.sha256}`)
    .sort();
  return sha256Buffer(lines.join('\n'));
}

/** Vendor-role entries of a manifest, sorted by path. */
export function vendorFilesOf(manifest) {
  if (!manifest?.files) return [];
  return manifest.files
    .filter((file) => file.role === 'vendor')
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
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
  // Re-derived per install from the skills actually present, so its bytes differ from the bundle's
  // by design. Calling it vendor would put a per-install artifact inside the release content hash,
  // and every fresh install would then report itself as out of date.
  if (normalized === '.harness/engine/skill-registry.md') return 'generated';
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
 *
 * @param {string} root
 * @param {string} version
 * @param {{
 *   channel?: string|null,
 *   commit?: string|null,
 *   ref?: string|null,
 *   vendorAllowlist?: Iterable<string>|null,
 * }} [meta]
 *   Release provenance recorded at install time so `doctor` can compare the installed tree against
 *   a published channel manifest without downloading the bundle.
 *   `vendorAllowlist` is the bundle's vendor paths. Dest-only leftovers (untracked files inside a
 *   vendor root) must not enter the ledger: the next update would treat them as dropped and delete
 *   them. Omit it only for tests that want a raw dest scan.
 */
export function computeOwnershipManifest(root, version, meta = {}) {
  const allow = meta.vendorAllowlist
    ? new Set([...meta.vendorAllowlist].map((p) => String(p).replace(/\\/g, '/')))
    : null;
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
    if (role === 'vendor' && allow && !allow.has(path.replace(/\\/g, '/'))) continue;
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
    channel: meta.channel ?? null,
    commit: meta.commit ?? null,
    ref: meta.ref ?? null,
    tree_sha256: treeSha256(
      files.filter((file) => file.role === 'vendor' && isUnderChannelTree(file.path)),
    ),
    files,
    user_paths: [...USER_PATHS],
  };
}

/**
 * Vendor paths the bundled engine actually ships. Autonomy is included only when the dest
 * already has `.harness/autonomy` (opt-in copy from `.optional/autonomy`).
 *
 * @param {string} templateRoot
 * @param {string} destRoot
 * @returns {string[]}
 */
export function bundledVendorPaths(templateRoot, destRoot) {
  const out = [];
  for (const rootRel of CHANNEL_TREE_ROOTS) {
    for (const rel of walkFilesRel(join(templateRoot, rootRel), { relativeTo: templateRoot, exclude: [] })) {
      const path = rel.replace(/\\/g, '/');
      if (roleForPath(path) === 'vendor') out.push(path);
    }
  }
  const autoSrc = join(templateRoot, '.optional', 'autonomy');
  const autoDst = join(destRoot, '.harness', 'autonomy');
  if (existsSync(autoDst) && existsSync(autoSrc)) {
    for (const rel of walkFilesRel(autoSrc, { relativeTo: autoSrc, exclude: [] })) {
      const path = `.harness/autonomy/${rel.replace(/\\/g, '/')}`;
      if (roleForPath(path) === 'vendor' && existsSync(join(destRoot, path))) out.push(path);
    }
  }
  return out;
}

/**
 * @param {string} root
 * @param {string} version
 * @param {{
 *   channel?: string|null,
 *   commit?: string|null,
 *   ref?: string|null,
 *   vendorAllowlist?: Iterable<string>|null,
 * }} [meta]
 *   Omitted fields inherit the previous manifest, so a plain re-render never drops provenance.
 *   `vendorAllowlist` is not inherited: each write must name the bundle that is being recorded.
 */
export function writeOwnershipManifest(root, version, meta = {}) {
  const path = join(root, '.harness', 'manifest.json');
  const prior = readOwnershipManifest(root);
  const manifest = computeOwnershipManifest(root, version, {
    channel: meta.channel ?? prior?.channel ?? null,
    commit: meta.commit ?? prior?.commit ?? null,
    ref: meta.ref ?? prior?.ref ?? null,
    vendorAllowlist: meta.vendorAllowlist ?? null,
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

/**
 * Read the installed manifest, normalizing older schema versions instead of rejecting them —
 * a v1 manifest predates release provenance but its file hashes are still authoritative.
 */
export function readOwnershipManifest(root) {
  const path = join(root, '.harness', 'manifest.json');
  if (!existsSync(path)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
  if (!MANIFEST_READABLE_SCHEMA_VERSIONS.includes(parsed?.schema_version)) return null;
  if (!Array.isArray(parsed.files)) return null;
  return {
    ...parsed,
    channel: parsed.channel ?? null,
    commit: parsed.commit ?? null,
    ref: parsed.ref ?? null,
    tree_sha256: parsed.tree_sha256 ?? null,
  };
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
