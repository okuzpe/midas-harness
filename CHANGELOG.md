# Changelog

All notable changes to Midas are documented in this file.

Format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/).
Versioning follows [SemVer](https://semver.org/) as defined in [`VERSIONING.md`](./VERSIONING.md).

---

## [Unreleased]

### Fixed

- **Phases 4–6** — `choose-architecture`, `define-conventions`, and `plan-sprints` procedure bodies
  use `AskQuestion` (Claude fallback stays in the skill header). Playbooks list
  `{runs}/audits/gate-04.md`…`gate-06.md`. `/midas-design` and `/midas-adopt` match.
- **Phase 1** — playbook asks BLOCKING questions in `AskQuestion` batches (same as the skill);
  `## Contextualized` + `open-questions.md` headings match the skill. Sandbox oracle
  `contextualize.json` added.
- **Phase 1 heading + sandbox oracle** — `contextualize` writes `## Contextualized`; playbook asks in
  batches; `sandbox/oracles/contextualize.json` grades the Phase-1 delta. `idea-intake` requires
  `MIDAS_GATE_RESULT: verdict=pass` on `gate-00.md`.

## [3.0.1] — 2026-08-30

### Fixed

- **3.x docs no longer claim auto-migrate** — `INSTALL.md`, installer outcomes, and SECURITY match
  the refuse contract: `update` refreshes `.harness/` only; 1.x trees pin `create-midas@2.10.x` first.
- Dead `relatedCli()` and `formatMigrateCmd()` removed. Missing-manifest preflight no longer
  suggests `--migrate`. Alias slash skills stay deleted; `/midas-auto-pilot` no longer documents
  forward stubs.
- Sandbox grade ledger (`sandbox/findings/_ledger.jsonl`) is gitignored; curated `*.md` findings stay tracked.
- **Phase 0 playbook vs skill** — `idea-intake` freezes `{runs}/audits/gate-00.md`; playbook heading
  is `## 1-line pitch` (same as the template/oracle); mode confirm uses `AskQuestion`.
- **Sandbox `finish`** — `sandbox-run finish` exits 1 on `no-active-run` (lab is not fail-open) and
  records the last `start-run` in `sandbox/findings/_active-run.json`.
- **Phases 1–3 playbook vs skill** — `contextualize`, `market-research`, and `business-plan` freeze
  `{runs}/audits/gate-01.md`…`gate-03.md`; prompt steps use `AskQuestion` (Claude fallback stays in
  the skill header).

### Tests

- `yaml-lite` parsers covered as unit tests. Template asserts `migrate-layout.mjs` is gone.
  Sandbox start-run/finish and the idea-intake `gate-record` oracle are covered.

## [3.0.0] — 2026-08-30

### Added

- Characterization snapshots under `scripts/test/snapshots/` (adapter hashes, template/plugin
  tree digests, doctor check names, install path contracts) with
  `node scripts/test/snapshots/refresh.mjs`.
- `npm run coverage` — Node built-in `--experimental-test-coverage` over the unit-test list
  (zero extra dependencies). Baseline: `docs/coverage-baseline.md`.

### Fixed

- **Trace snapshots resolve project paths correctly** — `trace-write.mjs` called
  `resolvePaths(layout, root)` with swapped arguments, so `state.snapshot` envelopes recorded
  `{ state: 'error' }` instead of stage/sprint.
- **release-prep docs artifact** — `mkdocs build --strict --site-dir _site` matches the
  uploaded `_site/` path (ADR-016 comment, not ADR-015).
- **CI git-diffs `.claude/` and `.agents/`** after `build-plugin.mjs`, not only the plugin tree.
- **Manual CHECK suffix detection** — `*(manual.)` / trailing `*(manual: …)*` now classify as
  `kind: manual` in `checks.json`.
- **JSON structural tests ignore untracked files** — `git ls-files` only, so a root
  `.audit-output.json` with a BOM can no longer fail the suite.
- Sandbox seed `midas_version` is synced from `harness/VERSION`.
- MkDocs nav includes ADR-012, ADR-013, and ADR-015.
- Dead installer wrappers (`compareVersions` / `hasMidasInstall` / `findAncestorMidasRoot` /
  `pruneHostMirrors`) and unused `renameSync` import removed; autonomy pipeline link depth fixed.
- **Sandbox grade requires phase artifacts, not a `stage` patch** — `idea-intake` lists
  `{product}/idea.md` under `phases.idea_intake.artifacts`; fixture `state.yaml` and
  `updated` must differ from the reset baseline. `/midas-sandbox` grades after **each**
  skill Task. Isolation hashes `harness/skills` and `harness/rules`. `--skill /name`
  normalizes; `--missing skip` ignores only a missing oracle file (invalid JSON still fails).

### Changed

- **BREAKING (3.0):** `role: engine | product` plus `paths:` is the install discriminator
  (ADR-017). 1.x classic/compact/hub trees are **refused** (zero writes); migrate with
  create-midas@2.10.x first (ADR-018). Layout migrators removed; `scripts/lib/migrate-state.mjs`
  kept. Deprecated alias skills `/midas-update`, `/midas-autopilot`, `/midas-auto-sprints`,
  `/midas-improve-loop` deleted. `user-surface` is required; `engine-only` for
  `/midas-precommit` and `/midas-sandbox`.
- Shared cache roots (`scripts/lib/cache-paths.mjs`), YAML parsers (`yaml-lite.mjs`),
  posix/walk helpers, Cursor hook JSON IO (`cli/lib/steps/cursor-hooks.mjs`), and
  CLI `--help` / exit codes (`scripts/lib/cli-io.mjs`). Silent catch blocks in
  skill-mirrors and uninstall now log to stderr. One `detectLegacyLayout` (in
  `cli/lib/core/context.mjs`).
- Installer-critical modules live in `cli/lib/shared/` (npx package). CLI no longer
  imports generated `cli/template/.harness/scripts/`. `scripts/` keeps re-exports;
  `build-create` copies the canonical files into the template.
- Structural tests split into `scripts/test/{json,skills,adapters,version,gates,installer,paths,bundle,runtime}.mjs`.
  Doctor strict profiles live in `scripts/doctor/profiles.mjs`. Installer execute phases
  Doctor health checks live in `scripts/doctor/checks/*.mjs` (registry + profiles).
  `scripts/gates/conformance-gate.mjs` executes `kind: command` CHECKs and writes
  `MIDAS_CONFORMANCE_RESULT` under `{runs}/gates/`.
- Empty v1 path-map exports (`MIGRATION_MAP`, `compactPathsYaml` / `hubPathsYaml`) removed.
  Doctor `layout:consistent` reports `role=` plus the derived layout alias. CI runs a full
  `skill-quality-check` scan. Uninstall drops unused compact/hub remappers; unit tests cover
  1.x refuse with zero writes.

Prior 2.x / 1.x / 0.x history: [docs/changelog-archive/2.x-and-earlier.md](docs/changelog-archive/2.x-and-earlier.md)

[Unreleased]: https://github.com/okuzpe/midas-harness/compare/v3.0.1...HEAD
[3.0.1]: https://github.com/okuzpe/midas-harness/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/okuzpe/midas-harness/compare/v2.10.3...v3.0.0

