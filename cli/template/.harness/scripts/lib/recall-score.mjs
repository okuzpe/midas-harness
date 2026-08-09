// recall-score.mjs — deterministic snippet scoring for /midas-recall (ADR-003 / F-030).

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

/** Max bytes read per corpus file (~8 KB). */
export const RECALL_CORPUS_MAX_BYTES = 8192;

/** Default excerpt length for CLI output. */
export const RECALL_EXCERPT_CHARS = 240;

/**
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeQuery(query) {
  if (!query || typeof query !== 'string') return [];
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/**
 * Deterministic term-overlap score: count query tokens present in text.
 *
 * @param {string} query
 * @param {string} text
 * @returns {number}
 */
export function scoreSnippet(query, text) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0 || typeof text !== 'string' || text.length === 0) return 0;
  const haystack = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

/**
 * @typedef {{ path: string, text: string, kind?: string, score?: number }} RecallItem
 */

/**
 * Rank corpus items by scoreSnippet; drop zero scores; stable tie-break on path.
 *
 * @param {string} query
 * @param {Array<{ path: string, text: string, kind?: string }>} items
 * @param {{ limit?: number }} [options]
 * @returns {RecallItem[]}
 */
export function rankSnippets(query, items, { limit = 5 } = {}) {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
  return items
    .map((item) => ({
      ...item,
      score: scoreSnippet(query, item.text ?? ''),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, cap);
}

/**
 * @param {string} projectRoot
 * @param {string} rawPath
 * @returns {string}
 */
function resolveCorpusPath(projectRoot, rawPath) {
  const root = resolve(projectRoot);
  if (isAbsolute(rawPath)) return resolve(rawPath);
  return resolve(root, rawPath);
}

/**
 * @param {string} projectRoot
 * @param {string} absPath
 * @returns {string}
 */
function displayPath(projectRoot, absPath) {
  const root = resolve(projectRoot);
  const abs = resolve(absPath);
  if (abs.startsWith(root)) {
    return relative(root, abs).replace(/\\/g, '/');
  }
  return abs.replace(/\\/g, '/');
}

/**
 * Read existing files into a recall corpus. Skips missing paths and read errors.
 *
 * @param {string} projectRoot
 * @param {string[]} paths
 * @returns {Array<{ path: string, text: string }>}
 */
export function collectRecallCorpus(projectRoot, paths) {
  if (!Array.isArray(paths)) return [];
  const root = resolve(projectRoot);
  /** @type {Array<{ path: string, text: string }>} */
  const items = [];

  for (const rawPath of paths) {
    if (typeof rawPath !== 'string' || !rawPath.trim()) continue;
    const absPath = resolveCorpusPath(root, rawPath.trim());
    if (!existsSync(absPath)) continue;
    try {
      const buf = readFileSync(absPath);
      const text = buf.subarray(0, RECALL_CORPUS_MAX_BYTES).toString('utf8');
      items.push({ path: displayPath(root, absPath), text });
    } catch {
      // skip unreadable paths
    }
  }

  return items;
}

/**
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {string}
 */
export function excerptText(text, maxChars = RECALL_EXCERPT_CHARS) {
  if (typeof text !== 'string') return '';
  const cap = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : RECALL_EXCERPT_CHARS;
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= cap) return collapsed;
  return `${collapsed.slice(0, cap).trimEnd()}…`;
}
