// copy-tree.mjs — template → target copy + vendor prune for install/update.

import { readdirSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { decideTemplateCopyAction } from '../core/preserve-policy.mjs';

/**
 * @typedef {{
 *   target: string,
 *   template: string,
 *   update: boolean,
 *   migrate: boolean,
 *   force: boolean,
 *   written: string[],
 *   skipped: string[],
 * }} CopyCtx
 */

/** Wipe engine/scripts on fresh install so copy starts clean. */
export function resetFreshVendorTrees(ctx) {
  if (ctx.update || ctx.migrate) return;
  for (const rel of ['.harness/engine', '.harness/scripts']) {
    rmSync(join(ctx.target, rel), { recursive: true, force: true });
  }
}

/**
 * Recursive template copy with preserve/skip policy matching plan-tree.
 * @param {string} srcDir
 * @param {string} dstDir
 * @param {CopyCtx} ctx
 */
export function copyTree(srcDir, dstDir, ctx) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === '.optional') continue;
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(dst, { recursive: true });
      copyTree(src, dst, ctx);
    } else {
      const rel = relative(ctx.target, dst).replace(/\\/g, '/');
      const decided = decideTemplateCopyAction(rel, {
        exists: existsSync(dst),
        force: ctx.force,
        update: ctx.update,
      });
      if (decided.action === 'skip') {
        ctx.skipped.push(rel);
        continue;
      }
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      ctx.written.push(rel);
    }
  }
}

/** Remove vendor files dropped from the bundled engine since the last install. */
export function pruneStaleVendorTree(ctx, installedRel, templateRel) {
  const installed = join(ctx.target, installedRel);
  const template = join(ctx.template, templateRel);
  if (!existsSync(installed) || !existsSync(template)) return;
  for (const entry of readdirSync(installed, { withFileTypes: true })) {
    const childInstalled = join(installed, entry.name);
    const childTemplate = join(template, entry.name);
    const rel = join(installedRel, entry.name).replace(/\\/g, '/');
    if (!existsSync(childTemplate)) {
      rmSync(childInstalled, { recursive: true, force: true });
      ctx.written.push(`removed:${rel}`);
      continue;
    }
    if (entry.isDirectory()) {
      pruneStaleVendorTree(ctx, rel, join(templateRel, entry.name).replace(/\\/g, '/'));
    }
  }
}
