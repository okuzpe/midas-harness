// autonomy-install.mjs — optional ADR-009 capability copy + prune.

import { readdirSync, existsSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isAutonomyUserEntry } from '../core/preserve-policy.mjs';

/**
 * @typedef {{
 *   target: string,
 *   template: string,
 *   written: string[],
 *   skipped: string[],
 *   readMaybe: (p: string) => string|null,
 * }} AutonomyCtx
 */

/**
 * Install optional autonomy capability from template/.optional/autonomy → .harness/autonomy.
 * Preserves user policy, authz, control, and ledger files on refresh.
 * @param {AutonomyCtx} ctx
 */
export function installAutonomyCapability(ctx) {
  const src = join(ctx.template, '.optional', 'autonomy');
  if (!existsSync(src)) {
    throw new Error(
      'create-midas: --autonomy requested but bundled capability is missing (.optional/autonomy). ' +
        'Rebuild the package (`npm run build`) or pin a release that includes ADR-009.',
    );
  }
  const dst = join(ctx.target, '.harness', 'autonomy');
  mkdirSync(dst, { recursive: true });
  copyAutonomyTree(ctx, src, dst, '.harness/autonomy');
  const policyDst = join(dst, 'policy.yaml');
  if (!existsSync(policyDst)) {
    copyFileSync(join(src, 'policy.default.yaml'), policyDst);
    ctx.written.push('.harness/autonomy/policy.yaml');
  }
}

/** Append disabled autonomy pointers to an existing state.yaml when --autonomy is first enabled. */
export function ensureAutonomyStatePointers(ctx) {
  const stateFile = join(ctx.target, '.harness', 'state.yaml');
  if (!existsSync(stateFile)) return;
  const cur = ctx.readMaybe(stateFile);
  if (cur == null || /^autonomy:/m.test(cur)) return;
  const block = [
    '',
    '# Optional autonomy pointers (ADR-009) — disabled until policy enabled',
    'autonomy:',
    '  enabled: false',
    '  mode: disabled',
    '  status: idle',
    '  policy_digest: ""',
    '  active_agent_id: null',
    '  active_run_id: null',
    '  active_sha: null',
    '  journal_path: .harness/runs/autonomy/journal.jsonl',
    '  next_attempt_at: null',
    '',
  ].join('\n');
  writeFileSync(stateFile, cur.endsWith('\n') ? `${cur}${block}` : `${cur}\n${block}`);
  ctx.written.push('.harness/state.yaml (autonomy pointers)');
}

function copyAutonomyTree(ctx, srcDir, dstDir, relBase) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    const rel = `${relBase}/${entry.name}`.replace(/\\/g, '/');
    if (isAutonomyUserEntry(entry.name) && existsSync(dst)) {
      ctx.skipped.push(rel);
      continue;
    }
    if (entry.isDirectory()) {
      mkdirSync(dst, { recursive: true });
      copyAutonomyTree(ctx, src, dst, rel);
    } else {
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      ctx.written.push(rel);
    }
  }
}

export function pruneStaleAutonomyVendor(ctx) {
  const installed = join(ctx.target, '.harness', 'autonomy');
  const template = join(ctx.template, '.optional', 'autonomy');
  if (!existsSync(installed) || !existsSync(template)) return;
  for (const entry of readdirSync(installed, { withFileTypes: true })) {
    if (isAutonomyUserEntry(entry.name)) continue;
    const childInstalled = join(installed, entry.name);
    const childTemplate = join(template, entry.name);
    const rel = `.harness/autonomy/${entry.name}`;
    if (!existsSync(childTemplate)) {
      rmSync(childInstalled, { recursive: true, force: true });
      ctx.written.push(`removed:${rel}`);
    } else if (entry.isDirectory()) {
      pruneStaleAutonomyVendorDir(ctx, rel, join('.optional', 'autonomy', entry.name).replace(/\\/g, '/'));
    }
  }
}

function pruneStaleAutonomyVendorDir(ctx, installedRel, templateRel) {
  const installed = join(ctx.target, installedRel);
  const template = join(ctx.template, templateRel);
  if (!existsSync(installed) || !existsSync(template)) return;
  for (const entry of readdirSync(installed, { withFileTypes: true })) {
    if (isAutonomyUserEntry(entry.name)) continue;
    const childInstalled = join(installed, entry.name);
    const childTemplate = join(template, entry.name);
    const rel = `${installedRel}/${entry.name}`.replace(/\\/g, '/');
    if (!existsSync(childTemplate)) {
      rmSync(childInstalled, { recursive: true, force: true });
      ctx.written.push(`removed:${rel}`);
      continue;
    }
    if (entry.isDirectory()) pruneStaleAutonomyVendorDir(ctx, rel, `${templateRel}/${entry.name}`);
  }
}
