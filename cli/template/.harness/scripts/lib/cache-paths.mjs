// cache-paths.mjs — single helper for engine vs install cache roots.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePaths } from '../paths.mjs';

/**
 * True when volatile cache lives under `.harness/cache` (product install or a
 * tree that already has that directory). Engine classic uses `runs/cache`.
 * @param {string} projectRoot
 * @returns {boolean}
 */
export function useHarnessCache(projectRoot) {
  if (existsSync(join(projectRoot, '.harness'))) return true;
  try {
    return resolvePaths(projectRoot).role === 'product';
  } catch {
    return false;
  }
}

/**
 * @param {string} projectRoot
 * @returns {string} absolute cache root (`.harness/cache` or `runs/cache`)
 */
export function resolveCacheRoot(projectRoot) {
  if (useHarnessCache(projectRoot)) {
    return join(projectRoot, '.harness', 'cache');
  }
  return join(projectRoot, 'runs', 'cache');
}
