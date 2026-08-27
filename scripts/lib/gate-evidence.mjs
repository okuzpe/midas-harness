// gate-evidence.mjs — resolve gates.json `evidence_required` against layout-aware paths.

import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/**
 * Substitute `{product}` / `{runs}` and map classic `.harness/…` evidence onto `paths.*`.
 * @param {string} pattern
 * @param {{ product?: string, runs?: string, engine?: string, rules?: string, state?: string }} paths
 * @returns {string}
 */
export function resolveEvidencePattern(pattern, paths) {
  const product = String(paths.product || '.harness/product').replace(/\\/g, '/');
  const runs = String(paths.runs || '.harness/runs').replace(/\\/g, '/');
  const engine = String(paths.engine || '.harness/engine').replace(/\\/g, '/');
  const rules = String(paths.rules || '.harness/rules').replace(/\\/g, '/');
  const state = String(paths.state || '.harness/state.yaml').replace(/\\/g, '/');
  let p = String(pattern || '').replace(/\\/g, '/');
  p = p.replaceAll('{product}', product);
  p = p.replaceAll('{runs}', runs);
  if (p === '.harness/state.yaml') return state;
  if (p.startsWith('.harness/engine/')) p = `${engine}/${p.slice('.harness/engine/'.length)}`;
  else if (p.startsWith('.harness/rules/')) p = `${rules}/${p.slice('.harness/rules/'.length)}`;
  return p.replace(/\/{2,}/g, '/');
}

/**
 * Host adapter paths that only apply when that tool is in `state.tools`.
 * @param {string} pattern
 * @returns {string | null} tool id or null
 */
export function hostToolForEvidence(pattern) {
  const p = String(pattern || '').replace(/\\/g, '/');
  if (p.startsWith('.cursor/') || p.includes('/.cursor/')) return 'cursor';
  if (p === 'CLAUDE.md' || p.startsWith('.claude/') || p.endsWith('/CLAUDE.md')) return 'claude-code';
  if (p === 'GEMINI.md' || p.endsWith('/GEMINI.md')) return 'gemini';
  if (p.includes('.windsurf/') || p.startsWith('harness/.windsurf/')) return 'windsurf';
  return null;
}

/**
 * `{runs}/verifications/*` is required only for UI sprints — empty glob is not a miss.
 * @param {string} pattern
 */
export function isOptionalVerificationEvidence(pattern) {
  return /verifications\//.test(String(pattern || ''));
}

/**
 * List files matching a resolved relative pattern (`*` only in the last path segment).
 * @param {string} root
 * @param {string} resolvedPattern
 * @returns {string[]}
 */
export function listEvidenceHits(root, resolvedPattern) {
  const pat = String(resolvedPattern || '').replace(/\\/g, '/');
  if (!pat.includes('*')) {
    return existsSync(join(root, pat)) ? [pat] : [];
  }
  const dir = dirname(pat);
  const filePat = basename(pat);
  const absDir = join(root, dir);
  if (!existsSync(absDir)) return [];
  const re = new RegExp(`^${filePat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`);
  return readdirSync(absDir)
    .filter((name) => re.test(name))
    .map((name) => `${dir}/${name}`.replace(/\\/g, '/'));
}

/**
 * Patterns from `evidence_required` that are missing on disk (after token/layout resolve).
 * Skips host adapters whose tool is not selected, and empty verification globs.
 * @param {string} root
 * @param {object} paths
 * @param {string[]} patterns
 * @param {{ tools?: string[] }} [opts]
 * @returns {string[]} original (unresolved) patterns that miss
 */
export function missingEvidenceRequired(root, paths, patterns, opts = {}) {
  const tools = new Set(opts.tools || []);
  const missing = [];
  for (const pat of patterns || []) {
    const host = hostToolForEvidence(pat);
    if (host && tools.size && !tools.has(host)) continue;
    if (host && !tools.size) continue;
    const resolved = resolveEvidencePattern(pat, paths);
    const hits = listEvidenceHits(root, resolved);
    if (isOptionalVerificationEvidence(pat) && hits.length === 0) continue;
    if (!hits.length) missing.push(pat);
  }
  return missing;
}
