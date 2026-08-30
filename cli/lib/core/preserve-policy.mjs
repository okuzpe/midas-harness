// preserve-policy.mjs — shared install preserve / vendor-path rules for plan + execute + conflicts.
// Keep plan-tree dry-run and copyTree write decisions identical.

import { toPosixRel } from '../shared/posix.mjs';

/** User-owned filenames under `.harness/autonomy/` (never overwritten / never hash-checked as vendor). */
export const AUTONOMY_USER_NAMES = Object.freeze([
  'policy.yaml',
  'control.json',
  'budget-ledger.json',
  'journal-anchor.json',
  'authz',
]);

/** Engine + scripts vendor trees refreshed on every install/update. */
export function isEngineScriptsVendorPath(rel) {
  const n = toPosixRel(rel);
  return n.startsWith('.harness/engine/') || n.startsWith('.harness/scripts/');
}

/**
 * Alias used by plan-tree / copyTree — engine+scripts only (autonomy has its own copy path).
 * @param {string} rel
 */
export function isVendorManagedPath(rel) {
  return isEngineScriptsVendorPath(rel);
}

/**
 * Vendor paths for ownership-manifest conflict / stale-drift checks.
 * Includes autonomy vendor code but excludes user-owned autonomy files.
 * @param {string} rel
 */
export function isConflictVendorPath(rel) {
  const n = toPosixRel(rel);
  if (isEngineScriptsVendorPath(n)) return true;
  if (!n.startsWith('.harness/autonomy/')) return false;
  if (n.startsWith('.harness/autonomy/authz/')) return false;
  if (
    n.endsWith('/policy.yaml') ||
    n.endsWith('/control.json') ||
    n.endsWith('/budget-ledger.json') ||
    n.endsWith('/journal-anchor.json')
  ) {
    return false;
  }
  return true;
}

/**
 * Portable `.agents` discovery tree is written by `syncSkillMirrors` for windsurf/gemini/codex/copilot.
 * Copying it from the template then pruning left leftover directories on cursor-only installs
 * (CI `test ! -e .agents`). `.claude` and `.cursor/skills` still copy from the template.
 * @param {string} rel POSIX path relative to project root
 */
export function isHostDiscoveryMirrorPath(rel) {
  const n = toPosixRel(rel);
  return n === '.agents' || n.startsWith('.agents/');
}

/**
 * Paths that must never be overwritten by template copy (even with --force),
 * plus fresh-install host skill mirrors that already exist.
 * @param {string} rel POSIX path relative to project root
 * @param {boolean} update true on --update / migrate refresh
 */
export function alwaysPreservePath(rel, update) {
  const n = toPosixRel(rel);
  return (
    n === '.mcp.json' ||
    n === 'AGENTS.md' ||
    n === '.gitignore' ||
    n === '.harness/state.yaml' ||
    n === '.harness/manifest.json' ||
    n.startsWith('.harness/product/') ||
    n.startsWith('.harness/rules/') ||
    n.startsWith('.harness/runs/') ||
    n.startsWith('.harness/cache/') ||
    n.startsWith('.harness/conflicts/') ||
    n.startsWith('.harness/migrations/') ||
    n === '.harness/autonomy/policy.yaml' ||
    n.startsWith('.harness/autonomy/authz/') ||
    n === '.harness/autonomy/control.json' ||
    n === '.harness/autonomy/budget-ledger.json' ||
    n === '.harness/autonomy/journal-anchor.json' ||
    (!update && (
      n.startsWith('.claude/skills/') ||
      n.startsWith('.claude/agents/') ||
      n.startsWith('.agents/skills/')
    ))
  );
}

/** True when an autonomy tree entry name is user-owned. */
export function isAutonomyUserEntry(name) {
  return AUTONOMY_USER_NAMES.includes(name);
}

/**
 * Shared plan/execute decision for one template file.
 * @param {string} rel
 * @param {{ exists: boolean, force: boolean, update: boolean }} opts
 * @returns {{ action: 'skip'|'write'|'refresh', ownership: 'user'|'generated'|'vendor', preserve: boolean, mustRefreshVendor: boolean }}
 */
export function decideTemplateCopyAction(rel, { exists, force, update }) {
  const mustRefreshVendor = isVendorManagedPath(rel);
  const preserve = alwaysPreservePath(rel, update);
  if (exists && !mustRefreshVendor && (!force || preserve)) {
    return {
      action: 'skip',
      ownership: preserve ? 'user' : 'generated',
      preserve,
      mustRefreshVendor,
    };
  }
  return {
    action: mustRefreshVendor || (exists && force) ? 'refresh' : 'write',
    ownership: mustRefreshVendor ? 'vendor' : 'generated',
    preserve,
    mustRefreshVendor,
  };
}
