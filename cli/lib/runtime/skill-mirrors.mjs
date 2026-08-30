// skill-mirrors.mjs — host skill mirrors + orphan adapter prune.

import { readdirSync, readFileSync, existsSync, rmSync, rmdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { toPosixRel } from '../shared/posix.mjs';

function logFs(rel, err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`midas skill-mirrors: ${rel}: ${msg}`);
}

/**
 * @typedef {{
 *   target: string,
 *   template: string,
 *   update: boolean,
 *   written: string[],
 *   importTrustedScript: (name: string) => Promise<any>,
 *   rmFile: (rel: string) => void,
 * }} SkillMirrorCtx
 */

export function sameBytes(a, b) {
  return existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
}

/** rmdir a host root when it has no remaining entries (user files keep the tree). */
function pruneEmptyHostRoot(target, rel) {
  const dir = join(target, rel);
  if (!existsSync(dir)) return;
  try {
    if (readdirSync(dir).length === 0) rmdirSync(dir);
  } catch (err) { logFs(rel, err); }
}

export function removeGeneratedMirror(ctx, templateRel) {
  const source = join(ctx.template, templateRel);
  const target = join(ctx.target, templateRel);
  if (!existsSync(source) || !existsSync(target)) return;
  const visit = (src, dst) => {
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      const a = join(src, entry.name);
      const b = join(dst, entry.name);
      if (!existsSync(b)) continue;
      if (entry.isDirectory()) {
        visit(a, b);
        try { if (readdirSync(b).length === 0) rmdirSync(b); } catch (err) { logFs(b, err); }
      } else if (existsSync(b)) {
        // Template-known paths are generated mirrors, even if dest bytes drifted (portable
        // frontmatter rewrite). User skills are dest-only names and are not visited.
        try { rmSync(b); } catch (err) { logFs(b, err); }
      }
    }
  };
  visit(source, target);
  try { if (readdirSync(target).length === 0) rmdirSync(target); } catch (err) { logFs(target, err); }
}

export function resolveSkillMirrorPlan(tools) {
  const portablePeers = ['windsurf', 'gemini', 'codex', 'copilot'];
  const list = tools || [];
  const hasPortablePeer = list.some((t) => portablePeers.includes(t));
  return {
    claude: list.includes('claude-code'),
    agents: hasPortablePeer,
    cursorSkills: list.includes('cursor') && !hasPortablePeer,
  };
}

export async function syncSkillMirrors(ctx, tools, paths, { merge = true } = {}) {
  const plan = resolveSkillMirrorPlan(tools);
  if (!plan.claude) {
    removeGeneratedMirror(ctx, '.claude/skills');
    removeGeneratedMirror(ctx, '.claude/agents');
    pruneEmptyHostRoot(ctx.target, '.claude');
  }

  let renderTree = null;
  let pruneObsolete = null;
  try {
    const mod = await ctx.importTrustedScript('portable-skills.mjs');
    renderTree = mod.renderPortableSkillsTree;
    pruneObsolete = mod.pruneObsoleteMidasSkillMirrors;
  } catch (err) { logFs('engine-skills', err); }

  const engineSkillsRel = join(paths.engine, 'skills').replace(/\\/g, '/');

  if (plan.agents && typeof renderTree === 'function') {
    if (typeof pruneObsolete === 'function') {
      for (const rel of pruneObsolete(ctx.target, {
        sourceDir: engineSkillsRel,
        targetDir: '.agents/skills',
        bundledMirrorRoot: ctx.template,
      })) {
        ctx.written.push(`removed:${rel}`);
      }
    }
    renderTree(ctx.target, { sourceDir: engineSkillsRel, targetDir: '.agents/skills', merge });
  } else if (!plan.agents) {
    removeGeneratedMirror(ctx, '.agents/skills');
    pruneEmptyHostRoot(ctx.target, '.agents');
  }

  if (plan.cursorSkills && typeof renderTree === 'function') {
    if (typeof pruneObsolete === 'function') {
      for (const rel of pruneObsolete(ctx.target, {
        sourceDir: engineSkillsRel,
        targetDir: '.cursor/skills',
        bundledMirrorRoot: ctx.template,
      })) {
        ctx.written.push(`removed:${rel}`);
      }
    }
    renderTree(ctx.target, { sourceDir: engineSkillsRel, targetDir: '.cursor/skills', merge });
  } else if (!plan.cursorSkills) {
    removeGeneratedMirror(ctx, '.cursor/skills');
  }
}

