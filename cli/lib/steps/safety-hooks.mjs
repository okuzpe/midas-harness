// safety-hooks.mjs — seed/merge/strip Cursor hooks for Harness Safety gates.

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hooksJsonPath } from './cursor-hooks.mjs';

export const SAFETY_HOOK_MARKER = 'safety/';

export const SAFETY_HOOK_EVENTS = Object.freeze([
  'beforeSubmitPrompt',
  'beforeShellExecution',
]);

/** Install-layout command (cwd = project root). */
export function installSafetyHookCommand(scriptBaseName) {
  return `node .harness/scripts/safety/${scriptBaseName}`;
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function isMidasSafetyHookCommand(command) {
  return (
    typeof command === 'string' &&
    (command.includes(SAFETY_HOOK_MARKER) || command.includes('.harness/scripts/safety/'))
  );
}

/**
 * @param {string} command
 * @returns {string | null}
 */
function safetyScriptBasename(command) {
  if (!isMidasSafetyHookCommand(command)) return null;
  const match = command.match(/safety\/([^/\s]+)$/);
  return match ? match[1] : null;
}

/**
 * @param {string} scriptBaseName
 * @returns {{ command: string, failClosed: true, timeout: number }}
 */
function safetyHookEntry(scriptBaseName) {
  return {
    command: installSafetyHookCommand(scriptBaseName),
    failClosed: true,
    timeout: 10,
  };
}

/** @type {Readonly<Record<string, readonly string[]>>} */
const DESIRED_SAFETY_HOOKS = Object.freeze({
  beforeSubmitPrompt: Object.freeze(['secrets-prompt.mjs']),
  beforeShellExecution: Object.freeze(['gate-commits.mjs', 'destructive-shell.mjs']),
});

export { hooksJsonPath };

/**
 * @param {unknown} entry
 * @param {{ command: string, failClosed: true, timeout: number }} wanted
 * @returns {boolean}
 */
function safetyEntryMatches(entry, wanted) {
  return (
    entry &&
    typeof entry === 'object' &&
    entry.command === wanted.command &&
    entry.failClosed === wanted.failClosed &&
    entry.timeout === wanted.timeout
  );
}

/**
 * Seed or merge Midas safety hooks. Idempotent. Does not remove or alter trace-hook entries.
 * @param {string} targetDir
 * @returns {{ wrote: boolean, path: string, action: 'seed' | 'merge' | 'noop' }}
 */
export function mergeSafetyHooks(targetDir) {
  const path = hooksJsonPath(targetDir);
  mkdirSync(dirname(path), { recursive: true });

  const seededHooks = Object.fromEntries(
    Object.entries(DESIRED_SAFETY_HOOKS).map(([ev, scripts]) => [
      ev,
      scripts.map((scriptBaseName) => safetyHookEntry(scriptBaseName)),
    ]),
  );

  if (!existsSync(path)) {
    const seeded = { version: 1, hooks: seededHooks };
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
  for (const [ev, scripts] of Object.entries(DESIRED_SAFETY_HOOKS)) {
    const list = Array.isArray(doc.hooks[ev]) ? [...doc.hooks[ev]] : [];
    let eventChanged = false;

    for (const scriptBaseName of scripts) {
      const wanted = safetyHookEntry(scriptBaseName);
      const midasIdx = list.findIndex(
        (h) => h && safetyScriptBasename(h.command) === scriptBaseName,
      );
      if (midasIdx === -1) {
        list.push(wanted);
        eventChanged = true;
      } else if (!safetyEntryMatches(list[midasIdx], wanted)) {
        list[midasIdx] = { ...list[midasIdx], ...wanted };
        eventChanged = true;
      }
    }

    if (eventChanged) {
      doc.hooks[ev] = list;
      changed = true;
    }
  }

  if (!changed) return { wrote: false, path, action: 'noop' };
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { wrote: true, path, action: 'merge' };
}

/**
 * Remove Midas safety-hook entries. Deletes file if no hooks remain.
 * @param {string} targetDir
 * @returns {{ wrote: boolean, removed: boolean, path: string }}
 */
export function stripSafetyHooks(targetDir) {
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
    const next = list.filter((h) => !(h && isMidasSafetyHookCommand(h.command)));
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
