// ship-manifest.mjs — single source for scripts copied into cli/template/.harness/scripts/.
// build-create.mjs and test.mjs must both consume this list (no parallel FILES / scriptBundleFiles).

/** Relpaths under `scripts/` that ship to the install template (excludes engine-only tooling). */
export const SHIPPED_SCRIPTS = Object.freeze([
  'render-adapters.mjs',
  'yaml-lite.mjs',
  'mcp-drift.mjs',
  'doctor.mjs',
  'status-page.mjs',
  'skill-quality-check.mjs',
  'mcp-cursor-sync.mjs',
  'tool-profiles.mjs',
  'model-profiles.mjs',
  'portable-skills.mjs',
  'gitignore-merge.mjs',
  'paths.mjs',
  'migrate-layout.mjs',
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
  'gates/lib/diff-paths.mjs',
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
