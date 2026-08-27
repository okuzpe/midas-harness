// walk.mjs — shared recursive directory walker for engine scripts (no npm dependency).

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const DEFAULT_EXCLUDE = Object.freeze(['.git', 'node_modules']);

/**
 * Recursively list files under `dir`.
 *
 * @param {string} dir
 * @param {{
 *   exclude?: Iterable<string>,
 *   relativeTo?: string,
 *   maxDepth?: number,
 *   maxFiles?: number,
 *   filter?: (name: string, abs: string) => boolean,
 *   skipDir?: (name: string, abs: string) => boolean,
 * }} [opts]
 * @returns {string[]} absolute paths, or posix-relative paths when `relativeTo` is set
 */
export function walkFiles(dir, opts = {}) {
  const exclude = new Set(opts.exclude ?? DEFAULT_EXCLUDE);
  const relativeTo = opts.relativeTo;
  const maxDepth = opts.maxDepth ?? Infinity;
  const maxFiles = opts.maxFiles ?? Infinity;
  const filter = opts.filter;
  const skipDir = opts.skipDir;
  const out = [];

  function visit(current, depth) {
    if (!existsSync(current) || depth > maxDepth || out.length >= maxFiles) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      if (exclude.has(entry.name)) continue;
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        if (skipDir && skipDir(entry.name, abs)) continue;
        visit(abs, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (filter && !filter(entry.name, abs)) continue;
      out.push(abs);
    }
  }

  visit(dir, 0);
  if (!relativeTo) return out;
  return out
    .map((abs) => relative(relativeTo, abs).replace(/\\/g, '/'))
    .sort();
}
