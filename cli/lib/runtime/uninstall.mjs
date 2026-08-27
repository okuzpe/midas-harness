// uninstall.mjs — surgical Midas uninstall for harness + legacy layouts.

import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync, rmdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  readOwnershipManifest,
  sha256File,
} from '../../template/.harness/scripts/ownership-manifest.mjs';
import { stripTraceHooks } from '../steps/trace-hooks.mjs';
import { stripSafetyHooks } from '../steps/safety-hooks.mjs';
import { stripCarryoverHooks } from '../steps/carryover-hooks.mjs';
import { stripContextCostHooks } from '../steps/context-cost-hooks.mjs';

/**
 * @typedef {{
 *   target: string,
 *   template: string,
 *   dryRun: boolean,
 *   purge: boolean,
 *   detectInstallLayout: (dir: string) => string|null,
 * }} UninstallCtx
 */

function listTemplateFiles(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listTemplateFiles(p, base, out);
    else out.push(relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}

function rmFile(ctx, rel) {
  if (ctx.dryRun) return;
  try { rmSync(join(ctx.target, rel)); } catch { /* already gone */ }
}

function stripClaudeBlock(text) {
  const B = '<!-- midas:begin';
  const E = '<!-- midas:end -->';
  let out = text;
  const bi = out.indexOf(B);
  const ei = out.indexOf(E);
  if (bi !== -1 && ei !== -1 && ei > bi) out = out.slice(0, bi) + out.slice(ei + E.length);
  return out
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '@AGENTS.md' && l.trim() !== '# Project memory')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pruneEmptyTree(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) pruneEmptyTree(join(dir, e.name));
  }
  try { if (readdirSync(dir).length === 0) rmdirSync(dir); } catch { /* ignore */ }
}

