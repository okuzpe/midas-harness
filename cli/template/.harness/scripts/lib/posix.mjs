// posix.mjs — path separators and containment for installer relative paths.

import { isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * @param {string} rel
 * @returns {string}
 */
export function toPosixRel(rel) {
  return String(rel || '').replace(/\\/g, '/');
}

/**
 * True when `relPath` has no `..`, empty segments, or absolute/drive prefix.
 * String-only — pair with `resolveContained` before any filesystem write/delete.
 * @param {string} relPath
 * @returns {boolean}
 */
export function isSafeRelPath(relPath) {
  if (!relPath || typeof relPath !== 'string') return false;
  const normalized = toPosixRel(relPath).replace(/\/+$/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return false;
  }
  return !normalized.split('/').some((part) => part === '..' || part === '');
}

/**
 * Resolve `relPath` under `root` and refuse anything that escapes the project.
 * @param {string} root
 * @param {string} relPath
 * @returns {string} absolute path
 */
export function resolveContained(root, relPath) {
  if (!isSafeRelPath(relPath)) {
    throw new Error(`path escapes project: ${relPath}`);
  }
  const base = resolve(root);
  const abs = resolve(base, relPath);
  const rel = relative(base, abs);
  if (!rel || rel.startsWith('..') || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`path escapes project: ${relPath}`);
  }
  return abs;
}
