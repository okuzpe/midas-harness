// uninstall.mjs — surgical Midas uninstall for v2 `.harness/` installs.

import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  readOwnershipManifest,
  sha256File,
} from '../shared/ownership-manifest.mjs';
import { stripTraceHooks } from '../steps/trace-hooks.mjs';
import { stripSafetyHooks } from '../steps/safety-hooks.mjs';
import { stripCarryoverHooks } from '../steps/carryover-hooks.mjs';
import { stripContextCostHooks } from '../steps/context-cost-hooks.mjs';
import { V1_REFUSE_MESSAGE, isV1Install } from '../core/context.mjs';

/**
 * @typedef {{
 *   target: string,
 *   template: string,
 *   dryRun: boolean,
 *   purge: boolean,
 *   detectInstallLayout: (dir: string) => string|null,
 * }} UninstallCtx
 */

function rmFile(ctx, rel) {
  if (ctx.dryRun) return;
  try { rmSync(join(ctx.target, rel)); } catch (err) {
    console.error(`midas uninstall: ${rel}: ${err instanceof Error ? err.message : err}`);
  }
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
  try { if (readdirSync(dir).length === 0) rmdirSync(dir); } catch (err) {
    console.error(`midas uninstall: prune ${dir}: ${err instanceof Error ? err.message : err}`);
  }
}

function stripManagedBlock(text, begin, end) {
  const bi = text.indexOf(begin);
  const ei = text.indexOf(end);
  if (bi === -1 || ei < bi) return text;
  return `${text.slice(0, bi)}${text.slice(ei + end.length)}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pruneEmptyDirs(ctx) {
  if (ctx.dryRun) return;
  const roots = ['.claude', '.agents', '.cursor', '.windsurf', '.harness'];
  for (const root of roots) pruneEmptyTree(join(ctx.target, root));
}

function reportUninstall(ctx, { removed, keptModified, keptUser, purged, layout }) {
  const runsLabel = '.harness/runs/';
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
  const shimDir = join(ctx.target, '.harness', 'bin');
  if (existsSync(shimDir)) {
    if (!ctx.dryRun) rmSync(shimDir, { recursive: true, force: true });
    removed.push('.harness/bin (generated shim)');
  }
  pruneEmptyDirs(ctx);
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
  const layout = ctx.detectInstallLayout(ctx.target);
  if (isV1Install(ctx.target) || layout !== 'harness') {
    throw new Error(V1_REFUSE_MESSAGE);
  }
  runCanonicalUninstall(ctx, { removed, keptModified, keptUser, purged });
  reportUninstall(ctx, { removed, keptModified, keptUser, purged, layout });
}

/** Remove a single target-relative path (used by adapters prune). */
export function rmTargetFile(ctx, rel) {
  rmFile(ctx, rel);
}
