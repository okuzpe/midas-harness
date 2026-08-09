// migrate-v2.mjs — transactional v1 layout -> v2 `.harness/` migration.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const RUN_DIRS = ['audits', 'verifications', 'debates', 'sprints', 'sweeps'];
const PRODUCT_DIRS = ['adr', 'playbooks', 'sprints', 'src'];
const PRODUCT_FILES = new Set([
  'idea.md',
  'open-questions.md',
  'market.md',
  'business-plan.md',
  'architecture.md',
  'roadmap.md',
  'features.json',
  'inventory.md',
  'debt.md',
  'conventions.md',
  'design-system.md',
  'design-direction.md',
]);
const MIDAS_SCRIPT_NAMES = new Set([
  'bundle.mjs',
  'design-system.mjs',
  'doctor.mjs',
  'gitignore-merge.mjs',
  'install-diagnose.mjs',
  'mcp-cursor-sync.mjs',
  'mcp-drift.mjs',
  'migrate-layout.mjs',
  'model-profiles.mjs',
  'ownership-manifest.mjs',
  'paths.mjs',
  'portable-skills.mjs',
  'render-adapters.mjs',
  'stage-command-table.mjs',
  'status-page.mjs',
  'tool-profiles.mjs',
  'yaml-lite.mjs',
]);
const MIDAS_SCRIPT_SIGNATURES = new Map([
  ['mcp-cursor-sync.mjs', /\bsyncCursorMcp\b/],
  ['mcp-drift.mjs', /\bevaluateMcpDeclaredVsWired\b/],
  ['migrate-layout.mjs', /\bMIDAS_TEST_FAIL_STEP\b|classic\/compact.*compact\/hub/],
  ['status-page.mjs', /\bmidas-status\b|\bMIDAS_AUDIT_RESULT\b|Midas harness status|status\.html from state/],
]);

function posix(value) {
  return value.replace(/\\/g, '/');
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readMaybe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function walkFiles(root, rel, out = []) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return out;
  const info = statSync(abs);
  if (info.isFile()) {
    out.push(posix(rel));
    return out;
  }
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    walkFiles(root, join(rel, entry.name), out);
  }
  return out;
}

export function detectLegacyLayout(root) {
  const canonical = existsSync(join(root, '.harness', 'state.yaml')) ||
    existsSync(join(root, '.harness', 'engine', 'VERSION'));
  const midas = existsSync(join(root, '.midas', 'state.yaml')) ||
    existsSync(join(root, '.midas', 'engine', 'VERSION'));
  const classic = existsSync(join(root, 'harness', 'state.yaml')) ||
    existsSync(join(root, 'harness', 'VERSION'));
  const groups = [canonical, midas, classic].filter(Boolean).length;
  if (groups > 1) return 'conflict';
  if (canonical) return 'harness';
  if (classic) return 'classic';
  if (midas) {
    const raw = readMaybe(join(root, '.midas', 'state.yaml')) || '';
    if (/^layout:\s*hub\b/m.test(raw) || existsSync(join(root, '.midas', 'product'))) return 'hub';
    return 'compact';
  }
  return null;
}

function addFile(rows, root, from, to, kind = 'user') {
  const src = join(root, from);
  if (!existsSync(src) || !statSync(src).isFile()) return;
  rows.push({
    from: posix(from),
    to: posix(to),
    kind,
    size: statSync(src).size,
    sha256: sha256File(src),
  });
}

function addTree(rows, root, from, to, kind = 'user', filter = null) {
  for (const file of walkFiles(root, from)) {
    const child = posix(relative(from, file));
    if (filter && !filter(file, child)) continue;
    addFile(rows, root, file, join(to, child), kind);
  }
}

function statePathFor(root, layout) {
  if (layout === 'classic') return 'harness/state.yaml';
  if (layout === 'compact' || layout === 'hub') return '.midas/state.yaml';
  return '.harness/state.yaml';
}

function scriptIsMidas(root, file) {
  const name = file.split('/').at(-1);
  if (!MIDAS_SCRIPT_NAMES.has(name)) return false;
  const raw = readMaybe(join(root, file)) || '';
  const head = raw.slice(0, 600).toLowerCase();
  return head.includes('midas') ||
    head.includes('harness') ||
    (MIDAS_SCRIPT_SIGNATURES.get(name)?.test(raw) ?? false);
}

