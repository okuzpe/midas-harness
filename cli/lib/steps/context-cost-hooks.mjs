// context-cost-hooks.mjs — seed/merge/strip Cursor sessionStart context-cost refresh (ADR-012 P2).
// Fail-open: no failClosed on the hook entry.

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const CONTEXT_COST_HOOK_MARKER = 'context-cost-refresh.mjs';

export const CONTEXT_COST_HOOK_EVENTS = Object.freeze(['sessionStart']);

/** Install-layout command (cwd = project root). */
export function installContextCostHookCommand() {
  return `node .harness/scripts/context-cost-refresh.mjs --hook`;
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function isMidasContextCostHookCommand(command) {
  return typeof command === 'string' && command.includes(CONTEXT_COST_HOOK_MARKER);
}

/**
 * @param {string} targetDir
 * @returns {string}
 */
export function hooksJsonPath(targetDir) {
  return join(targetDir, '.cursor', 'hooks.json');
}

/**
 * Seed or merge Midas context-cost sessionStart hook. Idempotent. Preserves Trace/safety/carryover/alien.
 * @param {string} targetDir
 * @returns {{ wrote: boolean, path: string, action: 'seed' | 'merge' | 'noop' }}
 */
export function mergeContextCostHooks(targetDir) {
  const path = hooksJsonPath(targetDir);
  mkdirSync(dirname(path), { recursive: true });
  const wanted = installContextCostHookCommand();
  const entry = { command: wanted, timeout: 10 };

  if (!existsSync(path)) {
    const seeded = {
      version: 1,
      hooks: { sessionStart: [entry] },
    };
    writeFileSync(path, `${JSON.stringify(seeded, null, 2)}\n`, 'utf8');
    return { wrote: true, path, action: 'seed' };
  }

  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    doc = { version: 1, hooks: {} };
  }
  if (!doc || typeof doc !== 'object') doc = { version: 1, hooks: {} };
  if (!doc.hooks || typeof doc.hooks !== 'object') doc.hooks = {};
  if (typeof doc.version !== 'number') doc.version = 1;

  const list = Array.isArray(doc.hooks.sessionStart) ? [...doc.hooks.sessionStart] : [];
  const idx = list.findIndex((h) => h && isMidasContextCostHookCommand(h.command));
  let changed = false;
  if (idx === -1) {
    list.push(entry);
    changed = true;
  } else if (list[idx].command !== wanted || list[idx].timeout !== 10) {
    list[idx] = { ...list[idx], command: wanted, timeout: 10 };
    if ('failClosed' in list[idx]) delete list[idx].failClosed;
    changed = true;
  }
  if (changed) doc.hooks.sessionStart = list;

  if (!changed) return { wrote: false, path, action: 'noop' };
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { wrote: true, path, action: 'merge' };
}

/**
 * Remove Midas context-cost hook entries. Deletes file if no hooks remain.
 * @param {string} targetDir
 * @returns {{ wrote: boolean, removed: boolean, path: string }}
 */
export function stripContextCostHooks(targetDir) {
  const path = hooksJsonPath(targetDir);
  if (!existsSync(path)) return { wrote: false, removed: false, path };

  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { wrote: false, removed: false, path };
  }
  if (!doc?.hooks || typeof doc.hooks !== 'object') {
    return { wrote: false, removed: false, path };
  }

  let changed = false;
  for (const [ev, list] of Object.entries(doc.hooks)) {
    if (!Array.isArray(list)) continue;
    const next = list.filter((h) => !(h && isMidasContextCostHookCommand(h.command)));
    if (next.length !== list.length) {
      changed = true;
      if (next.length) doc.hooks[ev] = next;
      else delete doc.hooks[ev];
    }
  }

  if (!changed) return { wrote: false, removed: false, path };

  const remaining = Object.values(doc.hooks).some((list) => Array.isArray(list) && list.length > 0);
  if (!remaining) {
    unlinkSync(path);
    return { wrote: true, removed: true, path };
  }
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { wrote: true, removed: false, path };
}
