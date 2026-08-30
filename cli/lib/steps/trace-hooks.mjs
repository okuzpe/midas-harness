// trace-hooks.mjs — seed/merge/strip Cursor hooks for Harness Trace (ADR-011).

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hooksJsonPath, readHooksJson, writeHooksJson, removeHooksJsonIfEmpty } from './cursor-hooks.mjs';

export const TRACE_HOOK_MARKER = 'trace-hook.mjs';

export const TRACE_HOOK_EVENTS = Object.freeze([
  'sessionStart',
  'postToolUse',
  'subagentStop',
  'stop',
]);

/** Install-layout command (cwd = project root). */
export function installTraceHookCommand(event) {
  return `node .harness/scripts/trace-hook.mjs ${event}`;
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function isMidasTraceHookCommand(command) {
  return typeof command === 'string' && command.includes(TRACE_HOOK_MARKER);
}

export { hooksJsonPath };

/**
 * Seed or merge Midas trace hooks. Idempotent. Does not remove non-Midas entries.
 * @param {string} targetDir
 * @returns {{ wrote: boolean, path: string, action: 'seed' | 'merge' | 'noop' }}
 */
export function mergeTraceHooks(targetDir) {
  const path = hooksJsonPath(targetDir);
  mkdirSync(dirname(path), { recursive: true });

  if (!existsSync(path)) {
    const seeded = {
      version: 1,
      hooks: Object.fromEntries(
        TRACE_HOOK_EVENTS.map((ev) => [
          ev,
          [{ command: installTraceHookCommand(ev), timeout: 10 }],
        ]),
      ),
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

  let changed = false;
  for (const ev of TRACE_HOOK_EVENTS) {
    const wanted = installTraceHookCommand(ev);
    const entry = { command: wanted, timeout: 10 };
    const list = Array.isArray(doc.hooks[ev]) ? [...doc.hooks[ev]] : [];
    const midasIdx = list.findIndex((h) => h && isMidasTraceHookCommand(h.command));
    if (midasIdx === -1) {
      list.push(entry);
      doc.hooks[ev] = list;
      changed = true;
    } else if (list[midasIdx].command !== wanted || list[midasIdx].timeout !== 10) {
      list[midasIdx] = { ...list[midasIdx], command: wanted, timeout: 10 };
      doc.hooks[ev] = list;
      changed = true;
    }
  }

  if (!changed) return { wrote: false, path, action: 'noop' };
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { wrote: true, path, action: 'merge' };
}

/**
 * Remove Midas trace-hook entries. Deletes file if no hooks remain.
 * @param {string} targetDir
 * @returns {{ wrote: boolean, removed: boolean, path: string }}
 */
export function stripTraceHooks(targetDir) {
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
    const next = list.filter((h) => !(h && isMidasTraceHookCommand(h.command)));
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