function templateToInstalledRel(rel, layout) {
  if (layout !== 'compact' && layout !== 'hub') return rel;
  if (rel.startsWith('harness/')) return rel.replace(/^harness\//, '.midas/engine/');
  if (rel.startsWith('scripts/')) return rel.replace(/^scripts\//, '.midas/scripts/');
  if (rel === 'docs/agents-and-models.md') return '.midas/docs/agents-and-models.md';
  return rel;
}

function stripManagedBlock(text, begin, end) {
  const bi = text.indexOf(begin);
  const ei = text.indexOf(end);
  if (bi === -1 || ei < bi) return text;
  return `${text.slice(0, bi)}${text.slice(ei + end.length)}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pruneEmptyDirs(ctx, layout) {
  if (ctx.dryRun) return;
  const roots = ['.claude', '.agents', '.cursor', '.windsurf', '.harness', 'harness', 'docs', 'scripts', '.midas'];
  for (const root of roots) pruneEmptyTree(join(ctx.target, root));
}

function reportUninstall(ctx, { removed, keptModified, keptUser, purged, layout }) {
  const runsLabel = layout === 'harness' ? '.harness/runs/' : layout === 'classic' ? '.harness/' : '.midas/';
  console.log(`\n  🧹 Midas uninstall from ${ctx.target}${ctx.dryRun ? '   (dry run — nothing deleted)' : ''}`);
  console.log(`     ${removed.length} engine file(s) ${ctx.dryRun ? 'would be removed' : 'removed'}` +
    (purged.length ? `, ${purged.length} work path(s) ${ctx.dryRun ? 'would be purged' : 'purged'}` : ''));
  if (keptModified.length) {
    console.log('\n  Kept — you modified these (remove by hand if you want them gone):');
    for (const f of keptModified) console.log(`     · ${f}`);
  }
  if (keptUser.length) {
    console.log('\n  Kept — your work / not Midas:');
    for (const f of keptUser) console.log(`     · ${f}`);
  }
  if (purged.length) {
    console.log('\n  Purged — your work, by --purge:');
    for (const f of purged) console.log(`     · ${f}`);
  }
  console.log(ctx.dryRun
    ? '\n  Re-run without --dry-run to apply.\n'
    : `\n  Done — Midas removed.${ctx.purge ? '' : ` Your .harness/product/, .harness/rules/, ${runsLabel} and state.yaml were kept (use --purge to remove those too).`}\n`);
}

/**
 * Strip Midas Cursor hook entries (trace, safety, carryover, context-cost).
 * @param {UninstallCtx} ctx
 * @param {string[]} removed
 */
function stripMidasCursorHooks(ctx, removed) {
  if (!existsSync(join(ctx.target, '.cursor', 'hooks.json'))) return;
  if (ctx.dryRun) {
    removed.push('.cursor/hooks.json (Midas trace + safety + carryover + context-cost hook entries would be stripped)');
    return;
  }
  const stripTrace = stripTraceHooks(ctx.target);
  if (stripTrace.wrote) {
    removed.push(stripTrace.removed
      ? '.cursor/hooks.json (Midas trace hooks; file removed)'
      : '.cursor/hooks.json (Midas trace hook entries stripped)');
  }
  const stripSafety = stripSafetyHooks(ctx.target);
  if (stripSafety.wrote) {
    removed.push(stripSafety.removed
      ? '.cursor/hooks.json (Midas safety hooks; file removed)'
      : '.cursor/hooks.json (Midas safety hook entries stripped)');
  }
  const stripCarryover = stripCarryoverHooks(ctx.target);
  if (stripCarryover.wrote) {
    removed.push(stripCarryover.removed
      ? '.cursor/hooks.json (Midas carryover hooks; file removed)'
      : '.cursor/hooks.json (Midas carryover hook entries stripped)');
  }
  const stripCost = stripContextCostHooks(ctx.target);
  if (stripCost.wrote) {
    removed.push(stripCost.removed
      ? '.cursor/hooks.json (Midas context-cost hooks; file removed)'
      : '.cursor/hooks.json (Midas context-cost hook entries stripped)');
  }
}

function runCanonicalUninstall(ctx, { removed, keptModified, keptUser, purged }) {
  const manifest = readOwnershipManifest(ctx.target);
  if (!manifest) {
    keptModified.push('.harness/manifest.json (missing or invalid — refusing ownership guesses)');
    return;
  }
  const regionManagedPaths = new Set([
    'AGENTS.md',
    '.claude/CLAUDE.md',
    'GEMINI.md',
    '.cursor/rules/00-midas.mdc',
    '.cursor/rules/01-midas-checks.mdc',
    '.harness/.windsurf/rules/00-midas.md',
    '.harness/.windsurf/rules/01-midas-checks.md',
    'harness/.windsurf/rules/00-midas.md',
    'harness/.windsurf/rules/01-midas-checks.md',
    '.midas/.windsurf/rules/00-midas.md',
    '.midas/.windsurf/rules/01-midas-checks.md',
    '.windsurf/rules/00-midas.md',
    '.windsurf/rules/01-midas-checks.md',
  ]);
  for (const file of manifest.files) {
    if (regionManagedPaths.has(file.path)) continue;
    const abs = join(ctx.target, file.path);
    if (!existsSync(abs)) continue;
    if (file.role === 'user') {
      keptUser.push(`${file.path} (user-owned)`);
      continue;
    }
    if (sha256File(abs) === file.sha256) {
      rmFile(ctx, file.path);
      removed.push(file.path);
    } else {
      keptModified.push(`${file.path} (modified — left untouched)`);
    }
  }

  for (const [rel, begin, end] of [
    ['AGENTS.md', '<!-- midas:begin AGENTS -->', '<!-- midas:end AGENTS -->'],
    ['.claude/CLAUDE.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['GEMINI.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.cursor/rules/00-midas.mdc', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.cursor/rules/01-midas-checks.mdc', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.harness/.windsurf/rules/00-midas.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.harness/.windsurf/rules/01-midas-checks.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['harness/.windsurf/rules/00-midas.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['harness/.windsurf/rules/01-midas-checks.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.midas/.windsurf/rules/00-midas.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.midas/.windsurf/rules/01-midas-checks.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.windsurf/rules/00-midas.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
    ['.windsurf/rules/01-midas-checks.md', '<!-- midas:begin GENERATED', '<!-- midas:end -->'],
  ]) {
    const abs = join(ctx.target, rel);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, 'utf8');
    const clean = stripManagedBlock(raw, begin, end);
    if (clean === raw.trim()) continue;
    if (!ctx.dryRun) {
      if (clean) writeFileSync(abs, `${clean}\n`, 'utf8');
      else rmSync(abs, { force: true });
    }
    removed.push(`${rel} (Midas managed block)`);
  }

  stripMidasCursorHooks(ctx, removed);

  const userPaths = [
    '.harness/product',
    '.harness/rules',
    '.harness/runs',
    '.harness/migrations/receipts',
    '.harness/migrations/backups',
    '.harness/state.yaml',
  ];
  for (const rel of userPaths) {
    if (!existsSync(join(ctx.target, rel))) continue;
    if (ctx.purge) {
      if (!ctx.dryRun) rmSync(join(ctx.target, rel), { recursive: true, force: true });
      purged.push(rel);
    } else {
      keptUser.push(`${rel} (your work — kept)`);
    }
  }
  if (!ctx.dryRun) rmSync(join(ctx.target, '.harness', 'cache'), { recursive: true, force: true });
  if (!ctx.dryRun) rmSync(join(ctx.target, '.harness', 'manifest.json'), { force: true });
  pruneEmptyDirs(ctx, 'harness');
}

/**
 * Run uninstall against ctx.target.
 * @param {UninstallCtx} ctx
 */
export function runUninstall(ctx) {
  const removed = [];
  const keptModified = [];
  const keptUser = [];
  const purged = [];
  const ADAPTERS = ['CLAUDE.md', '.cursor/rules/00-midas.mdc', '.cursor/rules/01-midas-checks.mdc', '.windsurf/rules/00-midas.md', '.windsurf/rules/01-midas-checks.md', 'GEMINI.md'];
  const layout = ctx.detectInstallLayout(ctx.target);
  if (layout === 'harness') {
    runCanonicalUninstall(ctx, { removed, keptModified, keptUser, purged });
    reportUninstall(ctx, { removed, keptModified, keptUser, purged, layout });
    return;
  }

  for (const rel of listTemplateFiles(ctx.template)) {
    if (rel === 'AGENTS.md') continue;
    const installedRel = templateToInstalledRel(rel, layout);
    const abs = join(ctx.target, installedRel);
    if (!existsSync(abs)) continue;
    if (readFileSync(join(ctx.template, rel)).equals(readFileSync(abs))) {
      rmFile(ctx, installedRel);
      removed.push(installedRel);
    } else keptModified.push(installedRel);
  }

  if (existsSync(join(ctx.target, 'AGENTS.md'))) {
    if (readFileSync(join(ctx.target, 'AGENTS.md'), 'utf8').includes('generated** from the Midas harness')) {
      rmFile(ctx, 'AGENTS.md'); removed.push('AGENTS.md');
    } else keptUser.push('AGENTS.md (not Midas-generated — left untouched)');
  }

  for (const rel of ADAPTERS) {
    const abs = join(ctx.target, rel);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    if (!text.includes('midas:begin')) { keptUser.push(`${rel} (no Midas marker — left untouched)`); continue; }
    if (rel === 'CLAUDE.md') {
      const rest = stripClaudeBlock(text);
      if (rest === '') { rmFile(ctx, rel); removed.push(rel); }
      else { if (!ctx.dryRun) writeFileSync(abs, rest + '\n', 'utf8'); keptModified.push('CLAUDE.md (removed Midas block; kept your notes)'); }
    } else { rmFile(ctx, rel); removed.push(rel); }
  }

  const hashPaths = layout === 'classic'
    ? ['.harness/adapters.hash']
    : ['.midas/cache/adapters.hash'];
  for (const hp of hashPaths) {
    if (existsSync(join(ctx.target, hp))) { rmFile(ctx, hp); removed.push(hp); }
  }

  stripMidasCursorHooks(ctx, removed);

  const workPaths = layout === 'hub'
    ? ['.midas']
    : layout === 'compact'
      ? ['product', '.midas', '.midas/state.yaml']
      : ['product', '.harness', 'harness/state.yaml'];
  for (const rel of workPaths) {
    if (!existsSync(join(ctx.target, rel))) continue;
    if (ctx.purge) { if (!ctx.dryRun) rmSync(join(ctx.target, rel), { recursive: true, force: true }); purged.push(rel); }
    else keptUser.push(`${rel} (your work — kept; re-run with --purge to remove)`);
  }

  pruneEmptyDirs(ctx, layout);
  reportUninstall(ctx, { removed, keptModified, keptUser, purged, layout });
}

/** Remove a single target-relative path (used by adapters prune). */
export function rmTargetFile(ctx, rel) {
  rmFile(ctx, rel);
}
