import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Runnable sprint statuses (state.schema.md). */
export const RUNNABLE_SPRINT_STATUSES = ['active', 'planned'];

/**
 * Parse `paths.product` from state.yaml (defaults to `.harness/product`).
 * @param {string|null} yaml
 * @returns {string}
 */
export function parsePathsProduct(yaml) {
  if (!yaml) return '.harness/product';
  const pathsBlock = yaml.match(/^paths:\s*[\s\S]*?(?=^[A-Za-z_][\w-]*:\s*$)/m);
  if (!pathsBlock) return '.harness/product';
  const product = pathsBlock[0].match(/^\s+product:\s*(\S+)/m);
  return product ? product[1] : '.harness/product';
}

/**
 * @param {string} yaml
 * @returns {{ id: string, status: string, title: string }[]}
 */
export function listSprints(yaml) {
  const sprints = [];
  let inSprints = false;
  let cur = null;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      if (cur) sprints.push(cur);
      inSprints = /^sprints:/.test(line);
      cur = null;
      continue;
    }
    if (!inSprints) continue;
    const idM = line.match(/^\s*-\s*id:\s*"?([\w.-]+)"?/);
    if (idM) {
      if (cur) sprints.push(cur);
      cur = { id: idM[1], status: '', title: '' };
      continue;
    }
    if (!cur) continue;
    const st = line.match(/^\s+status:\s*"?(\w+)"?/);
    if (st) cur.status = st[1];
    const title = line.match(/^\s+title:\s*"?([^"]+)"?/);
    if (title) cur.title = title[1];
  }
  if (cur) sprints.push(cur);
  return sprints;
}

/**
 * Pick sprint for autonomy: `active` first, else most recent `planned` entry.
 * @param {string} yaml
 */
export function findRunnableSprint(yaml) {
  const sprints = listSprints(yaml);
  const active = sprints.find((s) => s.status === 'active');
  if (active) return active;
  const planned = sprints.filter((s) => s.status === 'planned');
  return planned.length ? planned[planned.length - 1] : null;
}

/** @deprecated alias */
export function findActiveSprint(yaml) {
  return findRunnableSprint(yaml);
}

/**
 * Candidate sprint markdown paths (greenfield + brownfield planning/).
 * @param {string} productRoot absolute
 * @param {string} sprintId
 * @returns {string[]}
 */
export function sprintMarkdownCandidates(productRoot, sprintId) {
  const candidates = [];
  const push = (rel) => {
    const abs = join(productRoot, rel);
    if (!candidates.includes(abs)) candidates.push(abs);
  };

  const sprintsDir = join(productRoot, 'sprints');
  if (existsSync(sprintsDir)) {
    for (const f of readdirSync(sprintsDir).filter((n) => n.endsWith('.md'))) {
      if (f.startsWith(`${sprintId}-`) || f.startsWith(sprintId) || f === `${sprintId}.md`) {
        push(join('sprints', f));
      }
    }
  }

  const planningDir = join(productRoot, 'planning');
  if (existsSync(planningDir)) {
    const planningNames = [`sprint-${sprintId}.md`];
    const numbered = sprintId.match(/^s(\d+)-(.+)$/);
    if (numbered) planningNames.push(`sprint-${numbered[1]}-${numbered[2]}.md`);
    for (const name of planningNames) {
      push(join('planning', name));
    }
    for (const f of readdirSync(planningDir).filter((n) => n.endsWith('.md'))) {
      if (!f.startsWith('sprint-')) continue;
      const stem = f.slice('sprint-'.length, -3);
      if (stem === sprintId.replace(/^s/, '') || stem === sprintId || sprintId.endsWith(stem)) {
        push(join('planning', f));
      }
    }
  }

  return candidates.filter((p) => existsSync(p));
}

/**
 * @param {string} projectRoot
 * @param {string} sprintId
 * @param {string} [productRel]
 * @returns {string|null}
 */
export function resolveSprintMarkdown(projectRoot, sprintId, productRel = '.harness/product') {
  const productRoot = join(projectRoot, productRel);
  const hits = sprintMarkdownCandidates(productRoot, sprintId);
  return hits[0] || null;
}

function slugTask(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'task';
}

/**
 * First unchecked markdown task in the sprint file.
 * @param {string} projectRoot
 * @param {string} sprintId
 * @param {string} [productRel]
 */
export function findNextTask(projectRoot, sprintId, productRel = '.harness/product') {
  const file = resolveSprintMarkdown(projectRoot, sprintId, productRel);
  if (!file) return null;
  const body = readFileSync(file, 'utf8');
  const unchecked = body.match(/^\s*-\s*\[\s*\]\s+(.+)$/m);
  if (unchecked) {
    return { id: slugTask(unchecked[1]), title: unchecked[1].trim(), file };
  }
  return { id: 'task-complete', title: 'no open tasks', file, done: true };
}

/**
 * @param {string} projectRoot
 * @param {string} [stateRel]
 */
export function resolveSprintContext(projectRoot, stateRel = '.harness/state.yaml') {
  const statePath = join(projectRoot, stateRel);
  if (!existsSync(statePath)) {
    return { yaml: null, productRel: '.harness/product', sprint: null };
  }
  const yaml = readFileSync(statePath, 'utf8');
  return {
    yaml,
    productRel: parsePathsProduct(yaml),
    sprint: findRunnableSprint(yaml),
  };
}
