// cursor-hooks.mjs — shared .cursor/hooks.json IO for Trace / safety / carryover / context-cost.

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * @param {string} targetDir
 * @returns {string}
 */
export function hooksJsonPath(targetDir) {
  return join(targetDir, '.cursor', 'hooks.json');
}

/**
 * @param {string} targetDir
 * @returns {{ version: number, hooks: Record<string, unknown[]> }}
 */
export function readHooksJson(targetDir) {
  const path = hooksJsonPath(targetDir);
  if (!existsSync(path)) return { version: 1, hooks: {} };
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    if (!doc || typeof doc !== 'object') return { version: 1, hooks: {} };
    if (!doc.hooks || typeof doc.hooks !== 'object') doc.hooks = {};
    if (typeof doc.version !== 'number') doc.version = 1;
    return doc;
  } catch {
    return { version: 1, hooks: {} };
  }
}

/**
 * @param {string} targetDir
 * @param {object} doc
 */
export function writeHooksJson(targetDir, doc) {
  const path = hooksJsonPath(targetDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

/**
 * @param {string} targetDir
 * @returns {boolean} true when the file was removed
 */
export function removeHooksJsonIfEmpty(targetDir) {
  const path = hooksJsonPath(targetDir);
  if (!existsSync(path)) return false;
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return false;
  }
  const hooks = doc?.hooks && typeof doc.hooks === 'object' ? doc.hooks : {};
  const remaining = Object.values(hooks).some((list) => Array.isArray(list) && list.length > 0);
  if (remaining) return false;
  unlinkSync(path);
  return true;
}
