// ship-manifest.mjs — single source for scripts copied into cli/template/.harness/scripts/.
// build-create.mjs and test.mjs must both consume this list (no parallel FILES / scriptBundleFiles).

/**
 * When a `scripts/` path is a re-export, copy this canonical file into the template instead.
 * Dest layout under `.harness/scripts/` still matches `SHIPPED_SCRIPTS` keys.
 */
export const SCRIPT_CANONICAL_SOURCES = Object.freeze({
  'ownership-manifest.mjs': 'cli/lib/shared/ownership-manifest.mjs',
  'mcp-drift.mjs': 'cli/lib/shared/mcp-drift.mjs',
  'model-profiles.mjs': 'cli/lib/shared/model-profiles.mjs',
  'lib/reconcile.mjs': 'cli/lib/shared/lib/reconcile.mjs',
  'lib/walk.mjs': 'cli/lib/shared/lib/walk.mjs',
  'lib/posix.mjs': 'cli/lib/shared/posix.mjs',
});

/**
 * @param {string} rel path under `scripts/`
 * @returns {string} repo-relative canonical source
 */
export function shippedScriptSourcePath(rel) {
  return SCRIPT_CANONICAL_SOURCES[rel] || `scripts/${rel}`;
}

/** Relpaths under `scripts/` that ship to the install template (excludes engine-only tooling). */
export const SHIPPED_SCRIPTS = Object.freeze([
  'render-adapters.mjs',
  'yaml-lite.mjs',
  'mcp-drift.mjs',
  'doctor.mjs',
  'doctor/profiles.mjs',
  'doctor/helpers.mjs',
  'doctor/registry.mjs',
  'doctor/checks/state.mjs',
  'doctor/checks/layout.mjs',
  'doctor/checks/mcp.mjs',
  'doctor/checks/gates.mjs',
  'doctor/checks/registries.mjs',
  'status-page.mjs',
  'skill-quality-check.mjs',
  'mcp-cursor-sync.mjs',
  'tool-profiles.mjs',
  'model-profiles.mjs',
  'portable-skills.mjs',
  'gitignore-merge.mjs',
  'paths.mjs',
  'stage-command-table.mjs',
  'design-system.mjs',
  'bundle.mjs',
  'ownership-manifest.mjs',
  'skill-registry.mjs',
  'trace-write.mjs',
  'trace-inspect.mjs',
  'trace-hook.mjs',
  'lib/trace-models.mjs',
  'lib/trace-store.mjs',
  'lib/commit-receipt.mjs',
  'lib/carryover.mjs',
  'lib/gate-result.mjs',
  'lib/context-cost.mjs',
  'lib/lifecycle-journal.mjs',
  'lib/recall-score.mjs',
  'lib/frontmatter.mjs',
  'lib/walk.mjs',
  'lib/posix.mjs',
  'lib/cache-paths.mjs',
  'lib/cli-io.mjs',
  'lib/reconcile.mjs',
  'lib/migrate-state.mjs',
  'lib/gate-evidence.mjs',
  'lib/context-digest.mjs',
  'lib/close-ready.mjs',
  'lib/capture-candidates.mjs',
  'lib/recall-fifo.mjs',
  'lib/quality-log.mjs',
  'carryover-refresh.mjs',
  'context-cost-refresh.mjs',
  'lifecycle-journal.mjs',
  'recall-rank.mjs',
  'close-ready.mjs',
  'context-digest.mjs',
  'capture-candidates.mjs',
  'quality-log.mjs',
  'commit-receipt.mjs',
  'gates/test-gate.mjs',
  'gates/quality-gate.mjs',
  'gates/conformance-gate.mjs',
  'gates/lib/diff-paths.mjs',
  'gates/lib/conformance-eval.mjs',
  'safety/secrets-prompt.mjs',
  'safety/gate-commits.mjs',
  'safety/destructive-shell.mjs',
  'safety/lib/hook-io.mjs',
]);

/** Repo-relative paths (`scripts/…`) for `cpSync` in build-create. */
export function shippedScriptRepoPaths() {
  return SHIPPED_SCRIPTS.map((rel) => `scripts/${rel}`);
}

/** Sorted relpaths under the template scripts dir (for tree-match assertions). */
export function scriptBundleFiles() {
  return [...SHIPPED_SCRIPTS].sort();
}
