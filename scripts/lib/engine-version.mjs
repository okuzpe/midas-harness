// engine-version.mjs — canonical engine SemVer (sole hand-edited source: harness/VERSION).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Repo-relative path to the canonical version file. */
export const ENGINE_VERSION_REL = 'harness/VERSION';

/**
 * @param {string} [root] Engine repository root (defaults to parent of `scripts/`).
 * @returns {string | null} Trimmed SemVer, or null when missing.
 */
export function readEngineVersion(root = MODULE_ROOT) {
  const path = join(root, ENGINE_VERSION_REL);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8').trim();
}

/**
 * @param {string} [root]
 * @returns {string}
 */
export function engineVersionPath(root = MODULE_ROOT) {
  return join(root, ENGINE_VERSION_REL);
}