/** Drop legacy root artifacts superseded by harness-layout or pruned tools. */
export function pruneLegacyRootArtifacts(ctx, tools) {
  if (!ctx.update) return;
  const engineAgentsDoc = join(ctx.target, '.harness', 'engine', 'docs', 'agents-and-models.md');
  if (existsSync(engineAgentsDoc) && existsSync(join(ctx.target, 'docs', 'agents-and-models.md'))) {
    ctx.rmFile('docs/agents-and-models.md');
    ctx.written.push('removed:docs/agents-and-models.md');
  }
  if (!tools.includes('gemini') && existsSync(join(ctx.target, 'gemini-extension.json'))) {
    ctx.rmFile('gemini-extension.json');
    ctx.written.push('removed:gemini-extension.json');
  }
}

const MIDAS_EMPTY_DIR_BASES = new Set([
  '.windsurf',
  '.windsurf/rules',
  '.harness/.windsurf',
  '.harness/.windsurf/rules',
  'harness/.windsurf',
  'harness/.windsurf/rules',
  '.midas/.windsurf',
  '.midas/.windsurf/rules',
  '.claude',
]);

/** Remove a generated adapter file and prune empty Midas-owned parent dirs. */
function removeGeneratedFile(ctx, rel) {
  const target = join(ctx.target, rel);
  if (!existsSync(target)) return;
  const source = join(ctx.template, rel);
  if (existsSync(source)) {
    if (sameBytes(source, target)) {
      try { rmSync(target); } catch (err) { logFs(target, err); }
    }
  } else {
    try {
      const text = readFileSync(target, 'utf8');
      if (/midas:begin|Generated by Midas/i.test(text)) rmSync(target);
    } catch (err) { logFs(target, err); }
  }
  try {
    let dir = dirname(target);
    while (dir && dir !== ctx.target) {
      const base = dir.slice(ctx.target.length + 1).replace(/\\/g, '/');
      if (!MIDAS_EMPTY_DIR_BASES.has(base) && base !== '.claude') break;
      if (readdirSync(dir).length === 0) {
        rmdirSync(dir);
        dir = dirname(dir);
      } else break;
    }
  } catch (err) { logFs(rel, err); }
}

/** Remove Midas-generated adapters for tools not in the active set. */
export function pruneOrphanAdapters(ctx, tools, layout = 'harness') {
  const list = tools || [];
  const windsurfPaths = {
    harness: ['.harness/.windsurf/rules/00-midas.md', '.harness/.windsurf/rules/01-midas-checks.md'],
    classic: ['harness/.windsurf/rules/00-midas.md', 'harness/.windsurf/rules/01-midas-checks.md'],
    compact: ['.midas/.windsurf/rules/00-midas.md', '.midas/.windsurf/rules/01-midas-checks.md'],
    hub: ['.midas/.windsurf/rules/00-midas.md', '.midas/.windsurf/rules/01-midas-checks.md'],
  };
  const windsurfRels = windsurfPaths[layout] || windsurfPaths.harness;
  const legacyWindsurf = ['.windsurf/rules/00-midas.md', '.windsurf/rules/01-midas-checks.md'];
  if (!list.includes('windsurf')) {
    for (const rel of windsurfRels) removeGeneratedFile(ctx, rel);
    for (const rel of legacyWindsurf) removeGeneratedFile(ctx, rel);
  } else {
    for (const rel of legacyWindsurf) removeGeneratedFile(ctx, rel);
  }
  if (!list.includes('gemini')) removeGeneratedFile(ctx, 'GEMINI.md');
  if (!list.includes('cursor')) {
    removeGeneratedFile(ctx, '.cursor/rules/00-midas.mdc');
    removeGeneratedFile(ctx, '.cursor/rules/01-midas-checks.mdc');
  }
  if (!list.includes('claude-code')) removeGeneratedFile(ctx, '.claude/CLAUDE.md');
}

/** @deprecated name kept for grep/tests — use syncSkillMirrors */
export function pruneHostMirrors(ctx, tools) {
  const plan = resolveSkillMirrorPlan(tools);
  if (!plan.claude) {
    removeGeneratedMirror(ctx, '.claude/skills');
    removeGeneratedMirror(ctx, '.claude/agents');
  }
  if (!plan.agents) removeGeneratedMirror(ctx, '.agents/skills');
  if (!plan.cursorSkills) removeGeneratedMirror(ctx, '.cursor/skills');
}