function knownProductPaths(root, productRoot, stateRaw) {
  const out = new Set();
  for (const name of PRODUCT_FILES) {
    if (existsSync(join(root, productRoot, name))) out.add(posix(join(productRoot, name)));
  }
  for (const name of PRODUCT_DIRS) {
    for (const file of walkFiles(root, join(productRoot, name))) out.add(file);
  }
  const pathKeys = new Set(['artifact', 'artifacts', 'evidence', 'file', 'output', 'path', 'record', 'report', 'sprint', 'config']);
  const productPrefix = `${posix(productRoot)}/`;
  const prefixes = [productPrefix, '{product}/'];

  const addIfProductFile = (valueRaw) => {
    const value = String(valueRaw || '').trim().replace(/[),\]]+$/, '');
    if (!value) return;
    const prefix = prefixes.find((candidate) => value.startsWith(candidate));
    if (!prefix) return;
    const candidate = posix(join(productRoot, value.slice(prefix.length)));
    if (existsSync(join(root, candidate)) && statSync(join(root, candidate)).isFile()) {
      out.add(candidate);
    }
  };

  for (const line of stateRaw.split(/\r?\n/)) {
    // key: path (optional leading list dash)
    const match = line.match(/^\s*(?:-\s*)?([A-Za-z_][\w-]*):\s*['"]?([^'"]+)['"]?\s*(?:#.*)?$/);
    if (match && pathKeys.has(match[1])) {
      const rawValue = match[2].trim();
      if (rawValue.startsWith('[')) {
        for (const part of rawValue.slice(1, -1).split(',')) addIfProductFile(part);
      } else {
        addIfProductFile(rawValue);
      }
    }
    // bare list item: - .midas/product/foo or - {product}/foo
    const bare = line.match(/^\s*-\s+['"]?([^:'"]+)['"]?\s*(?:#.*)?$/);
    if (bare) addIfProductFile(bare[1]);
    // inline map value: { config: .midas/product/biome.json, ... }
    for (const inline of line.matchAll(/\b(?:config|path|file|artifact|record):\s*['"]?([^,'"}\s]+)/g)) {
      addIfProductFile(inline[1]);
    }
  }
  return [...out].sort();
}

export function planV2Migration(projectRoot) {
  const root = resolve(projectRoot);
  const layout = detectLegacyLayout(root);
  if (layout === 'conflict') {
    throw new Error('canonical and legacy install markers coexist; resolve the partial migration first');
  }
  if (!layout) throw new Error('no Midas 1.x install found');
  if (layout === 'harness') {
    return { schema_version: 1, from_layout: 'harness', to_layout: 'harness', rows: [], preserved: [] };
  }

  const stateRel = statePathFor(root, layout);
  const stateRaw = readMaybe(join(root, stateRel)) || '';
  const version = (stateRaw.match(/^midas_version:\s*([^\s#]+)/m) || [])[1] || 'unknown';
  const backupBase = `.harness/migrations/backups/from-${version}-${layout}`;
  const rows = [];
  const preserved = [];

  addFile(rows, root, stateRel, '.harness/state.yaml', 'state');

  const oldEngine = layout === 'classic' ? 'harness' : '.midas/engine';
  addTree(rows, root, oldEngine, `${backupBase}/engine`, 'legacy-vendor',
    (file) => posix(file) !== posix(stateRel));

  const oldScripts = layout === 'classic' ? 'scripts' : '.midas/scripts';
  for (const file of walkFiles(root, oldScripts)) {
    if (scriptIsMidas(root, file)) {
      addFile(rows, root, file, join(backupBase, 'scripts', relative(oldScripts, file)), 'legacy-vendor');
    } else {
      preserved.push(posix(file));
    }
  }

  // Archive only signature-identified Midas host mirrors. Unknown/user skills remain in place.
  for (const skillsRoot of ['.claude/skills', '.agents/skills']) {
    const absSkills = join(root, skillsRoot);
    if (!existsSync(absSkills)) continue;
    for (const entry of readdirSync(absSkills, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillDir = posix(join(skillsRoot, entry.name));
      const skillFile = join(root, skillDir, 'SKILL.md');
      const raw = readMaybe(skillFile) || '';
      if (/\bharness-tier:\s*\w+/m.test(raw) || /\bmidas-harness-tier:\s*\w+/m.test(raw)) {
        addTree(rows, root, skillDir, join(backupBase, 'host-mirrors', skillDir), 'legacy-generated');
      } else {
        preserved.push(...walkFiles(root, skillDir));
      }
    }
  }
  const claudeAgents = join(root, '.claude', 'agents');
  if (existsSync(claudeAgents)) {
    for (const file of walkFiles(root, '.claude/agents')) {
      const name = file.split('/').at(-1);
      const raw = readMaybe(join(root, file)) || '';
      if (/^midas-[\w-]+\.md$/.test(name) && /^---\r?\n[\s\S]*?\bname:\s*midas-/m.test(raw)) {
        addFile(rows, root, file, join(backupBase, 'host-mirrors', file), 'legacy-generated');
      } else {
        preserved.push(file);
      }
    }
  }

  const productRoot = layout === 'hub' ? '.midas/product' : 'product';
  // Hub product tree is entirely project-owned under `.midas/product` — move all of it.
  // Classic/compact keep selective known paths so unknown root `product/custom.txt` stays put.
  if (layout === 'hub') {
    addTree(rows, root, productRoot, '.harness/product', 'user');
  } else {
    const knownProduct = new Set(knownProductPaths(root, productRoot, stateRaw));
    for (const file of walkFiles(root, productRoot)) {
      if (knownProduct.has(file)) {
        addFile(rows, root, file, join('.harness/product', relative(productRoot, file)), 'user');
      } else {
        preserved.push(file);
      }
    }
  }

  const oldRunsRoot = layout === 'classic' ? '.harness' : '.midas';
  for (const name of RUN_DIRS) {
    addTree(rows, root, join(oldRunsRoot, name), join('.harness/runs', name), 'user');
  }
  const oldCache = join(oldRunsRoot, 'cache');
  addTree(rows, root, oldCache, '.harness/cache', 'cache');
  addFile(rows, root, join(oldRunsRoot, 'adapters.hash'), '.harness/cache/adapters.hash', 'cache');

  if (layout !== 'classic') {
    const knownTop = new Set(['engine', 'scripts', 'state.yaml', 'product', ...RUN_DIRS, 'cache', 'adapters.hash']);
    for (const entry of existsSync(join(root, '.midas')) ? readdirSync(join(root, '.midas'), { withFileTypes: true }) : []) {
      if (knownTop.has(entry.name)) continue;
      const rel = join('.midas', entry.name);
      if (entry.isDirectory()) addTree(rows, root, rel, join(backupBase, 'unclassified', entry.name), 'unclassified');
      else addFile(rows, root, rel, join(backupBase, 'unclassified', entry.name), 'unclassified');
    }
  }

  const targetMap = new Map();
  const existingHarnessPaths = new Map(
    walkFiles(root, '.harness').map((file) => [posix(file).toLowerCase(), posix(file)]),
  );
  for (const row of rows) {
    const targetKey = row.to.toLowerCase();
    const existing = targetMap.get(targetKey);
    if (existing && existing.sha256 !== row.sha256) {
      throw new Error(`two different sources target ${row.to}`);
    }
    targetMap.set(targetKey, row);
    const dst = join(root, row.to);
    if (existsSync(dst) && sha256File(dst) !== row.sha256) {
      throw new Error(`destination conflict: ${row.to}`);
    }
    const caseVariant = existingHarnessPaths.get(targetKey);
    if (caseVariant && caseVariant !== row.to && sha256File(join(root, caseVariant)) !== row.sha256) {
      throw new Error(`case-insensitive destination conflict: ${caseVariant} vs ${row.to}`);
    }
  }

  const digest = createHash('sha256')
    .update(rows.map((row) => `${row.from}\0${row.to}\0${row.sha256}`).join('\n'))
    .digest('hex');
  return {
    schema_version: 1,
    from_layout: layout,
    to_layout: 'harness',
    from_version: version,
    backup_base: backupBase,
    rows: rows.sort((a, b) => a.from.localeCompare(b.from)),
    preserved: [...new Set(preserved)].sort(),
    digest,
  };
}

/**
 * Normalize a migrated project rule so doctor `rules:combined` accepts it.
 * v1 hub rules often ship with a UTF-8 BOM (breaks `^#` title detection) and/or a
 * `## CHECK` section without the required `**CHECK:**` marker.
 */
export function normalizeMigratedProjectRule(name, raw) {
  let body = String(raw ?? '').replace(/^\uFEFF/, '');
  if (!/^#\s+\S/m.test(body)) {
    const slug = String(name || 'rule').replace(/\.md$/i, '');
    body = `# Rule: ${slug} (migrated)\n\n${body.replace(/^\s+/, '')}`;
  }
  if (!/\*\*CHECK:\*\*/.test(body)) {
    body = `${body.replace(/\s*$/, '')}\n\n## Checklist\n\n- [ ] Review this migrated stack rule.\n  **CHECK:** \`manual:\` confirm this rule still matches the shipped architecture; amend or replace before the next Phase-8 audit.\n`;
  }
  return body.endsWith('\n') ? body : `${body}\n`;
}

/** Preserve project-authored rule files and explicit legacy amendment sections outside the engine. */
export function extractLegacyRuleOverrides(projectRoot, plan, canonicalRuleNames = []) {
  if (!plan.backup_base) return [];
  const root = resolve(projectRoot);
  const rulesDir = join(root, plan.backup_base, 'engine', 'rules');
  if (!existsSync(rulesDir)) return [];
  const canonical = new Set(canonicalRuleNames);
  const written = [];
  const targetDir = join(root, '.harness', 'rules');
  mkdirSync(targetDir, { recursive: true });
  for (const name of readdirSync(rulesDir).filter((file) => file.endsWith('.md'))) {
    const source = join(rulesDir, name);
    const raw = readFileSync(source, 'utf8');
    if (!canonical.has(name)) {
      const target = join(targetDir, name);
      const body = normalizeMigratedProjectRule(name, raw);
      if (existsSync(target)) {
        const existing = readFileSync(target, 'utf8');
        // Allow rewrite when the on-disk file is the legacy source or an earlier
        // normalize pass; only conflict on a true divergent project edit.
        if (
          existing !== body &&
          existing !== raw &&
          normalizeMigratedProjectRule(name, existing) !== body
        ) {
          throw new Error(`project rule conflict: .harness/rules/${name}`);
        }
      }
      writeFileSync(target, body, 'utf8');
      written.push(posix(relative(root, target)));
      continue;
    }
    const amendments = [...raw.matchAll(/^## Amendment\b[^\r\n]*\r?\n[\s\S]*?(?=^##\s|(?![\s\S]))/gm)]
      .map((match) => match[0].trim())
      .filter(Boolean);
    if (!amendments.length) continue;
    const slug = name.replace(/\.md$/, '');
    const target = join(targetDir, `legacy-${slug}-amendments.md`);
    const body = [
      `# Legacy amendments — ${slug}`,
      '',
      '> Extracted during the v2 layout migration. Review and consolidate into a project rule.',
      '',
      ...amendments,
      '',
    ].join('\n');
    if (existsSync(target) && readFileSync(target, 'utf8') !== body) {
      throw new Error(`project amendment conflict: ${posix(relative(root, target))}`);
    }
    writeFileSync(target, body, 'utf8');
    written.push(posix(relative(root, target)));
  }
  return written;
}

function backupRoots(root) {
  const backup = mkdtempSync(join(tmpdir(), 'midas-v2-migration-'));
  const entries = [];
  for (const rel of ['.harness', '.midas', '.claude', '.agents', 'harness', 'scripts', 'product']) {
    const src = join(root, rel);
    if (!existsSync(src)) continue;
    const dst = join(backup, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: statSync(src).isDirectory(), preserveTimestamps: true });
    entries.push(rel);
  }
  return { backup, entries };
}

function rollback(root, session) {
  for (const rel of ['.harness', '.midas', '.claude', '.agents', 'harness', 'scripts', 'product']) {
    rmSync(join(root, rel), { recursive: true, force: true });
  }
  for (const rel of session.entries) {
    const src = join(session.backup, rel);
    const dst = join(root, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: statSync(src).isDirectory(), preserveTimestamps: true });
  }
}

function rewriteState(raw) {
  const paths = [
    'paths:',
    '  root: .harness',
    '  engine: .harness/engine',
    '  scripts: .harness/scripts',
    '  state: .harness/state.yaml',
    '  product: .harness/product',
    '  rules: .harness/rules',
    '  runs: .harness/runs',
    '  cache: .harness/cache',
  ].join('\n');
  let next = raw.replace(/^layout:\s*\S+.*$/m, 'layout: harness');
  if (!/^layout:/m.test(next)) {
    next = next.replace(/^(midas_version:[^\n]*\n)/m, '$1layout: harness\n');
  }
  if (/^paths:\s*$/m.test(next)) {
    next = next.replace(/^paths:\s*\r?\n(?:^[ \t]+.*(?:\r?\n|$))*/m, `${paths}\n`);
  } else {
    next = next.replace(/^(layout:[^\n]*\n)/m, `$1${paths}\n`);
  }
  const pathKeys = new Set([
    'artifact',
    'artifacts',
    'config',
    'evidence',
    'file',
    'output',
    'path',
    'paths',
    'record',
    'report',
    'rule',
    'rules',
    'sprint',
  ]);
  const rewriteKnownPath = (value) => {
    if (value === 'product') return '.harness/product';
    if (value.startsWith('product/')) return `.harness/product/${value.slice('product/'.length)}`;
    if (value === '.midas/product') return '.harness/product';
    if (value.startsWith('.midas/product/')) return `.harness/product/${value.slice('.midas/product/'.length)}`;
    if (value === 'harness/rules') return '.harness/engine/rules';
    if (value.startsWith('harness/rules/')) return `.harness/engine/rules/${value.slice('harness/rules/'.length)}`;
    // Hub stack overlays lived under `.midas/engine/rules/` → project `.harness/rules/`.
    if (value === '.midas/engine/rules') return '.harness/rules';
    if (value.startsWith('.midas/engine/rules/')) return `.harness/rules/${value.slice('.midas/engine/rules/'.length)}`;
    for (const dir of RUN_DIRS) {
      if (value === `.midas/${dir}` || value === `.harness/${dir}`) return `.harness/runs/${dir}`;
      if (value.startsWith(`.midas/${dir}/`)) return `.harness/runs/${dir}/${value.slice(`.midas/${dir}/`.length)}`;
      if (value.startsWith(`.harness/${dir}/`)) return `.harness/runs/${dir}/${value.slice(`.harness/${dir}/`.length)}`;
    }
    return value;
  };
  const rewritePathToken = (token) => rewriteKnownPath(String(token || '').trim().replace(/[),\]]+$/, ''));

  return next.split(/\r?\n/).map((line) => {
    // Bare list item: - .midas/product/foo
    const bare = line.match(/^(\s*-\s+)(['"]?)([^'"]+)\2(\s*(?:#.*)?)?$/);
    if (bare && !/^\s*-\s+[A-Za-z_][\w-]*:/.test(line)) {
      const rewritten = rewritePathToken(bare[3]);
      if (rewritten !== bare[3].trim()) {
        return `${bare[1]}${bare[2]}${rewritten}${bare[2]}${bare[4] || ''}`;
      }
    }

    const match = line.match(/^(\s*(?:-\s*)?)([A-Za-z_][\w-]*):\s*(['"]?)([^'"]*?)\3(\s*(?:#.*)?)$/);
    if (match && pathKeys.has(match[2])) {
      const rawValue = match[4].trim();
      if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        const inner = rawValue.slice(1, -1).split(',').map((part) => {
          const trimmed = part.trim();
          const qm = trimmed.match(/^(['"]?)(.+)\1$/);
          const token = qm ? qm[2] : trimmed;
          const rewritten = rewritePathToken(token);
          return qm ? `${qm[1]}${rewritten}${qm[1]}` : rewritten;
        });
        return `${match[1]}${match[2]}: [${inner.join(', ')}]${match[5] || ''}`;
      }
      const rewritten = rewritePathToken(rawValue);
      if (rewritten !== rawValue) {
        return `${match[1]}${match[2]}: ${match[3]}${rewritten}${match[3]}${match[5]}`;
      }
    }

    // Inline map fields: { config: .midas/product/biome.json, installed: true }
    return line.replace(
      /\b(config|path|file|artifact|record):\s*(['"]?)([^,'"}\s]+)\2/g,
      (full, key, quote, value) => {
        const rewritten = rewritePathToken(value);
        return rewritten === value ? full : `${key}: ${quote}${rewritten}${quote}`;
      },
    );
  }).join('\n');
}

function rewriteMovedMarkdown(path) {
  if (!path.endsWith('.md')) return;
  const raw = readMaybe(path);
  if (raw == null) return;
  const next = raw
    .replace(/\]\((?:\.\/)?product\//g, '](.harness/product/')
    .replace(/\]\(\.midas\/product\//g, '](.harness/product/');
  if (next !== raw) writeFileSync(path, next, 'utf8');
}

function removeEmptyParents(root, rel) {
  let current = dirname(join(root, rel));
  const stop = resolve(root);
  while (current.startsWith(stop) && current !== stop) {
    try {
      if (readdirSync(current).length) break;
      rmSync(current);
    } catch {
      break;
    }
    current = dirname(current);
  }
}

function pruneEmptyTree(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyTree(join(path, entry.name));
  }
  try {
    if (readdirSync(path).length === 0) rmdirSync(path);
  } catch {
    // A concurrent/user file appeared; leave the directory intact.
  }
}

export function applyV2Migration(projectRoot, plan = planV2Migration(projectRoot)) {
  const root = resolve(projectRoot);
  if (!plan.rows.length) return plan;
  const session = backupRoots(root);
  const staging = mkdtempSync(join(tmpdir(), 'midas-v2-staging-'));
  const maybeFail = (step) => {
    if (process.env.MIDAS_TEST_FAIL_STEP === step) throw new Error(`injected failure: ${step}`);
  };
  try {
    // Build and verify the complete destination image outside `.harness/` before touching the project.
    for (const row of plan.rows) {
      const src = join(root, row.from);
      const dst = join(staging, row.to);
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(src, dst, { preserveTimestamps: true });
      if (sha256File(dst) !== row.sha256) throw new Error(`hash verification failed: ${row.to}`);
    }
    maybeFail('after-staging');
    for (const row of plan.rows) {
      const staged = join(staging, row.to);
      const dst = join(root, row.to);
      if (existsSync(dst)) continue;
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(staged, dst, { preserveTimestamps: true });
      if (sha256File(dst) !== row.sha256) throw new Error(`commit hash verification failed: ${row.to}`);
    }
    maybeFail('after-copy');
    const state = join(root, '.harness', 'state.yaml');
    if (existsSync(state)) {
      writeFileSync(state, rewriteState(readFileSync(state, 'utf8')), 'utf8');
    }
    for (const row of plan.rows.filter((row) => row.to.startsWith('.harness/product/'))) {
      rewriteMovedMarkdown(join(root, row.to));
    }
    maybeFail('after-rewrite');
    for (const row of [...plan.rows].sort((a, b) => b.from.length - a.from.length)) {
      const src = join(root, row.from);
      if (!existsSync(src)) continue;
      if (src === join(root, row.to)) continue;
      rmSync(src, { force: true });
      removeEmptyParents(root, row.from);
    }
    for (const rel of ['.midas', 'harness']) {
      pruneEmptyTree(join(root, rel));
    }
    maybeFail('after-delete');
    rmSync(staging, { recursive: true, force: true });
    rmSync(session.backup, { recursive: true, force: true });
    return plan;
  } catch (error) {
    rollback(root, session);
    rmSync(staging, { recursive: true, force: true });
    rmSync(session.backup, { recursive: true, force: true });
    throw new Error(`migration rolled back: ${error.message || error}`);
  }
}

export function writeMigrationReceipt(projectRoot, plan, version) {
  const root = resolve(projectRoot);
  const receipt = {
    schema_version: 1,
    applied_at: new Date().toISOString(),
    from_layout: plan.from_layout,
    to_layout: 'harness',
    from_version: plan.from_version,
    to_version: version,
    digest: plan.digest,
    moved: plan.rows.map(({ from, to, kind, size, sha256 }) => ({ from, to, kind, size, sha256 })),
    preserved: plan.preserved,
  };
  const path = join(root, '.harness', 'migrations', 'receipts', `to-${version}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  return path;
}

export function formatMigrationPlan(plan) {
  const lines = [
    `Midas migrate — ${plan.from_layout} -> harness`,
    '',
    'FROM'.padEnd(48) + ' -> TO',
  ];
  for (const row of plan.rows) lines.push(row.from.padEnd(48) + ` -> ${row.to}`);
  if (!plan.rows.length) lines.push('(nothing to move)');
  if (plan.preserved.length) {
    lines.push('', 'Preserved in place (not proven Midas-owned):');
    for (const path of plan.preserved) lines.push(`  - ${path}`);
  }
  if (plan.digest) lines.push('', `Plan digest: ${plan.digest}`);
  return lines.join('\n');
}
