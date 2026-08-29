# Changelog

All notable changes to Midas are documented in this file.

Format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/).
Versioning follows [SemVer](https://semver.org/) as defined in [`VERSIONING.md`](./VERSIONING.md).

---

## [Unreleased]

## [2.10.1] — 2026-08-30

### Added

- **Sandbox oracles** — `node scripts/sandbox-run.mjs grade --skill <name>` checks fixture
  disk (isolation + per-skill JSON). `--ledger` appends `sandbox/findings/_ledger.jsonl`.
  Tally: `MIDAS_SANDBOX_ORACLE:`.

### Fixed

- **Untracked vendor leftovers stay untracked** — the rewritten ownership manifest records only
  files the bundle actually ships. A leftover under `.harness/engine` or `.harness/scripts` is no
  longer adopted on the first `update` and then deleted on the second.
- **Docs / CI channel publish** — MkDocs `--strict` no longer dies on links to repo-root
  `INSTALL.md` / `CONTRIBUTING.md`. Smoke `update --check` captures exit 0/1/2 instead of treating
  "available" as a failed step. Doctor smoke passes the install directory explicitly.
- **Diagnose and skills speak `update`** — `relatedCli` emits the `update` subcommand; `partial_migrate`
  no longer hardcodes `#v2.9.8 --update`. `/midas-reconcile` and `/midas-init` list `partial_migrate`
  and only run `install-diagnose.mjs` when that file exists.
- **Stable bundle-integrity** — a hash mismatch on `stable` fails the installer report (`ok: false`);
  edge / unpinned main stay advisory.
- **Sandbox isolation (ADR-015)** — `sandbox-run env` fails if lifecycle paths resolve outside
  `sandbox/example-product/`. Default / `--smoke` always reset from `sandbox/seed/` first.
  `env` prints `MIDAS_TRACE_ROOT:` for the Task; `start-run` no longer claims to export that
  env to the subagent.

## [2.10.0] — 2026-08-29

### Added

- **`update` by release channel and content hash (ADR-016)** — CI publishes `edge.json` (every push
  to `main`) and `stable.json` (every `v*` tag) to an orphan `releases` branch, each carrying a
  `tree_sha256` over the bundle's vendor files. `npx … update --check` answers "is there anything
  new?" for a few KB instead of a package download, exiting **0** current / **1** available /
  **2** undetermined. Channel is recorded in `state.channel`; `edge` stays opt-in.
- **`update` is a real subcommand**, with `--check`, `--channel`, `--offline`, and `--manifest-file`.
  `--update` remains a silent alias.
- **Manifest-driven reconciliation** — `planReconcile` diffs the installed manifest × the bundle ×
  the disk, so files and whole directories dropped from the engine are finally removed from
  installed projects. Replaces `pruneStaleVendorTree` and the hardcoded prune lists; `--dry-run` now
  shows the real diff, deletions included.
- **State migrations** — `harness/state-migrations/NNNN-slug.mjs`, applied by id (never by semver
  range, which would never fire on `edge`) and recorded in `state.migrations`.
- **Doctor `update:*` checks** and an `update-preflight` profile run before the update writes.
- **Engine-only `/midas-sandbox`** (ADR-015) — dry-run unmodified skills against
  `sandbox/example-product/` on `composer-2.5` before committing harness changes.
- **ADR-014** — adapter CHECK digest on demand (supersedes ADR-005's inline-digest clause).

### Changed

- **Vendor conflicts are reported, never silently discarded.** `isStaleManifestDrift` and the silent
  manifest re-baseline are gone. The bundle still wins, but your version is copied to
  `.harness/conflicts/<timestamp>/` first — outside the gitignored `.harness/cache/`, which rollback
  scrubs — and the next update refuses until you clear it.
- `.harness/engine/skill-registry.md` is now role `generated`, not `vendor`: it is re-derived per
  install, so including it in the content hash made every fresh install look out of date.
- **`tree_sha256` covers engine + scripts only.** Optional `--autonomy` files stay vendor in the
  ownership list but do not move the published hash, so an autonomy install is not permanently
  "behind" the channel.
- **Untracked files inside a vendor root are left in place** (reported in `--dry-run`, never
  deleted). A vendor file the bundle dropped that you had edited is copied to `.harness/conflicts/`
  before delete.
- **`--check` never re-execs npx.** Exit 1 prints the apply command (`stable` pins `#vX.Y.Z`;
  `edge` pins the published commit and `--channel=edge`).

### Fixed

- The CLI no longer exits via `process.exit()` after a network call, which aborted on a half-closed
  libuv handle on Windows and returned a crash code instead of the real one.
- **Organic routing parallelism** — single-writer, read fan-out, and launch dedup in
  `harness/rules/organic-routing.md` (Gentleman Ch.20).
- **Phase 5 Scope Rule** — 1 consumer = local, 2+ = shared, plus screaming folder names; seed
  `harness/templates/folder-structure.md`.
- **Risk-selected 4R lenses** — security / maintainability / reliability / resilience by diff
  signal in `verification.md`; close-sprint defers to `pipeline/8-audit-adjust.md`.
- **Judge-panel synthesis** — overlapping independent lenses record `confirmed` | `suspect` |
  `escalate` (not a new skill; tribunal stays product-level).
- **Phase-result artifact contract** — `harness/templates/phase-result.md`; passing gates/audits
  must list on-disk artifact paths (`gate-record.md` + `audit-record.md`).
- **Session protocol** — close note (Next + Learned) and rehydrate after compaction
  (`session-continuity.md`).
- **RED before GREEN** — new behaviour gets failing-test evidence before implementation when a
  test runner exists (`testing.md` + Phase 7).
- **Git hygiene** — commit subjects/bodies must not name AI vendors as co-authors or generators.
- **Aging `needs_review`** — rules/playbooks without a fresh `## Amendment` for >180 days surface
  in `/midas-sweep` records (`hygiene.md`).
- **Lite program counter** — `track: lite` is a status/init overlay (not a new stage). Idea+Plan
  writes a thin `{product}/business-plan.md` stub; `{product}/market.md` is optional.
  `/midas-status` and `/midas-recall` print `Track: lite|full` and never recommend
  `/market-research` or `/business-plan` on lite, including leftover `stage: market_research`.
  Init Exit does not use the E0/E1 maturity-table Next. `/plan-sprints`, `/start-sprint`, and
  `/close-sprint` do not hard-stop on missing `market.md`. Fixture: `scripts/fixtures/product-lite/`.

### Changed

- **Adapter CHECK digest on demand (ADR-014)** — Cursor/Windsurf split always-on conventions from
  the Phase-8 CHECK digest (`01-midas-checks`); Gemini points at `checks.json` instead of inlining.
  Context-cost sessionStart metrics are schema v2 (`by_path` + `by_bucket` + adapters sampled).
- **`gates.json` `evidence_required`** is consumed by `gate:phase-artifacts` when a passed phase
  lists no `artifacts:` (tokens `{product}`/`{runs}` resolve via `paths`; host adapters skipped
  unless that tool is selected; verification globs are optional for non-UI sprints).
- **Skill registry** drops the duplicated Trigger/description column (host already injects
  frontmatter). `/midas-help` loads per-option copy from `response-map.md`.
- **`MIDAS_TEST_FAST=1`** skips installer subprocess fixtures in `scripts/test.mjs`.
- **AskQuestion is canonical** in phase skills; Claude Code falls back to `AskUserQuestion`.
- **`user-surface`** declared on every `harness/skills/*/SKILL.md` (primary / internal / deprecated).
- **`/midas-help`** offers `/midas-bundle`; engine-only `/midas-precommit` is named under install confusion, not as a product menu item.
- **`/midas-auto-pilot`** states which hosts can arm Cursor `/loop` vs a documented re-invoke fallback.
- Injected `migrate-layout` rollback messages go to **stdout** so PowerShell does not wrap expected-failure tests as `NativeCommandError`.

### Deferred

- **Split `scripts/test.mjs` by domain** (audit M5 / U7) remains a follow-up PR. `node scripts/test.mjs` stays the single test entry.

### Fixed

- **Pipeline copy** — `/contextualize` (not `/midas-contextualize`) in `idea.md`; phases 2–3
  checklists say six sections; Phase 7 reads product design tokens with engine fallback; lite
  optional design-system in Phase 8 and `/start-sprint`; raw-idea heading unified.
- **One frontmatter parser** (`scripts/lib/frontmatter.mjs`) for portable mirrors, registry, and tests.
- **Precedence box** in `harness/conventions.md` (and `/define-conventions`) now starts with
  project rule overlays (`<paths.rules>/`), matching `docs/context-hierarchy.md`.
- **Skill catalog counts** in `docs/skills.md` match the registry (29 primary / 5 internal /
  4 deprecated). Engine host-mirror sentence follows ADR-008 (no implied root `.cursor/skills`).
  Auto-pilot unify history cites 2.9.5, not Unreleased.
- **Comparison inventories** — `docs/muninn-comparison.md` lists 38 skills, 24 rules, and Cursor
  hooks (not 33 / cero hooks). `docs/gstack-comparison.md` current engine points at
  `harness/VERSION` instead of a stale 2.9.3 pin.
- **GitHub issue #1** is superseded by 2.x: phase-skill `/midas-*` prefixes stay intentional;
  Lite is wired; Memory Lite / `/midas-remember` stays rejected (ADR-003).
- **`/midas-monorepo`** is historical-only — use `/midas-init --monorepo`.

---

## [2.9.9] — 2026-08-10

### Fixed

- **npx package import** — `engine.mjs` / `state-write.mjs` import `mcp-drift` from
  `cli/template/.harness/scripts/` (published under `"files": ["cli"]`), not repo-root
  `scripts/` which is absent in the npx install and crashed `--update` on 2.9.8.

---

## [2.9.8] — 2026-08-10

### Fixed

- **Installer verify fail → `NEEDS_REPAIR` (exit 6)** — post-apply doctor failure no longer throws into
  destructive vendor-only rollback. Promoted `--update` (classic→harness) uses migrate rollback paths;
  backups stay until verify ok. Apply/I/O throw still `ROLLED_BACK` (5) with a full restore.
- **Doctor `--profile=install-verify`** — installer verify uses a reduced strict set (omits
  `rules:combined` / MCP governance+sync as blockers). Human `doctor --strict` stays full.
- **Diagnose `partial_migrate`** — `.harness/product` or state without engine tips `--rollback` or git
  restore + pinned `#v2.9.8+` `--update`.

### Changed

- Brownfield migrate preflight notes shadow MCPs and sets `mcp_governance: self_managed` when missing.
- Migrate apply can retain its tmp backup until verify commits.

---

## [2.9.7] — 2026-08-10

### Fixed

- **Classic→harness migrate** — `legacy-*-amendments.md` now pass through `normalizeMigratedProjectRule` so they include `**CHECK:**` and no longer fail strict `rules:combined` (which aborted `--update` and left a broken rollback on some trees).

---

## [2.9.6] — 2026-08-10

### Added

- **`/midas-hygiene`** — primary product-repo cleanup (path-passes sweep scope `product` + optional lean-review). Not doctor/align.

### Changed

- **`/midas-init`** — single setup/update tip entry via `install-diagnose` (`not_installed` tips install and stops; `version_behind` / `legacy_layout` tip pinned `--update`).
- **`/midas-update`** — deprecated alias → `/midas-init`. Diagnose `nextSlash` → `/midas-init`. Migration: `harness/migrations/hygiene-init-entry.md`; ADR-013 amendment.

---

## [2.9.5] — 2026-08-10

### Changed

- **Unified `/midas-auto-pilot`** — one slash asks Mode (continuous evolve vs ADR-009 sprint checklist vs stop vs sprint status/dry-run), then PR\|code delivery or CLI setup/status/tick. L3: `harness/skills/midas-auto-pilot/sprint-checklist.md`. Aliases `/midas-auto-sprints`, `/midas-autopilot`, `/midas-improve-loop` forward here. CLI `midas-autopilot.mjs` unchanged. See `harness/migrations/auto-pilot-unify.md` and ADR-009 amendment 2026-08-10.
- **Skill UX surfaces (ADR-013)** — frontmatter `user-surface: primary|internal|deprecated`; registry **Surface** column; `/midas-help` lists primary only. Internals (`progress`, `qa`, `diff-gates`, `lean-review`, `sweep`) path-passed by `/start-sprint` / `/close-sprint` / Phase 7 — not Skill-tool invoke. Host skill mirrors omit internal + deprecated. Doc scrub: README / getting-started / methodology / adopt; stage-table `qa_internal`.

---

## [2.9.4] — 2026-08-10

### Fixed

- **`secrets-prompt.mjs` Cursor contract** — `beforeSubmitPrompt` now emits `{ continue: true|false }` (not `permission`), so fail-closed hooks no longer block chat with "returned no output".
- **Ship `secrets-prompt.mjs`** — was excluded by `.gitignore` `*secret*`; now tracked with explicit allow rules so installs receive the script.
- **Doctor** — warns when safety hooks are wired but scripts are missing on disk.

---

## [2.9.3] — 2026-08-09

### Added

- **`harness/VERSION` as sole editable source** — `scripts/lib/engine-version.mjs` + `scripts/sync-version.mjs` propagate mirrors; `npm run sync-version --check` fails CI on drift.
- **`npm run sync-version`** — run automatically at the start of `npm run build`.

### Changed

- **`npm run bump`** — writes only `harness/VERSION`, then sync + build (no duplicated propagation logic).
- **`install.sh` / `install.ps1`** — resolve the npx pin from `harness/VERSION` (local clone or `main` on GitHub); no baked version string in shims.

---

### Added

- **`cli/lib/core/install-cmd.mjs`** — canonical `npx github:okuzpe/midas-harness` strings (`formatInstallCmd`, `formatUpdateCmd`, …); wired into installer, diagnose, and doctor messages.
- **Installer guard** — plain `install` on an existing v2 project whose engine is older than the bundled CLI fails fast with the exact `--update` command.

### Changed

- **`npm run bump`** now also rewrites `scripts/fixtures/product-closed/.harness/state.yaml` (no manual fixture edit per release).
- **`install-diagnose`** uses bundled version for default install hints; version-mismatch path uses `formatUpdateCmd`.

---

### Fixed

- **`npx github:okuzpe/midas-harness#vX.Y.Z`** — root package exposes a single `midas` bin again so npm 11+ no longer fails with `could not determine executable to run` (`midas-autopilot` remains under `.harness/autonomy/` when `--autonomy` is used).
- **Re-install over an existing v2 project** — installer bumps preserved `midas_version` before strict doctor (fixes rollback when state was stale, e.g. 2.6.0 vs engine 2.9.0).
- **`doctor --fix`** — syncs `midas_version` in preserved `state.yaml` to match the engine.
- **Install shims** — `install.sh` / `install.ps1` invoke `npx … midas` explicitly.

---

### Added

- **ADR-012 Muninn adaptations (phased)** — safety hooks, session carryover, diff gate receipts, durable installer resume, and optional P2 observability (see [`docs/adr/ADR-012-muninn-adaptations.md`](./docs/adr/ADR-012-muninn-adaptations.md)).
- **Cursor safety hooks (fail-closed)** — `scripts/safety/{secrets-prompt,gate-commits,destructive-shell}.mjs`; installer merge via `cli/lib/steps/safety-hooks.mjs`; rule `harness/rules/cursor-safety-hooks.md`.
- **Commit receipt** — `scripts/commit-receipt.mjs` + `scripts/lib/commit-receipt.mjs`; diff-bound git write approval for `gate-commits.mjs`.
- **Session carryover** — `carryover-refresh.mjs`, `{paths.cache}/metrics/current-carryover.json`, Cursor `sessionStart` hook; `session-resume-precedence.md` + AGENTS CRITICAL bootstrap.
- **Diff-scoped gate receipts** — `gates/{test,quality}-gate.mjs`, `lib/gate-result.mjs`, `/midas-diff-gates` skill; close-sprint Step 0.5 + `soft-pass.md` rule; doctor `gate:diff-receipts` anti-stale matching.
- **Durable installer** — `install-journal.mjs`, `install-lock.mjs`, `--resume` / `--rollback`; exit codes 2/3/5/6; [`docs/installer-outcomes.md`](./docs/installer-outcomes.md).
- **Optional P2** — context digest/cost metrics, scored recall (`recall-rank.mjs`), lifecycle/quality journals, capture-candidates CLI.
- **Docs** — `docs/context-digest.md` shipped to install template.

### Changed

- **Engine repo layout clarity:** installer folder `create-midas/` → `cli/` (npm package name stays `create-midas`); contributor Trace cache uses root `runs/cache/` (`paths.cache` in `harness/state.yaml`). Product installs keep `.harness/` (ADR-007).
- Doc/ADR follow-through: ADR-010/011 + `harness/research/harness-trace.md` document `{paths.cache}/traces`; INSTALL + hooks README aligned.
- Playbook template rename: `improve-cycle.md` → `auto-pilot-cycle.md` (aligns with `/midas-auto-pilot`).
- `scripts/ship-manifest.mjs` — single shipped-scripts list for `build-create` + `test`.
- Contributor hygiene: skill source-of-truth docs, v2 runs paths, MkDocs ADR-010/011, autonomy anti-typo callouts.
- Installer refactor: shared preserve-policy, durable transaction journal, hook strip on uninstall (trace/safety/carryover/context-cost).
- `SECURITY.md` uses `{runs}/audits/` token (install-generic).
- Skills wired for ADR-012 rituals: `start-sprint`, `close-sprint`, `midas-recall`, `midas-explore`, `midas-verify`, `midas-progress`, `midas-help`, `midas-capture`.

### Removed

- `docs/research/` (TaskPilot fixture) — replaced by `scripts/fixtures/product-closed/`.
- Unused `create-midas/lib/steps/install.mjs` re-export stub; unused exports.
- Engine MVP dogfood evidence and product ledger; committed `runs/cache/**` untracked from index.

---

## [2.8.2] — 2026-08-08

### Changed

- **Autonomy slash rename (compat aliases kept):**
  - Continuous product evolve: `/midas-auto-pilot` (reclaims ≤2.6.0 name; was `/midas-improve-loop` in 2.6.1–2.8.1).
    Asks **PR vs local code** once; evidence at `{runs}/auto-pilot/`; templates `auto-pilot-runbook.md.tmpl` /
    `auto-pilot-journal.md`; branch prefix `midas-auto/`.
  - Sprint checklist guide: `/midas-auto-sprints` (was `/midas-autopilot`).
  - **CLI unchanged:** `midas-autopilot.mjs` / npm bin (ADR-009 controller).
  - Deprecated stubs: `/midas-improve-loop` → auto-pilot; `/midas-autopilot` → auto-sprints.
- PATCH with aliases: old slash names still resolve; installs keep working without MAJOR bump.
- `auto-pilot` added to `RUNS_SUBDIRS` / bundle `FROZEN_RUNS` so journals are inventoried and exportable.

### Added

- [`harness/migrations/auto-pilot-slash-rename.md`](./harness/migrations/auto-pilot-slash-rename.md) — path/slash migration notes for 2.6.x–2.8.1 installs.

---

## [2.8.1] — 2026-08-08

### Fixed

- Installer no longer counts `.cursor/hooks.json` as a vendor "managed file" after Trace hook
  merge (user-owned; ADR-011).

---

## [2.8.0] — 2026-08-08

### Added

- **Harness Trace V2 (ADR-011)** — ship `trace-write` / `trace-inspect` / `trace-hook` (+ lib) to
  `.harness/scripts/` on product installs; Cursor hooks seed/merge to
  `node .harness/scripts/trace-hook.mjs <event>` when `tools` includes `cursor`.
- `create-midas/lib/steps/trace-hooks.mjs` — `mergeTraceHooks` / `stripTraceHooks` (uninstall).
- INSTALL + getting-started Trace how-to; inspect via `node .harness/scripts/trace-inspect.mjs list`.

### Changed

- Trace CLIs use `resolveProjectRootFromScript` (engine `scripts/` and install `.harness/scripts/`).
- INSTALL update examples use `npx -y --package=… midas` (npm multi-bin / Windows).
- ADR-008 / ADR-010 amended for install hooks allowlist and ship path.

---

## [2.7.0] — 2026-08-08

### Added

- **Harness Trace V1 (ADR-010)** — observe-only JSONL under `.harness/cache/traces/`, Cursor hooks (engine dogfood), `npm run trace:write` / `trace:inspect` CLI.
- `/midas-retro` — read-only sprint retrospective freeze to `{runs}/retros/retro-NN.md` (non-advancing).
- `/midas-investigate` — root-cause Iron Law + 3 strikes; freeze `{runs}/investigate/inv-NN.md` + playbook `debug-root-cause.md`.
- `harness/templates/retro-record.md`; `RUNS_SUBDIRS` / bundle freeze include `retros/` (+ `lean/` in bundle freeze).
- `RUNS_SUBDIRS` / bundle freeze also include `investigate/`.
- Structural dogfood locks: `install:update-docs:*`, `dogfood:midas-retro:*`, `dogfood:features:F-00*:passing`,
  `dogfood:retros:retro-0{1,2,3}`.
- `docs/faq.md` — update answer uses `#v{VERSION}` placeholder + rebaseline pointer (no stale `#v2.2.1`).
- `scripts/status-page.mjs` — lists sweeps, retros, lean, and improve-loop journal presence.
- `scripts/doctor.mjs` — advisory `audit:attestation-NN` when a done sprint’s audit is `un-attested` (not `--strict`-blocking).
- INSTALL commit table + README status blurb include retros/lean/improve-loop.
- Bug-fix **regression** CHECK in `harness/rules/testing.md` + Phase-7 step in `7-sprint-execution.md` (gstack `/qa` gap).
- `harness/rules/safety-guardrails.md` — careful / freeze / guard behavioral floor (gstack safety tools).

### Changed

- `INSTALL.md` § **Updating an existing install** — ownership-manifest conflicts + rebaseline contract
  with structural test anchors (`installer:update-stale-manifest-rebaseline`, vendor-conflict).
- `docs/dogfood.md` — engine now dogfoods MVP sprints 01–03 (not TaskPilot-only for Phase 7–8).
- `README.md` — TaskPilot audit/debate links corrected to legacy `.midas/` paths.
- `docs/gstack-comparison.md` — marks bug-regression and careful/freeze/guard as shipped.

---

## [2.6.1] — 2026-08-07

### Added

- `/midas-improve-loop` — clearer name for continuous product improve (replaces `/midas-auto-pilot`).
- `docs/skills.md` § **Autonomy commands** — single table for sprint `tick` vs improve loop vs Cursor `/automate`.

### Changed

- Improve-loop paths: `{runs}/improve-loop/`; templates `improve-loop-runbook.md.tmpl`, `improve-loop-journal.md`.
- `/midas-improve-loop` responses capped at ~6 lines (no mandatory disambiguation banner each run).
- `/midas-autopilot`, `/midas-help`, skill-flows, INSTALL, ADR-009 updated; legacy `{runs}/auto-pilot/` journal migrated on first run.

### Removed

- `/midas-auto-pilot` — renamed to `/midas-improve-loop` (≤2.6.0 alias only in changelog).
- Templates `auto-pilot-improve.md.tmpl`, `auto-pilot-journal.md`.

---

## [2.6.0] — 2026-08-07

### Added

- `/midas-auto-pilot` — continuous **local** improve (validate → tick #1 → arm Cursor `/loop`).
  Optional `cloud` mode emits Cursor Automations draft; `stop` kills the local loop.

### Changed

- Improve-cycle templates renamed: `auto-pilot-improve.md.tmpl`, `auto-pilot-journal.md`;
  journal path `{runs}/auto-pilot/`. Playbook `improve-cycle.md` is local-first.
- `/midas-autopilot`, `/midas-help`, `docs/skills.md`, `skill-flows`, `INSTALL`, ADR-009 cross-links
  disambiguate auto-pilot (local continuous) vs autopilot (ADR-009 CLI).

### Removed

- `/midas-automate` — renamed to `/midas-auto-pilot` (local continuous by default).
- Templates `cursor-automation-improve.md.tmpl`, `automate-journal.md` (replaced by auto-pilot names).

---

## [2.5.5] — 2026-08-07

### Added

- Test `create-template:schema:no-mojibake` guards install template `state.schema.md`.

### Fixed

- CHANGELOG compare links for `v2.5.4`.

---

## [2.5.4] — 2026-08-07

### Fixed

- `harness/state.schema.md`: repair UTF-8 mojibake (`—`, `–`, `≥`, `→`); propagate to install template.

### Added

- Test `schema:no-mojibake` guards `state.schema.md` against encoding corruption.

---

## [2.5.3] — 2026-08-06

### Added

- Mechanical tests: `midas-status` / `midas-recall` must cite `stage-command-table.yaml` (no inlined
  stage tables); lifecycle stage coverage on the canonical stage-command table.

### Changed

- `/midas-help` cites `skill-flows.md` for flow-shape questions (commands still from `skills.md`).

---

## [2.5.2] — 2026-08-06

### Fixed

- Flow-audit handoffs: pipeline skills cite playbooks (phases 2–3, 6–7); `start-sprint` points at
  `7-sprint-execution.md`; Phase-8 fixes re-run `/close-sprint` (not deferred to next `/start-sprint`).
- `midas-status` / `midas-recall` read `stage-command-table.yaml` instead of duplicating stage tables.
- Brownfield adopt recommends optional `/midas-sweep --depth quick`; `skill-flows.md` clarifies automate
  does not auto-invoke `/close-sprint`.

---

## [2.5.1] — 2026-08-06

### Fixed

- `/midas-automate` validate accepts brownfield product ledgers (`features.md`,
  `project-brief.md`, `project-state.md`), not only greenfield `idea.md` /
  `architecture.md` / `features.json`. Template orient paths updated to match.

---

## [2.5.0] — 2026-08-06

### Added

- `/midas-automate` — validate harness + product context and emit a portable Cursor Automation
  draft for continuous improve cycles (discover → one fix/create → verify → PR). Scheduler is
  Cursor’s native `/automate` (Agents Window); complementary to ADR-009 `/midas-autopilot`.
- Templates: `cursor-automation-improve.md.tmpl`, `automate-journal.md`,
  `playbooks/improve-cycle.md` (branch prefix `midas-improve/`; producer ≠ Phase-8 auditor).

### Removed

- `/midas-monorepo` deprecated alias (promised for 2.1.0; overdue). Use `/midas-init --monorepo` only.
- Legacy adapter templates `harness/templates/cursor-rule.mdc.tmpl`,
  `windsurf-rule.md.tmpl`, and `README-legacy-adapters.md` (unused since
  `render-adapters.mjs` owns `00-midas.*` output).

---

## [2.4.0] — 2026-08-06

### Added

- Commit generated `harness/skill-registry.md` (and template copies) so installs resolve
  `<paths.engine>/skill-registry.md`; sync `skill-registry.mjs` into the create-midas template.

### Changed

- **Delegator** means path-readability, not Skill-tool invocation: Phase-7 procedures
  (`midas-progress`, `midas-verify`, `midas-qa`, `midas-lean-review`, `midas-explore`, …) are
  `Delegator: yes` so parents may path-pass their `SKILL.md` for workers to **read**.
  `disable-model-invocation` still blocks auto slash / Skill-tool invoke. `orchestrator-only`
  stays phase gates, install/sync, and high-stakes audits (~13 yes / ~19 orchestrator-only).
- Docs + `midas-{orchestrator,builder,scout}` contracts spell out path-pass ≠ Skill invoke.

### Fixed

- Operator heuristics: catch `Publish draft release`, `Deploy staging`, push/create git tag,
  and smoke-test installer without reintroducing code-task false positives.
- Fail-closed hook coverage for `MIDAS_AUTONOMY_AUTHZ_KEY` env deny.

---

## [2.3.9] — 2026-08-06

### Fixed

- Restore `harness/state.schema.md` — v2.3.8 accidentally flattened the file to one line
  (PowerShell `Set-Content` corruption during the version pin).

---

## [2.3.8] — 2026-08-06

### Fixed

- `midas-autopilot help` no longer throws `ReferenceError` (nested backticks in help text).
- Fail-closed hooks deny `.harness/autonomy/authz/**` and `MIDAS_AUTONOMY_AUTHZ_KEY` inheritance.
- Operator-task heuristics narrowed (fewer false positives on code tasks); added merge/deploy/CI waits.
- `setup` exits 0 with `status: configured` when authz is OK but the sprint is operator-only.

### Changed

- Docs/skill: “no env export” (not “zero secrets”); prefer `[operator]` markers for ambiguous lines.

---

## [2.3.7] — 2026-08-06

### Changed

- `midas-autopilot setup` auto-creates `.harness/autonomy/authz/hmac` when no env key is set —
  no more `MIDAS_AUTONOMY_AUTHZ_KEY=...` dance for local/Cursor use. Env remains an optional override.

---

## [2.3.6] — 2026-08-06

### Fixed

- Operator-task heuristics recognize markdown-wrapped paths (e.g. Confirm `` `%APPDATA%` `` backups).
- Update conflict assessor treats `.harness/autonomy/` vendor files as stale-drift eligible
  (prettier/lint-staged no longer blocks `--update` after harmless formatting).

---

## [2.3.5] — 2026-08-06

### Fixed

- Autopilot no longer queues operator/release checklist items as the next code task
  (markers `[operator]`/`[manual]`/… plus release-runbook heuristics).
- `dry-run` / `setup` return a single `recommendation` (command + why) instead of leaving
  clients to invent A/B/C option walls.
- `setup` grants **time-boxed multi-use** authz by default so pilot tick loops do not hit
  `authz:already_used` after every fake run (`--single-use` still available).

---

## [2.3.4] — 2026-08-05

### Fixed

- Midas gitignore snippet: allow `.harness/autonomy/lib/credentials.mjs` through the `*credential*`
  security pattern so autonomy installs can be committed after `--autonomy`.

---

### Fixed

- Ship `harness/autonomy/lib/credentials.mjs` in releases — it was excluded by the `*credential*` gitignore
  pattern, breaking `midas-autopilot setup` on fresh `--update --autonomy` installs.

---

## [2.3.2] — 2026-08-05

### Added

- `/midas-autopilot` skill — thin guide to bounded autonomy (`setup`, `status`, `dry-run`, human-confirmed `tick`).
- `midas-autopilot setup` — enable bounded policy, grant authz, and `dry-run` in one CLI step.
- Brownfield sprint resolution for autopilot: `{product}/planning/sprint-*.md`, sprint `planned`, `paths.product`.
- Auto repo id for authz from `git remote origin` (`lib/repo-resolve.mjs`).
- `install-diagnose` autonomy hint when `stage: sprint_execution`; `doctor` `autonomy:capability` advisory.
- `.harness/autonomy/authz/` in gitignore snippet (local grants stay out of git).

### Changed

- `--update --autonomy` appends disabled `autonomy:` pointers to existing `state.yaml` when missing.
- `docs/skills.md`, `docs/skill-flows.md`, `/midas-help`, `pilot.md`, and `start-sprint` reference autopilot.

---

## [2.3.1] — 2026-08-05

### Added

- `mcp_governance: self_managed` in `state.yaml` for brownfield installs with pre-wired direct MCP
  servers; `midas-doctor --strict` reports `ok` for shadow MCPs (unpinned package versions still warn).

---

## [2.3.0] — 2026-08-05

### Added

- `/midas-precommit` — engine-only precommit quality gate (overall ≥ 80); `scripts/precommit-eval.mjs`,
  `docs/precommit-gate.md`, `scripts/engine-only.mjs` (skill stripped from template/plugin).
- Engine dogfood artifacts: `product/{idea,architecture,conventions}.md`, `docs/dogfood.md`,
  `docs/contributing-quickstart.md`.
- TaskPilot `examples/taskpilot/V2-PATH-MAP.md` (legacy `.midas/` → v2 `.harness/` map).
- Installer modularization under `create-midas/lib/` (workflow engine, runtime execute, plan/transaction).

### Changed

- `install.sh` / `install.ps1` default to pinned `github:okuzpe/midas-harness#v{VERSION}`; opt into
  mutable `main` via `MIDAS_BLEEDING_EDGE=1` or `MIDAS_INSTALL_REF`.
- `INSTALL.md`, `SECURITY.md`: pin-first install docs; SEC-005 mitigated.
- Autonomy commit/push authz **schema v2**: HMAC via `MIDAS_AUTONOMY_AUTHZ_KEY` (unsigned/v1 grants fail closed).
- `release-prep.yml` extracts CHANGELOG section from `harness/VERSION`.
- CONTRIBUTING / `docs/skills.md`: `harness/skills/` as canonical skill source.
- Portable skill mirrors ship a generated `README.md` marker.

### Fixed

- Autonomy: block synthetic task when sprint file missing; hardened lease acquire/release; consistent
  `journal_path` in tick reconcile paths.
- Installer execute path throws instead of `process.exit` inside `installAutonomyCapability` / tool parsing.
- Doc pin drift (`VERSIONING.md`, `create-midas/README.md`, FAQ update section).

---

## [2.2.1] — 2026-08-05

### Fixed

- `--update` auto-fixes strict doctor failures for stale `routing` / `version` (via `doctor --fix`)
  before rollback — common after cost-profile routing releases.
- Post-update message clarifies CLI update is complete when `verify: ok`; `/midas-update` is not
  required afterward.

### Changed

- `INSTALL.md`, `VERSIONING.md`, `/midas-reconcile`, `/midas-update`: `--update` and
  `/midas-update` documented as **alternatives** (pick one), not a sequence.
- Doctor version mismatch hint cites both `npx … --update` and `/midas-update`.

---

## [2.2.0] — 2026-08-02

### Added

- `/midas-lean-review` — over-engineering delete-list for diffs (stdlib/native/yagni/shrink); complements
  `/close-sprint` and `/midas-sweep`.
- `lean-ladder.md` always-on rule + `{runs}/lean/` evidence subdir.
- `skill-quality-check.mjs` mechanizes tier/model drift, `## Tier & delegation` presence, and
  `docs/skills.md` catalog membership (previously manual CHECKs).
- `cost_profile` overlays (`balanced` / `max_savings` / `max_quality`) on Claude routing; doctor
  reconciles `state.routing` against `resolveCostAwareRouting`.

### Changed

- Skills/agents: `## Tier & delegation` on all lifecycle skills; orchestrator/builder agent pins
  aligned to cost-aware routing.
- `model-routing.md` + `skill-quality.md` CHECKs cite the mechanical script instead of manual-only review.
- Installer (`create-midas/index.mjs`): richer `--update` / tool-profile handling.

---

## [2.1.0] — 2026-08-01

### Added

- `/midas-design` — product-authentic redesign ritual (audit → 3 art directions → human pick →
  spec → optional one-slice implement); freezes `{runs}/design/design-NN.md`.
- `visual-design.md` **Product authenticity** CHECKs (anti–SaaS-template, logo-swap test, product
  evidence above the fold) + richer `design-direction.md` template (metaphor, first viewport).
- `/midas-verify` records a **Product authenticity** section; verification rule requires it on
  marketing/landing UI.

### Changed

- Architecture hygiene (audit quick wins): `VERSIONING.md` rewritten for post-2.0 SemVer; ADR-001 and
  ADR-006 stamped **historical** (superseded by ADR-007/008); engine `harness/state.yaml` declares
  `layout: classic` + `paths` explicitly; CI primary installer smoke asserts cursor-only thin root.
- Version bumps are single-command: `npm run bump -- <X.Y.Z>`. Skills/docs use `#v{VERSION}`
  placeholders; only `INSTALL.md` keeps copy-paste `#v…` pins.
- Docs/CONTRIBUTING/`/midas-align` point maintainers at `npm run bump` (no scattered hand-edits).
- `change-propagation.md` CHECK: engine version publishes must name `npm run bump` (hand-scattered
  pins are a fail).
- `docs/skills.md` is the **canonical** skill catalog + situation→command router (4 buckets).
  `/midas-status` and `/midas-help` cite it instead of maintaining parallel tables. Shipped to
  installs as `<paths.engine>/docs/skills.md`.
- `/define-conventions`, `/start-sprint`, and catalog/router entries route redesign work through
  `/midas-design`.

### Deprecated

- `/midas-monorepo` — use `/midas-init --monorepo`. **Removal targeted for 2.1.0** (alias kept until then).

---

## [2.0.0] — 2026-08-01

First **stable** v2 release. Same engine contract as `2.0.0-rc.5` — canonical `.harness/` layout,
1.x migration path, thin-root Cursor default, skill quality gate, and polished skills. Use
`#v2.0.0` for installs and updates; release candidates remain tagged for history only.

### Added (since v1.1.4)

- Canonical `.harness/` install layout with ownership manifest and `--migrate` / `--update` flows.
- Skill authoring quality gate and `npm run skill-quality` mechanical checker.
- ADR-008 thin-root allowlist; `--update --tools` mirror pruning.

### Changed

- Default install tools: `[cursor]`; Claude Code retains `.claude/skills` + agents.
- Install/update docs and version pins point at `v2.0.0`.

---

## [2.0.0-rc.5] — 2026-08-01

### Added

- Skill authoring quality gate (`docs/skill-quality-gate.md`, `harness/rules/skill-quality.md`).
- Mechanical skill checker: `scripts/skill-quality-check.mjs` (`npm run skill-quality`).

### Changed

- All 28 engine skills polished to the Ship bar (Does/Does-not, When NOT, exit gates, tribunal SoT).
- Install/update docs and version pins point at `v2.0.0-rc.5`.

---

## [2.0.0-rc.4] — 2026-07-29

### Added

- ADR-008 thin-root allowlist: why skills cannot live only under `.harness/`; no junctions.
- Doctor `layout:root-allowlist` and `mirror:cursor-skills` for cursor-only installs.
- `--update --tools=…` rewrites `state.tools` and prunes orphan Midas host mirrors/adapters.

### Changed

- Default install tools are `[cursor]` (thin root). Preset `a` still selects all adapters.
- Cursor-only skills mirror moves to `.cursor/skills/`; portable peers keep `.agents/skills/`
  (anti-double matrix). Claude Code still uses `.claude/skills` + agents.
- Install/update docs and version pins point at `v2.0.0-rc.4`.

---

## [2.0.0-rc.3] — 2026-07-29

### Changed

- Install and `--update` always report `.gitignore` merge status (written / upgraded / up to date).
- `/midas-doctor` documents `gitignore:midas-block` and applies the snippet via `--fix`.
- `/midas-update` exit gate requires `gitignore:midas-block` ok after upgrade.
- `gitignore-merge.mjs` audit notes point at `doctor.mjs --fix`.

---

## [2.0.0-rc.2] — 2026-07-29

### Added

- `scripts/doctor.mjs` checks `gate:phase-*` / `gate:phase-artifacts` and `gate:sprint-continuity`
  (assumption-or-artifacts evidence; active-sprint STM progress when `last_touched` is stale).
- Rule `harness/rules/state-integrity.md` with machine CHECKs backed by doctor.
- Skills `/midas-help` (interactive intent→command) and `/midas-explore` (ad-hoc notes under
  `{runs}/explore/`, session pointer gitignored).
- Explore templates `explore-meta.yaml` / `explore-notes.md`; fixtures for the new doctor gates.
- Docs: `docs/muninn-comparison.md` (muninn-harness gap analysis) wired in MkDocs.

### Changed

- Conciseness pass on the longest operational skills (init, tribunal, verify, define-conventions,
  sweep, choose-architecture, security-audit, qa) without changing gate contracts.
- Gitignore snippet ignores explore session `.active` pointers; explore notes remain commit-able.
- Version pins and install docs point at `v2.0.0-rc.2`.

---

## [2.0.0-rc.1] — 2026-07-26

### Added

- One canonical installed layout under `.harness/`, with explicit paths for engine, scripts, product,
  project rules, runs, cache, migration receipts, state, and ownership manifest.
- Read-only `--migrate` preview and explicit transactional `--migrate --apply` for classic, compact,
  and hub 1.x installs, including staging, SHA-256 verification, rollback, selective movement, and
  preservation reports for unknown application files.
- Ownership roles (`vendor`, `generated`, `user`) used by update, doctor, and uninstall.
- Canonical `harness/skills` and `harness/agents` sources with generated Claude and Agent Skills mirrors.

### Changed

- New installs reject legacy layout flags; `--update` refuses to relocate a 1.x installation.
- `doctor --strict` validates canonical layout, manifest integrity, selected-host mirrors, generated
  registries, routing, version, and legacy Midas artifacts.
- Minimum Node.js version is 22; CI covers Node 22, 24, and 26 plus six hosts on Linux, Windows, and macOS.

---

## [1.1.4] — 2026-07-26

- Fixed package installs for `npx github:okuzpe/midas-harness#v1.1.3` by resolving model profiles from files bundled inside the published package.
- Updated install pins, docs, and release metadata to `v1.1.4`.

## [1.1.3] — 2026-07-26

- Deterministic `checks.json` / `gates.json` now use source digests instead of clock timestamps.
- The installer/template now materialize portable `.agents/skills/` from `.claude/skills`.
- Routing now exposes `openai-mini` with `gpt-5.4-mini` across all tiers, while legacy Claude installs stay compatible.
- Version pins, install commands, and docs were updated to `v1.1.3`.

## [1.1.2] — 2026-07-26

### Added
- **`gitignore:midas-block`** health check in `doctor.mjs` — warns when `.gitignore` lacks the Midas block or security patterns (`harness/rules/security.md`).
- **`auditGitignore()`** in `gitignore-merge.mjs` — read-only audit reused by doctor and tests.
- **`examples/taskpilot/.gitignore`** — Midas block for the worked example.
- **`INSTALL.md` § Git hygiene** — what to commit vs ignore (`{runs}/`, secrets, test output).

### Changed
- **`gitignore-midas.snippet`** — `coverage/`, `test-results/`, `playwright-report/`, `status.html`, `*.midas-bundle.json`.

---

## [1.1.1] — 2026-07-08

### Added
- **`--diagnose`** installer flag and **`/midas-reconcile`** skill — read-only "which command next?" when install vs update vs init is unclear.
- **`harness/templates/audit-checklists.md`** — shared fragments for `/close-sprint`, `/midas-tribunal`, `/midas-security-audit` (ADR-004).
- **`harness/pipeline/monorepo-wiring.md`** — extracted monorepo procedure; `/midas-monorepo` is now a thin alias.

### Fixed
- **`create-midas --diagnose`** — flag parsing ran before `diagnose`/`TARGET` were initialized (TDZ crash).
- **`create-midas` npm pack** — `install-diagnose.mjs` included in published `files`.

### Changed
- Audit skills (`close-sprint`, `midas-tribunal`, `midas-security-audit`) reference shared checklist template.
- **`midas-init`** — monorepo path delegates to `monorepo-wiring.md`.
- **`INSTALL.md`**, **`docs/getting-started.md`** — troubleshooting via `--diagnose` / `/midas-reconcile`.

---

## [1.1.0] — 2026-07-07

### Added
- Agent-driven QA: `agent-browser` CLI, device profiles, Maestro MCP for native mobile, `/midas-qa` ad-hoc skill.

### Changed
- `/midas-verify` scope flags (`web|mobile|api|all`); single `verify-NN.md` record shape.

---

## [1.0.0] — 2026-07-06

### Added
- **Hub layout (ADR-006)** — default install concentrates engine, state, runs, and `product/` under `.midas/`.
- **`paths.product`** in `state.yaml`; **`{product}/`** pipeline token (like `{runs}/`).
- **`migrate-layout.mjs --target=hub`** — moves `product/` and rewrites state artifacts, enforcement paths, and markdown links.
- Hub matrix tests, CI hub smoke, TaskPilot example migrated to hub.

### Changed
- **Breaking:** new installs default to `hub` (was `classic`). Use `--layout=classic` for legacy layout.
- `scripts/paths.mjs` — three-way `detectLayout` (state field authoritative; infers compact vs hub).
- `scripts/bundle.mjs` — canonical remap for hub (`product/` ↔ `.midas/product/`).
- `create-midas` — `applyHubLayout()`, uninstall/purge paths for hub.
- ADR-003 amended for layout-relative LTM paths; ~48 skills/pipeline files use `{product}/`.

### Fixed
- **`create-midas --update`** — `readToolsFromState()` paths arg (0.5.30).

---

## [0.5.30] — 2026-07-06

### Added
- **`/midas-bundle`** — export/import portable JSON for Midas knowledge.
- **Repo audit (phases A–F)** — stage-command-table, acceptance-criteria rule, `/midas-progress`, repo-audit-01.
- **ADRs** — ADR-004, ADR-005.

### Fixed
- **`create-midas --update`** — `readToolsFromState()` paths arg.
- Rules CHECK dedupe; adapter digest Option A; CI `npm run align` job.

---

## [0.5.29] — 2026-07-06

### Added
- **`/midas-align`** — propagation alignment skill: maps what changed → downstream surfaces, runs the verify
  ladder, emits a `MIDAS_ALIGN_RESULT` gap report.
- **`harness/rules/change-propagation.md`** — always-on rule with propagation matrix and CHECKs (sources →
  bundles → versions → docs).
- **`npm run align`** — engine contributor command (`render-adapters` + `verify`).

### Changed
- `CONTRIBUTING`, `docs/skills.md`, `repository-architecture.md`, and PR template reference the align workflow.
- Always-on rules `enforcement-state`, `hygiene`, and `model-routing` use layout-neutral state/doctor paths.

---

## [0.5.28] — 2026-07-04

### Added
- **Compact install layout (ADR-001)** — `--layout=compact` consolidates engine internals under `.midas/`; `scripts/paths.mjs`
  resolves classic vs compact paths; `scripts/migrate-layout.mjs` migrates classic installs with dry-run + `--apply`.
- **Gitignore merge** — `scripts/gitignore-merge.mjs` idempotently merges secrets, `node_modules/`, and volatile paths;
  `doctor --fix` upgrades missing patterns.

### Changed
- Pipeline, rules, and writer skills use `{runs}/` token (substitute from `paths.runs` in state).
- `AGENTS.md` documents layout-aware path resolution; INSTALL documents three-layer model and compact layout.
- CI smoke test for `--layout=compact`.

---

## [0.5.24] — 2026-07-04

### Added
- **Cursor MCP sync** — `scripts/mcp-cursor-sync.mjs` mirrors root `.mcp.json` → `.cursor/mcp.json` on install and
  `doctor --fix` (Cursor does not read root `.mcp.json`). Windows `cmd /c npx` wrap applied to the Cursor path.
- **Tool profiles + install onboarding** — `scripts/tool-profiles.mjs` drives the interactive compatibility matrix,
  presets (`c` = cursor, `s` = cursor,gemini,codex), and per-tool post-install steps.
- **Gemini extension in installs** — `gemini-extension.json` ships in the template and is written when `gemini` is in
  `tools:` (version stamped from `harness/VERSION`).

### Changed
- **Supported tools table** — Cursor, Gemini CLI, Codex, and Copilot documented at **Good** level with what the
  installer actually wires; README / INSTALL / getting-started aligned.
- **`doctor`** — `mcp:cursor-sync` health check when `cursor` is in `tools:`.

---

### Fixed
- **Installer template** — ship `scripts/yaml-lite.mjs` and `scripts/status-page.mjs` in `create-midas/template/` (doctor/render failed on fresh install).
- **CI** — correct `actions/setup-python` SHA in docs job; Windows/Linux installer smoke passes.

---

## [0.5.22] — 2026-07-03

### Added
- **Midas Lite track** (`track: lite` in `state.yaml`) — Idea+Plan → Execute → Audit for prototypes;
  playbook `harness/pipeline/lite.md`; choice during `/midas-init`.
- **Local status dashboard** — `npm run status` generates `status.html` from `state.yaml` + `.harness/*`.
- **Routing presets** — `routing_profile: claude | openai | local-hybrid` (orchestrate stays Claude for gates).
- **Gate artifact templates** — `gate-record`, `audit-record`, `verify-record`, `sweep-record`, `debate-record`.
- **`scripts/yaml-lite.mjs`** — shared YAML helpers for doctor/render/installer.
- **`harness/migrations/`** — migration stub + 1.0 roadmap in `VERSIONING.md`.
- **Brownfield preflight** — `/midas-adopt --preflight` read-only fit report; step-by-step in `docs/getting-started.md`.

### Changed
- **Engine dogfood** — `harness/state.yaml` coherent engine-as-dogfood profile.
- **Phase skills** — `disable-model-invocation: true` + ritual guards on phases 0–6.
- **Schema** — `packages[]`, `captures`/`last_capture`, `track`, `routing_profile` documented.
- **`doctor.mjs`** — `--help`, `--fix` re-checks drift; verify self-inconsistency gate; OpenAI model ids.
- **Installer** — Windows MCP `npx` wrap on `--update`; ancestor install guard aligned; render errors surfaced.
- **CI** — Windows smoke, `--update` smoke, `npm pack` dry-run.
- **Desambiguación** — README/docs clarify this is not Intel MiDaS depth estimation.
- **Design tokens** — canonical path `harness/design-system/` aligned across pipeline, conventions, templates.

### Fixed
- Dead references (`/deep-research`, doctor dry-run mode, `.harness/gates/` path).
- Phase 7 exit gate no longer requires Phase-8-only artifacts.
- `midas-adopt` no longer invokes nested `disable-model-invocation` skills by name.
- Rules CHECKs use `<src-root>/` instead of hardcoded `src/`.
- `package.json` marked `"private": true` to prevent accidental npm publish.

---

## [0.5.21] — 2026-06-30

### Added — Verification / MCP governance
- **Tool traceability:** `harness/templates/sprint-progress.md` § Done records Task · Proof · **Tool**;
  Phase 7 playbook step 2e mirrors the same when checking off tasks.
- **`harness/rules/verification.md`:** rung-4 CHECK requires each verify row to name its tool; documents
  web-browser scope (native mobile is follow-up).
- **`harness/rules/session-continuity.md`:** Phase-8 CHECK that progress § Done names the Tool per
  completed task.
- **Onboarding:** `/midas-init` offers Playwright + Chrome DevTools when the MVP has UI;
  `docs/getting-started.md` § UI verification; clearer comments in `harness/templates/mcp.json.tmpl`.
- **`scripts/mcp-drift.mjs`:** shared `evaluateMcpDeclaredVsWired` + `evaluateSkillMcpRequired` (doctor +
  `test.mjs` fixtures).
- **`scripts/doctor.mjs`:** advisory `mcp:declared-vs-wired` and `mcp:skill-required` reconcile
  `state.yaml → mcp:` and skill frontmatter with `.mcp.json`.
- **`docs/skills.md`:** documents `mcp-required` frontmatter.
- **Tool glossary:** `harness/templates/sprint-progress.md` § Tool column; cross-ref in `verification.md`.
- **`harness/state.schema.md`:** clarifies `mcp:` is declared intent, not proof of wiring.

### Added — Memory, hygiene, and navigation
- **`/midas-recall`** — read-only context pack for resuming mid-phase/sprint work.
- **`/midas-sweep`** — hygiene and dead-flow detection (orphan code, stale docs, `features.json` drift).
- **`harness/rules/hygiene.md`** and **`harness/rules/session-continuity.md`** — always-on CHECKs for
  Phase 8.
- **`harness/research/memory-model.md`** — STM/LTM on disk (ADR-003).
- **ADRs:** [ADR-002](docs/adr/ADR-002-code-intelligence-mcp.md), [ADR-003](docs/adr/ADR-003-project-memory-model.md).

### Added — Docs and examples
- **`docs/gstack-comparison.md`** — gstack vs Midas analysis (Spanish) with MCP improvement notes.
- **`examples/taskpilot/.mcp.json`** — minimal wired MCP config for the example project.
- **`docs/repository-architecture.md`:** MCP bundle vs `mcp.json.tmpl` note; `mcp-drift.mjs` in checks table.
- **`/midas-doctor` skill:** health table synced with `doctor.mjs` output.

---

## [0.5.20] — 2026-06-29

### Changed — Context7 is free-tier only (no API key, ever)
- Removed every `CONTEXT7_API_KEY` reference. The `.mcp.json` template (`harness/templates/mcp.json.tmpl`)
  no longer carries an `Authorization` header — Context7 wires on its **free anonymous tier**.
- `/midas-init` no longer asks for a Context7 "mode" or an API-key env-var name; the secrets step now only
  covers tokens that genuinely need one (e.g. the optional GitHub MCP's `GITHUB_TOKEN`).
- `/midas-doctor` no longer recommends setting a key on rate-limit; it points to the web-fetch / editor-docs
  fallback. If Context7 ever stops being free, the guidance is to **drop it** and use a doc fallback.
- Docs updated: `README.md`, `docs/faq.md`.

---

## [0.5.19] — 2026-06-29

### Added — Cursor install support + tool selection at install time
- **`--tools` flag** on `create-midas` — comma-separated list (`cursor`, `claude-code,cursor`, …) or an
  interactive prompt when stdin is a TTY. Non-interactive installs (`curl | bash`) default to all adapter
  tools. Ignored on `--update` (existing `harness/state.yaml` is preserved).
- **Tool-aware adapter render** — `scripts/render-adapters.mjs` reads `harness/state.yaml -> tools:` and
  emits only the selected adapters (default: all four when `tools:` is absent, so the engine repo and CI
  are unchanged). Cursor installs rely on native `.claude/skills/` discovery plus `.cursor/rules/`.
- Docs updated in `README.md`, `INSTALL.md`, and `docs/getting-started.md`.

### Added — `.gitignore` merge on install
- Installer appends a marked Midas block from `harness/templates/gitignore-midas.snippet` (idempotent;
  never clobbers an existing `.gitignore`). Covers `.env`, `*.pem`, `*secret*`, `*credential*`,
  `.harness/cache/`, `.harness/*.hash` per `harness/state.schema.md` and `harness/rules/security.md`.
- Engine `.gitignore` aligned to pass the security rule grep CHECK.

### Added — Visual design fundamentals rule
- New always-on [`harness/rules/visual-design.md`](harness/rules/visual-design.md) — hierarchy (one
  primary CTA per view, heading order), typography discipline (max 2 families, token scale), spacing
  intent, emphasis/colour restraint, and lightweight UX (F/Z layout intent, empty/loading/error states).
  Delegates contrast/focus/containment to `accessibility.md` (no duplicate CHECKs).
- `harness/conventions.md` — Design system section points at `visual-design.md`, `accessibility.md`,
  and `components.md`.

### Changed — `--update` runs verify automatically
- After refresh + adapter render, the installer runs `node scripts/doctor.mjs` on the project (auto `--fix`
  once on adapter drift, then re-check). Reports `verify: ok` or exits non-zero — no separate doctor step.

---

## [0.5.18] — 2026-06-27

### Fixed — `--update` no longer clobbers your `.mcp.json`
`.mcp.json` is user-owned config (which MCP servers you wire — Context7, GitHub, …), but the installer
treated it as an engine file and **overwrote it on every `--update`/`--force`**, silently destroying any
Context7/GitHub/etc. wiring and reverting to the bare template. It is now **preserved like
`harness/state.yaml`**: `copyTree` never clobbers an existing `.mcp.json` (a fresh install still creates
one). The `--update` report and `INSTALL.md` now list `.mcp.json` among the preserved files.

Verified: a customized `.mcp.json` survives both `--update` and `--force`; a fresh install still writes
one; CI smoke test (`test -f .mcp.json`) unaffected.

---

## [0.5.17] — 2026-06-26

### Fixed — installer refuses the two install footguns
A `--update` run in the wrong directory used to silently scaffold a brand-new, **nested duplicate**
Midas install instead of failing. Two pre-flight guards in `create-midas/index.mjs` close this:
- **`--update` requires an existing install at the target** — if there is no `harness/VERSION` /
  `harness/state.yaml` there, it refuses with a clear message and writes nothing (was: scaffolded a
  fresh install in place).
- **A fresh install inside an existing Midas project is refused** — if any ancestor directory already
  holds a Midas install, it stops rather than creating a nested, duplicate harness. Override with
  `--force` (or use `/midas-monorepo`) when a nested install is genuinely intended.

Both exit before writing anything. Verified: refusal on no-install `--update`, refusal on nested fresh
install (target left empty), happy-path clean install unaffected, and `--force` override works.

---

## [0.5.16] — 2026-06-26

### Added — local-first hybrid execution + a machine-checkable feature spec
Midas can now drive the high-volume build/scout work on a **local open-weight model** (consumer GPU /
Apple Silicon) while keeping the irreversible think/audit decisions on Claude — and tracks app features
in a machine-checkable ledger so long local runs stay correct. Grounded in a verified deep-research pass
(harness scaffolding matters more than model choice; 24GB fits a ~30B MoE coder; local models are
weakest at exactly the planning/audit work the orchestrate tier owns).

**A second routing axis — *where* each tier runs (`execution_mode`).**
- `harness/state.yaml` gains `execution_mode` (`cloud` | `hybrid` | `local`, default `cloud` — **no
  behavior change**) plus a `local_model` block, orthogonal to `cost_profile`. New section + CHECK in
  `harness/rules/model-routing.md`: `orchestrate` (Phase 1/3/4/8 gate verdicts, code/security review)
  **always** runs on Claude cloud; `scout`/`build` may run local; under `local` an unverified verdict is
  recorded `un-attested` (advisory, never gate-advancing).
- `docs/agents-and-models.md` gains a mode→placement table and an honest 8/16/24 GB consumer-hardware
  fit table (24GB sweet spot ≈ a 30B MoE coder at Q4_K_M; llama.cpp/Ollama, not vLLM), hedged as
  approximate/mid-2026.

**A machine-checkable feature spec (`product/features.json`).**
- New `harness/templates/features.json.tmpl`: a JSON ledger (one entry per MVP feature, each
  `failing`→`passing`); agents flip **only** `status`/`evidence`, never the spec fields. New "spec
  ledger" rung + CHECK in `harness/rules/verification.md`: a `passing` feature with empty `evidence`
  (or a shipped behaviour with no entry) is a Phase-8 fail.

**A per-task incremental loop (Phase 7).**
- `harness/pipeline/7-sprint-execution.md` now mandates one-feature-at-a-time with a
  `.harness/sprints/NN-progress.md` continuity log, and flips `features.json` on task completion —
  directly mitigating local models' short usable context (the "context cliff").

### Changed
- Version single-sourced to `0.5.16` (`harness/VERSION` + all mirrors).

---

## [0.5.15] — 2026-06-22

### Added — a closed verify→fix loop + a runtime-inspection ("Chromium") browser tier
The harness now proves the code it writes actually *runs*, not just that it *reads* — and does it after
every task, not only at sprint close.

**A codified verification ladder (new always-on rule).**
- New `harness/rules/verification.md`: a cost-ordered ladder the Phase-8 audit grades — static
  (typecheck/lint/build) → behavioural tests → runtime smoke → browser drive+inspect (UI) → independent
  review. Each rung carries a `**CHECK:**`; "cheapest tool that proves the claim" governs. Auto-rendered
  into the Cursor/Windsurf/Gemini adapters via `readRulesDigest` (no registration needed).

**A per-task verify→fix inner loop (Phase 7).**
- `pipeline/7-sprint-execution.md` now runs the ladder for each task and re-runs until green *before*
  the task is checked off (bounded self-fix rounds, then surface to the human — recommend-don't-wall).
  The producer self-checks the cheap rungs; the **independent** verdict stays the Phase-8 audit.

**Runtime inspection added to `/midas-verify` (drive + inspect).**
- Playwright still *drives* the flows; **Chrome DevTools MCP** (`chrome-devtools-mcp`) now *inspects*
  runtime health — uncaught console errors, failed happy-path network requests, Core Web Vitals — as
  first-class fails. The verify record gains a **Runtime health** table and a `runtime_errors=` field on
  the `MIDAS_VERIFY_RESULT` tally line. Falls back to Playwright's console/network capture if absent.

### Fixed
- `harness/templates/mcp.json.tmpl` wired Playwright as `@modelcontextprotocol/server-playwright`, a
  package that does **not exist** on npm — corrected to `@playwright/mcp`. Added an optional, cost-noted
  `chrome-devtools-mcp` block.

### Engine
- Version single-sourced to `0.5.15` (`harness/VERSION` + all mirrors).
- `conventions.md` gains a one-line Verification principle (renders to all adapters); `testing.md`
  E2E CHECK now also requires no console/network errors on the happy path; the `examples/taskpilot`
  gold path ships a worked `verify-01.md` (runtime-health table + `runtime_errors=0` tally line).

---

## [0.5.14] — 2026-06-20

### Fixed — two self-audits hardened (cost-aware routing + the stack-rule/best-practices layer)
Two multi-agent audits asked whether Midas (a) applies the best tech-stack practices and (b) routes the
cheapest-fitting model per task. Both were well-modelled but under-enforced; these fixes turn intent into
**checked invariants**, in-discipline (extend existing files, recommend-don't-wall, every floor item ships a CHECK).

**Cost-aware model routing — configured → enforced.**
- New always-on `harness/rules/model-routing.md`: the tier doctrine, a *provenance-by-delegation* CHECK for
  high-stakes audits, `harness-tier` clarified as the dispatch tier only, and honest profile semantics (only
  `balanced` is executor-backed; `max_savings`/`max_quality` are intent).
- `doctor.mjs` now reconciles `state.yaml -> routing` against the three first-party agent pins (warns on an
  unknown id or a balanced-profile mismatch); `test.mjs` enforces the same on the example. Was inert data.
- The routing intent is inlined into `conventions.md` so it reaches the Cursor/Windsurf/Gemini adapters, plus
  a *Token economy* section (prompt-cache the stable corpus, Batch API for fan-outs, thinking budgets).

**Stack-specific best practices — generated, provenanced, enforced.**
- New `harness/templates/stack-rule.md` (uniform shape, mandatory `docs: <lib>@<version>` provenance, lint-form);
  `/define-conventions` now requires the framework's canonical idiom + lint set, stamps provenance, and fails a
  thin generation or an inert language-specific floor grep.
- New `harness/rules/enforcement-state.md`: Phase 5 records an `enforcement:` block (config + installed?) so a
  declined recommend-don't-wall install is auditable; `doctor.mjs` warns on a named-but-missing config.
- `render-adapters.mjs` now inlines every rule's CHECK digest into the non-Claude adapters and folds rule
  content into the drift hash (stack rules finally reach Cursor/Windsurf/Gemini).
- Per-sprint SCA CHECK in `security.md` (catch a CVE/EOL against an already-pinned version); playbooks gain a
  `Trigger` field and `close-sprint` fails a diff that matched a trigger but bypassed the playbook.
- The `examples/taskpilot` gold path is un-elided: it now ships the generated stack rules
  (`folder-structure`/`tenant-isolation`/`session-cookies`), `product/conventions.md`, the lint/hook/CI
  enforcement configs + `enforcement:` block, and a `bump-dependency` playbook.

### Engine
- Version single-sourced to `0.5.14` (`harness/VERSION` + all mirrors).

---

## [0.5.13] — 2026-06-19

### Fixed — two real gaps found running Midas on a real project (investigated + web-researched)
A user ran the full flow on a real product and reported two regrets. A 4-agent investigation (2 source
audits + 2 web-research threads, 2026 best practices) confirmed both as real gaps; fixes stay in-discipline
(extend existing files, recommend-don't-wall, every floor item ships a CHECK, skill+guide kept in sync).

**1. Phase 4 chose the architecture *pattern* silently (the "login-inside-Next, never asked" regret).**
v0.5.9 made Phase 4 ask *which framework per layer*, but never surfaced the **macro-pattern forks** — the
shape-of-the-system decisions a founder must own. `/choose-architecture` now enumerates them in Step 1 and
asks them **first** in Step 3, in plain founder-facing language:
- **App shape** — one full-stack codebase vs decoupled frontend + backend API (speed-now vs split-later/control).
- **Auth strategy** — framework-native/SDK (you own it, coupled) vs a dedicated provider/auth-API (portable,
  SSO/SCIM) vs a BFF holding tokens server-side.
- **Vendor lock-in** — how coupled to one platform/BaaS/IDaaS, and the migration cost.
Each fork gets its own ADR; the exit gate verifies it was *surfaced to the human*, not buried in alternatives.
The 2026 *monolith-first + built-in auth* default is still recommended — but the fork is now asked, not assumed.
(`choose-architecture` SKILL + `pipeline/4-tech-architecture.md` updated together.)

**2. No layout/containment system — buttons/inputs overflowed their parents.** The design system had tokens
+ a11y but nothing governing how elements fit together. Added, with the highest-leverage move first (make
safe behaviour the **default**):
- **`tokens.css` base reset** now ships the containment defaults: media `max-width:100%`, a `.ds-min-0`
  utility for shrinkable flex/grid children (the #1 non-obvious overflow cause: children default to
  `min-width:auto`), `overflow-wrap` on prose, a `.ds-container` measure cap, and a `.ds-truncate` trio.
- **Layout tokens** added to `tokens.css` + `tokens.json` (in sync): shared control heights
  (`--ds-size-control-sm/md/lg`), container/measure widths (`--ds-width-prose/form/...`), named breakpoints.
- **`components.md`** gains a "Containment & sizing" cross-cutting rule + a shared `Height` token on
  Button/Input so adjacent controls align.
- **`harness/rules/accessibility.md`** (the always-on floor) gains a "Layout & containment (no overflow)"
  subsection — 8 CHECK lines (border-box, media max-width, `min-width:0`, ellipsis trio, container cap,
  consistent control heights, **no horizontal scrollbar at 320–375px**, z-index-from-tokens).
- **`/midas-verify`** now asserts `scrollWidth <= clientWidth` at a narrow viewport — the deterministic
  detector for the overflow regression — with a matching exit-gate bullet.

### Engine
- Version single-sourced to `0.5.13` (`harness/VERSION` + all mirrors).

---

## [0.5.12] — 2026-06-18

### Added — `/midas-capture` + an always-on "capture recurring patterns" loop
When you ask for the same thing repeatedly, that preference should become part of the project's standards,
not live in chat. New behavior + skill, *recommend-don't-wall*:

- **Always-on detection (in `AGENTS.md`):** across any phase, when the user asks for the same thing ~2-3×
  (or corrects the agent the same way), the agent **pauses and proposes** codifying it — it asks first,
  never writes silently.
- **`/midas-capture`** (new skill) does the codification via a **rubric** that answers "rule or skill?":
  a **constraint/preference** → a **rule** (`harness/rules/*`, with a `**CHECK:**`, re-rendered + linter-
  enforced); a **procedure** → a **playbook** (`product/playbooks/*`); a **prose preference** →
  `product/conventions.md`. A per-project pattern is a rule/playbook/convention — **not** a new
  slash-command. It amends an existing artifact over creating a near-duplicate, and logs the capture.
- Captures land in the **visible project artifacts you review in git** — consistent with Midas's
  *no hidden memory / no runtime* rule. Gated (`disable-model-invocation`), user-typed; also invokable manually.

Wired into the never-auto-invoke list (AGENTS.md + template + orchestrator) and `docs/skills.md`.

### Engine
- Version single-sourced to `0.5.12` (`harness/VERSION` + all mirrors).

---

## [0.5.11] — 2026-06-18

### Added — Phase 5 now scaffolds the enforcement tooling (makes the CHECKs real on every commit)
The rules referenced linters in their CHECKs (`eslint max-lines-per-function`, `gitleaks`…) — but Midas
never actually set up a linter, hooks, or CI. So the CHECK assumed a mechanism the project never had; it
was only graded by hand at Phase 8 (or never). New **Step 5** in `/define-conventions` closes the loop,
*recommend-don't-wall*:

- Generates the **stack-standard linter + formatter** (ESLint+Prettier / Biome / Ruff) **wired to the
  rules** — not a generic preset; where a `harness/rules/*` item maps to a lint rule, the config is its
  machine-readable form.
- Adds **git hooks** (Husky / lefthook / pre-commit) + **lint-staged** (lint+format on the staged diff),
  **commit-msg lint** aligned with `git-commits.md`, and a **CI lint job**.
- **Generates the configs first, shows them, then asks** (`AskUserQuestion`) whether to install — on yes,
  runs the install; on no, leaves the configs and prints the exact command. Only the install is gated;
  nothing is ever a hard dependency. Each tool Context7-verified at its current version.

Turns each rule's CHECK from "someone grades it at Phase 8" into "blocked at every commit". The skill exit
gate and the `harness/pipeline/5-architecture-rules.md` guide were updated together (no skill-vs-guide drift).

### Engine
- Version single-sourced to `0.5.11` (`harness/VERSION` + all mirrors).

---

## [0.5.10] — 2026-06-18

### Added — `/midas-security-audit`: a deep, standard-grounded security audit
A dedicated security audit skill (the security analog of `/midas-tribunal`), grounded in what the market
actually treats as the standard in 2026 — not vibes:

- **OWASP ASVS 5.0** (2025) as the verification checklist, at the **L1/L2/L3** level recommended from the
  product's data sensitivity (`--level` overrides; recommend-don't-wall).
- **OWASP Top 10** risk lenses, plus the **OWASP LLM Top 10 (2025) + Agentic AI Top 10** added
  automatically when the product is AI-bearing (prompt injection, system-prompt leakage, RAG poisoning,
  excessive agency, …).
- **STRIDE** threat-models the architecture's trust boundaries.
- **Runs the tools that exist, recommends the ones that don't** (no hard dependency): Semgrep (SAST),
  `npm/pnpm/pip audit` (SCA / dependency CVEs), `gitleaks` (secrets). Current usage fetched via Context7.
- Prefers an installed specialist (`voltagent-qa-sec:security-auditor` / `penetration-tester`, Anthropic
  `/security-review`); otherwise the first-party tiers.
- Freezes a ranked, evidence-cited report to `.harness/security/security-NN.md` with a gate-parseable
  `MIDAS_SECURITY_RESULT` tally; proposes a findings→action bridge. **Non-advancing** — it informs;
  `/close-sprint` and the human decide. Gated (`disable-model-invocation`), user-typed.

Complements (does not replace) the always-on `harness/rules/security.md` floor and the `/midas-tribunal
security` debate lens. Wired into the schema (`last_security` pointer), the never-auto-invoke list, the
README Advanced track, and `docs/skills.md`.

### Engine
- Version single-sourced to `0.5.10` (`harness/VERSION` + all mirrors).

---

## [0.5.9] — 2026-06-18

### Changed — Phase 4 now recommends the industry standard and lets the user choose the stack
`/choose-architecture` already proposed 2–3 candidates per layer and documented alternatives in the ADRs —
but the agent **decided** and the human only signed off *passively* at the gate. That made the stack the one
irreversible decision Midas never actively put to the user (market-research, business-plan, and design-direction
all ask). New **Step 3** closes it, in the *recommend-don't-wall* shape:

- For each consequential layer, name the **current industry-standard default for this kind of product** —
  what teams actually reach for today, grounded in current docs (Context7 / the library's own site), not
  memory — with a one-line *why it's the default*.
- **Ask the user via `AskUserQuestion`** which they want, recommended option marked, each with a short
  trade-off. **No preference → the recommendation stands** (never a block); an **override** is the user's
  call and is recorded in that decision's ADR as a human decision. Only the chosen options get version-pinned.
- Scoped to the **few decisions that matter** — no quizzing on every minor library.
- The Phase-4 exit gate and the `harness/pipeline/4-tech-architecture.md` guide were updated to match (no
  skill-vs-guide drift).

### Engine
- Version single-sourced to `0.5.9` (`harness/VERSION` + all mirrors).

---

## [0.5.8] — 2026-06-18

### Fixed — internal-alignment audit (6 real consistency gaps, all pre-existing)
A whole-harness alignment audit (4 parallel auditors over state-machine / rules↔audit / distribution /
docs↔reality) found six places where the harness contradicted itself. Distribution came back clean; the
rest are fixed here:

- **`product/conventions.md` was mandated everywhere but written nowhere** (the big one). The Phase-5
  pipeline guide, the exit gate, and the precedence chain in ~22 files all treat `product/conventions.md`
  as a real override layer — but the operative `/define-conventions` skill never created it. The skill now
  writes it (stack-specific prose overrides of `harness/conventions.md`) and gates on it.
- **`/midas-status` now names the real commands for Phases 2–3.** It was emitting vague phrases
  ("the market-research phase") instead of `/market-research` and `/business-plan`, contradicting its own
  "map to exactly one typeable command" contract. `/contextualize`'s hand-off was reworded to match.
- **`/midas-update` added to the never-auto-invoke list** (AGENTS.md + the template + the orchestrator
  agent). It is side-effecting and `disable-model-invocation: true` like the other nine, but was missing
  from the enumeration — exactly the omission that lets an agent try to auto-run a gated ritual.
- **`last_tribunal` / `last_verification` are now documented in `state.schema.md`.** `/midas-tribunal` and
  `/midas-verify` told the consumer to set them "per schema", but the schema only defined `last_audit`.
- **`/close-sprint` now loads the artifacts its rule CHECKs grade against** — `product/architecture.md`,
  `product/idea.md`, and `product/conventions.md` (the code-quality/testing/security/naming CHECKs cite
  module boundaries + the glossary, which weren't in the load list).
- **README Gemini row corrected** from "via extensions" to "context only (no skills)" — the
  `gemini-extension.json` manifest is repo-only (not in the installer's file set), so an installed project
  gets the `GEMINI.md` context adapter, not skills.

### Engine
- Version single-sourced to `0.5.8` (`harness/VERSION` + all mirrors).

---

## [0.5.7] — 2026-06-18

"Make design real." Design output kept coming out generic. The fix isn't a magic agent — it's a
**concrete anchor wired into the phases that build and audit the UI**, plus a **floor the audit
actually grades**. All faithful to Midas's *recommend-don't-wall* discipline.

### Added
- **`harness/rules/accessibility.md` — a frozen, CHECK-bearing accessibility & design floor** (always-on,
  replaces soft prose). The Phase-8 audit now grades WCAG 2.1 AA contrast, visible focus, reduced-motion,
  text alternatives, target size, and **design-system fidelity** (no hardcoded colour/spacing in component
  code; the UI traces to the named references) — each with a concrete portable `**CHECK:**`, like
  `testing.md`. Scoped: headless/backend-only projects mark each CHECK `N/A (no UI)`. `/close-sprint`
  already audits every `harness/rules/*`, so it's picked up automatically.

### Changed
- **The design-direction is now a real gate with a conscious default.** `/define-conventions` still asks the
  human for ≥2 real reference products first. But an AI-only founder with no design taste no longer falls back
  to bland "Tailwind-default": the agent **proposes ≥2 concrete, named, domain-appropriate references itself**,
  records them in `product/design-direction.md` marked **`assumed (confirm)`**, and surfaces them for a one-tap
  confirmation. A *concrete* anchor is mandatory; *who* supplies it is not — but a generic/empty direction is a
  **fail**. (Same required/deferrable-with-assumption shape as Phase-3 validation.)
- **The anchor is now wired to the producer and the auditor** (without this the gate was half-theater):
  `/start-sprint` loads `product/design-direction.md` for any UI sprint and instructs the build tier to build
  *to* the named references/mood/anti-references, not just to the tokens; `/close-sprint` loads it as the
  evidence the design-fidelity CHECK grades against.

### Notes
- On `--update`, an existing UI project sees the new a11y/design-fidelity CHECKs graded on its **next**
  sprint audit (not retroactively — frozen audit records are never rewritten), so this stays an additive
  patch. A previously-passing UI with inline hex or no focus ring will surface those on its next Phase 8.
- The `voltagent` design/security specialists remain **optional preference-if-installed**, never a
  dependency — Midas degrades cleanly to its own three tiers, and everything stays anchored to the
  human (or `assumed`) direction.
- Deliberately deferred (cosmetic, and it would rewrite a frozen audit record): realigning the
  `examples/taskpilot` tokens from `--color-*` to the starter's `--ds-*` namespace.

### Engine
- Version single-sourced to `0.5.7` (`harness/VERSION` + all mirrors).

---

## [0.5.6] — 2026-06-18

### Added — a real one-command update: `--update`
A plain `--force` re-install left `harness/state.yaml`'s `midas_version` stale (so `/midas-doctor` then
warned). The new flag does it properly:

```bash
npx github:okuzpe/midas-harness#v0.5.6 --update   # or omit #vX.Y.Z for the latest main
```

- Refreshes the engine to the new version, **keeps your work** (`product/`, `.harness/`, `harness/state.yaml`),
  **bumps the `midas_version` stamp** so status/doctor read it as current, and re-renders the adapters.
- Honest heads-up in the output: it overwrites engine files, so if you consciously amended a rule, review
  `git diff` and re-apply your `## Amendment`. Documented in `INSTALL.md` and `--help`.

### Engine
- Version single-sourced to `0.5.6` (`harness/VERSION` + all mirrors).

---

## [0.5.5] — 2026-06-18

### Fixed — "make the gate real" (top fixes from a 13-lens scored audit; weighted 7.5 → ~8.0)
A whole-project scored audit (13 expert lenses) put Midas at an honest **7.5/10** and flagged that the
flagship "check outside the model" was real in code but **not proven to fire**. This release closes that.
- **`/midas-doctor` can now check any project + enforce, not just warn.** It accepts a project-root arg
  (`node scripts/doctor.mjs path/to/project`) so the gate-records check runs on a real install (not only
  the engine repo), and a **`--strict`** flag promotes a `gate:*` inconsistency to a non-zero exit. It also
  catches a **self-inconsistent** record (`verdict=pass` with `unresolved>0`).
- **First behavioral tests.** `scripts/fixtures/{inconsistent,consistent}-audit` + `scripts/test.mjs`
  (section K) run the real doctor and assert the gate **fires** on a planted `done`-sprint-with-unresolved-CRITs
  record and **stays quiet** when clean — the first test that proves a guardrail *works*, not just that files parse.
- **`audit`-stage contradiction resolved.** `state.schema.md` + the `close-sprint`/`start-sprint`
  descriptions now agree: the top-level `stage` is never `audit` (Phase 8 runs in place during
  `sprint_execution`); the `phases.audit` ledger entry just *names* the phase.
- **`audit-07-NN.md` → `audit-NN.md`** in `7-sprint-execution.md` (it broke the doctor regex).
- **Stale `.mcp.json` docs fixed** (Context7 was made optional in v0.5.0): `SECURITY.md` + `INSTALL.md` now
  say one default server (`sequential-thinking`). Added a `test.mjs` check that prose `#vX.Y.Z` pins match `harness/VERSION`.

### Added
- The phase-advancing rituals are clearly marked **user-typed slash commands**: agents must **never call them
  via the Skill tool** (it errors) — surface the command for the user to type. (AGENTS.md, the orchestrator
  agent, `/midas-status`.)

### Engine
- Version single-sourced to `0.5.5` (`harness/VERSION` + all mirrors); test suite now **140 checks**.

---

## [0.5.4] — 2026-06-18

### Added — a design direction step, so the UI isn't generic
From real-project feedback: AI-generated design defaults to bland, "Tailwind-default" output because it has
no anchor — a design *system* (tokens) buys consistency, not originality. Phase 5 now sets the **aesthetic
intent first**, then builds the tokens to it.
- New `product/design-direction.md` (template + gate item): captured **from the human** (your taste is the
  input) — brand personality, **2–3 real products to emulate** (+ what to borrow), mood keywords, and
  **anti-references** (what to avoid). `/define-conventions` asks for it before generating tokens, and every
  token choice traces to it. Prefers a design specialist (`voltagent-core-dev:ui-designer`/`design-bridge`)
  if installed; otherwise the build tier, always anchored to the direction.
- **Design critique wired in:** `/midas-verify` now judges rendered UI against the direction (distinctive &
  on-direction vs generic, not just token-consistent), and `/midas-tribunal` gains a **Design Critic** lens +
  a `design` target.
- Worked example: `examples/taskpilot/product/design-direction.md` (Linear / Things references).
- **Honest limit:** this kills *generic*; *original* still needs your taste + a strong reference — the
  direction is an explicit human input, not something the AI invents.

### Engine
- Version single-sourced to `0.5.4` (`harness/VERSION` + all mirrors).

---

## [0.5.3] — 2026-06-18

### Added — `/midas-tribunal` now has recommended checkpoints in the flow
The whole-project adversarial debate was a "run it any time" tool with no anchor, so it was easy to skip
and unclear *when* it pays off. It now has a **space in the flow** — recommended, optional, **non-advancing**
(a prompt, not a gate; it stays cost-aware, since it's a multi-agent Opus debate):
- `/midas-status` surfaces a *"💡 consider `/midas-tribunal` first"* line at three high-leverage transitions:
  **pre-go/no-go** (Phase 3), **pre-rules-freeze** (Phase 4→5, before `/define-conventions`), and **pre-ship**
  (final sprint, before declaring MVP complete).
- Those checkpoints are formalized in `methodology.md` and noted in the relevant skills
  (`business-plan`, `define-conventions`, `close-sprint`, `midas-tribunal`).
- Running or skipping is always the human's call — never a block.

### Engine
- Version single-sourced to `0.5.3` (`harness/VERSION` + all mirrors).

---

## [0.5.2] — 2026-06-17

### Fixed — the adaptive-intake scan no longer surfaces benign "not found" as errors
From real-project use (a 303-file Python+Dart repo): `/midas-init`'s Phase-A scan was producing
fragile shell probes that reported `Error: Exit code N` on benign conditions — an `&&`-chain aborting
when one sub-probe missed, and `command -v go/flutter/dart` returning non-zero simply because those
toolchains weren't installed on the machine.
- `/midas-init`, `/midas-adopt`, and `0b-codebase-inventory` now instruct a **robust scan**: classify
  from the **repo's files** (manifests/source/tests/CI), not from locally-installed toolchains (a
  sandbox/CI box may lack them); prefer Glob/Grep/Read; run probes **independently** and **swallow benign
  failures** (`… || true`) so a missing dir, empty glob, or absent tool reads as data, not an error.

### Engine
- Version single-sourced to `0.5.2` (`harness/VERSION` + all mirrors).

---

## [0.5.1] — 2026-06-17

### Changed — validation is now two-tier (so an AI-only founder isn't hard-walled)
From real-project feedback: the lifecycle was letting the AI invent a hard "go interview N people +
preorders" gate that blocks a founder whose only tool is the AI. Validation is now explicitly split:
- **Desk validation (Phase 2 `/market-research`) — the AI does it, required.** Market-research now gathers
  **demand signals** (competitor traction/reviews, complaints, search/community interest, willingness-to-pay)
  and ends in a frank **demand verdict** (strong/mixed/weak), not just a competitor list. It states plainly
  what the desk can prove (a market exists) and cannot (that *these* customers pay).
- **Field validation (Phase 3 `/business-plan`) — strongest evidence, recommended, but deferrable.** Customer
  interviews / a real preorder / a paid-ad test are strongly recommended; if not feasible now they may be
  **deferred with a logged assumption** ("real-customer demand unproven"), re-surfaced before launch/scale.
  The go/no-go gains a **GO-with-field-validation-deferred** verdict — the founder's informed risk call, not a wall.
- New `## Demand signals` (`market.md`) and `## Validation status` (`business-plan.md`) template sections +
  gate items. Also fixed a stale `/midas-tech-architecture` → `/choose-architecture` pointer in the template.

### Engine
- Version single-sourced to `0.5.1` (`harness/VERSION` + all mirrors).

---

## [0.5.0] — 2026-06-17

> **Breaking (pre-1.0 minor).** Context7 is no longer a bundled/mandatory dependency. Existing installs
> keep working (your `.mcp.json` is untouched on upgrade); new installs ship without it. See **Migration**.

### Changed — Context7 is now optional; the doc-fetching rule is tool-agnostic
Midas mandates the **habit** (fetch current, version-accurate docs before third-party code; never from
memory), **not the vendor**. Wire whichever doc tool you like.
- `harness/rules/context7-usage.md` rewritten tool-agnostic: Context7 is the *recommended free* option,
  with a web-fetch MCP / your own tool / by-hand as equals; the no-tool fallback is explicit.
- **Context7 removed from the default `.mcp.json`** (demoted to a commented `RECOMMENDED (optional)` entry
  in `mcp.json.tmpl`). The bundled `CONTEXT7_API_KEY` Authorization header is gone from the default config.
- Skill frontmatter `mcp-required: [context7]` → `mcp-recommended: [context7]` (8 skills); the
  "Context7 (mandatory)" framing in `AGENTS.md`, `harness/conventions.md`, the pipeline docs, and the
  generated adapters reworded to "fetch current docs (Context7 recommended, or your tool)". README badge
  removed; the MCP / docs-site copy updated.
- **Kept intact:** the principle and the value-add — agents still must fetch current docs before
  third-party code. Only the *coupling to a specific vendor* is gone.

### Fixed
- **`AGENTS.md` honesty.** It no longer claims Cursor/Copilot/Codex "read `.claude/skills` natively too" —
  aligned to the README's honest scope (Claude Code native; other tools get methodology + rules via
  `AGENTS.md`/`GEMINI.md`/adapters where supported; parity varies).

### Migration
No action required: existing installs keep their current `.mcp.json` (Context7 stays if you had it). To
match the new default you may remove the `context7` server from `.mcp.json` and rely on the rule's
tool-agnostic guidance — or keep Context7; it is still the recommended doc tool. Any doc MCP (or none +
by-hand) satisfies the rule.

### Engine
- Version single-sourced to `0.5.0` (`harness/VERSION` + all mirrors).

---

## [0.4.2] — 2026-06-17

### Fixed — whole-project alignment audit (5-lens workflow)
A multi-agent alignment audit after the v0.3.x–v0.4.1 work caught and fixed several cross-file
inconsistencies (verdict: needs-work → all must-fix applied):

- **Dead `/close-sprint` route.** `/midas-status` routed `stage: audit → /close-sprint`, but no skill ever
  sets `stage: audit` — Phase 8 runs *in place* during `sprint_execution`. `/midas-status` now routes
  `sprint_execution → /close-sprint` once the active sprint's work has landed; the transient `audit` label
  is annotated as such in `state.schema.md` and `8-audit-adjust.md`.
- **`docs/faq.md` uninstall answer** rewritten to the shipped `--uninstall` (it told users to delete
  `.harness/` — their audit trail — and a `.midas` directory that never existed).
- **CHANGELOG compare links** added for every release (were missing/stale).
- **Playbook count** normalized to `0–4 (zero is valid)` everywhere (three sites still read `2–4`);
  `docs/methodology.md` gained the playbooks + mechanical-gate (`CHECK:` / `MIDAS_AUDIT_RESULT` / doctor)
  story; `/midas-adopt`'s exit now routes E2 → `/define-conventions`, E3 → `/plan-sprints`.
- The worked example now exercises the playbook → sprint → audit linkage (sprint-01 tags + audit-01 done-when).

### Engine
- Version single-sourced to `0.4.2` (`harness/VERSION` + all mirrors).

---

## [0.4.1] — 2026-06-17

### Added — Phase 5 emits project playbooks (not just rules)
`/define-conventions` now generates, **beyond the rules**, a small bounded set of **playbooks** — markdown
recipes for the tasks that recur in the chosen stack — so every sprint does a repeated task the same way.
(Built, then reviewed by a 3-lens adversarial pass; verdict ship-after-must-fix, all must-fix applied.)

- **Rules are constraints the audit checks; playbooks are procedures the build agent follows.** Each
  playbook in `product/playbooks/<verb-noun>.md`: use-when, steps, the rules/tokens it honors (by
  `<slug>.md` — never restated), a Context7 fetch, and a done-when check that is the procedure's *own*
  signal.
- **Anti-bloat by design:** **0–4** playbooks (zero is valid); a task earns one only if it recurs AND has a
  non-obvious project-specific "right way". CHECK: each playbook must have ≥1 step no single rule states —
  a 1:1-to-rules playbook is cut. Playbooks are markdown the agent reads, **not** new slash-commands.
- Wired into the loop: `/start-sprint` loads and follows the matching playbook; `/close-sprint` confirms a
  followed playbook's done-when. A `harness/templates/playbook.md` template + an optional `playbook: <slug>`
  task linkage in the sprint template.
- Worked example: `examples/taskpilot/product/playbooks/` ships two real recipes (`add-api-route`,
  `add-drizzle-migration`), grounded in the example's Next.js + Drizzle code.

### Engine
- Version single-sourced to `0.4.1` (`harness/VERSION` + all mirrors).

---

## [0.4.0] — 2026-06-17

### Added — `/midas-init` is now an adaptive intake
Setup no longer forces every repo through a blank `/idea-intake`. `/midas-init` now **scans what the
project already has, classifies its maturity, pre-fills what it can infer, asks only the genuine gaps,
and places the project at the right phase** — reviewed by a 4-lens adversarial pass before shipping.

- **Scans code AND intent.** Beyond manifests/source, it reads `README`, `docs/`, briefs, notes, and the
  manifest `description` — so a project that is "just an idea written down" skips the blank idea-intake.
- **Maturity spectrum (E0–E3), not binary greenfield/brownfield.** E0 empty → `/idea-intake`; E1 idea-only
  → pre-fills `product/idea.md`, enters at `/contextualize`; E2 partial code → `/midas-adopt` → enters at
  `/define-conventions` (Phase 4 recorded as a skipped gate); E3 mature → full `/midas-adopt` → `/plan-sprints`.
  E0/E1 persist `mode: greenfield`, E2/E3 `mode: brownfield`.
- **Infer → SHOW → confirm.** Every inference (the maturity level, a `product/idea.md` drafted from the
  README, an as-built architecture) is shown for the user to accept or correct — never silently baked.
  Conflicts between a stale README and the code are flagged `DISPUTED`, not silently resolved.
- **Gap-only questions.** One batched round, scaled to the project: a mature repo confirms a classification
  and a couple of operational questions; a blank repo answers the full set. Confirming a level shows the
  gates it skips so the choice is informed. Monorepos are detected and routed to `/midas-monorepo`.
- `/midas-adopt` now harvests the written intent (README/docs) to backfill product context, not just code,
  and is framed as the E2/E3 branch of the intake. `methodology.md`, `state.schema.md`, the pipeline 0b
  playbook, and the docs site are updated to the maturity model.

### Engine
- Version single-sourced to `0.4.0` (`harness/VERSION` + all mirrors).

---

## [0.3.4] — 2026-06-17

### Fixed — MCP `sequential-thinking` server (caught by real-project validation)
- **Corrected the npm package name** in `.mcp.json` and `harness/templates/mcp.json.tmpl`:
  `@modelcontextprotocol/server-sequentialthinking` → `@modelcontextprotocol/server-sequential-thinking`.
  The misspelled name 404'd on **every** platform, so the server never started on any install.
- **Windows: the installer now wraps npx-launched MCP servers in `cmd /c`.** On Windows `npx` is a
  `.cmd` shim Node can't spawn directly, so `command: "npx"` fails with `MCP error -32000: Connection
  closed`. `create-midas` rewrites those servers to `cmd /c npx …` at install time (no-op on macOS/Linux).
- **`/midas-doctor` now warns** when, on Windows, a `.mcp.json` server launches with bare `npx`, so an
  already-installed project surfaces the issue (fix: re-run the installer with `--force`).

### Engine
- Version single-sourced to `0.3.4` (`harness/VERSION` + all mirrors).

---

## [0.3.3] — 2026-06-17

A "make the gate mechanically real" pass, driven by an internal audit + landscape review. Six
markdown/tiny-script improvements that close the self-grading gap **without adding any runtime**.

### Added — gates that something other than the model can read
- **Floor rules now ship with `CHECK:` lines.** Every item in `harness/rules/{code-quality,security,
  git-commits,naming,testing,docs}.md` carries a concrete pass/fail condition (a grep/command, or a
  `manual:` observable). This resolves a real self-contradiction: `/define-conventions` mandates that
  *generated* rules be checkable while the *shipped* floor rules had no checks at all.
- **`MIDAS_AUDIT_RESULT` tally line** on the per-sprint audit (`MIDAS_AUDIT_RESULT: rules_failed=X
  unresolved=Y amended=Z verdict=pass|blocked`), mirroring the existing verify/tribunal tally lines.
  Specified in `8-audit-adjust.md` + `/close-sprint`.
- **`/midas-doctor` now parses those frozen tally lines** — the first check *outside the model* that
  validates a verdict. It warns when an `audit-NN.md`/`verify-NN.md` record shows unresolved CRITs (or
  `verdict=blocked`) while `state.yaml` marks that sprint `done`. Per-sprint records only; the tribunal
  stays advisory by design.
- **"Human sign-off points"** subsection in `methodology.md` — the canonical list of decisions the
  harness never makes for you (go/no-go, rule amendments, scope-drift acceptance, applying the
  tribunal, ship, commit/push), each with where it is recorded.
- **EARS acceptance-criteria convention** (`WHEN <trigger>, the system SHALL <response>`) in
  `harness/conventions.md`, `/plan-sprints`, and the sprint template — so Phase-8 can map each
  criterion to a passing test.

### Changed — worked example now closes the 7 ⇄ 8 loop
- **`examples/taskpilot` completes one full sprint close.** Sprint 1 is driven to `done` with the full
  vertical slice (auth register/login/logout + sessions, task CRUD incl. `/api/tasks/[id]`, middleware,
  a `/board` stub, unit + integration tests), a **closing `audit-01.md`** (verdict PASS + tally line),
  and `state.yaml` advanced to point at Sprint 2. The signature loop is now demonstrated, not just
  described. (Also fixes a latent gap: `route.ts` imported `@/lib/auth/session`, which did not exist.)

### Added — uninstaller (same one command, `--uninstall`)
- **`--uninstall` on the installer**, following the caveman pattern (no separate `uninstall.sh`):
  `curl … | bash -s -- --uninstall`, `npx github:okuzpe/midas-harness --uninstall`, or the PowerShell
  scriptblock form. It is **surgical** — removes only pristine engine files + the marker-tagged
  generated adapters, prunes the empty engine directories, and **keeps your work** (`product/`,
  `.harness/`, `harness/state.yaml`) and any file you edited or that Midas didn't author. Flags:
  `--dry-run` (preview, delete nothing) and `--purge` (also remove your artifacts + state). Idempotent.
  Documented in `INSTALL.md` and both installer shims.

### Engine
- Version single-sourced to `0.3.3` (`harness/VERSION` + all mirrors).

---

## [0.3.2] — 2026-06-17

### Fixed — onboarding (from real-project validation)
- **The installed `AGENTS.md` now describes YOUR project, not Midas.** The initializer used to render the
  engine's own `AGENTS.md` (which read "Midas is a portable harness…") into every project; it now renders
  the project template (`harness/templates/AGENTS.md.tmpl`) and fills in the project name.
- **`/midas-init` is now a true one-time setup that retires itself.** It asks config in one batched round,
  sets `setup_complete: true`, and on re-run just points at `/midas-status`. On a **brownfield** repo it
  now **continues straight into `/midas-adopt` in the same run** — no more two separate commands.
  `/midas-status` directs you to `/midas-init` until setup is complete.
- `harness/state.yaml` gains a `setup_complete` flag (written `false` by the installer).

### Added
- `docs/context-hierarchy.md` — a single map of every file Midas writes (role, who edits it, which tools
  read it) and the rule-precedence order, consolidating guidance scattered across `AGENTS.md`,
  `harness/conventions.md`, the README, and `state.schema.md`. Added to the docs-site nav.

---

## [0.3.1] — 2026-06-17

### Changed — install flow
- **The installer now writes a default `harness/state.yaml`** (auto-detecting greenfield vs brownfield),
  so a project is **usable immediately in any tool** — `/midas-status` works right after `npx`. `/midas-init`
  becomes **optional refinement** (cost profile, tools, Context7 key) instead of a required step; brownfield
  installs are pointed at `/midas-adopt`. This removes the previous mandatory two-step onboarding.

### Changed (positioning / honesty pass)
- README restructured: clearer one-line pitch, a **When to use / when not to** section, a **Core vs
  advanced** table, and a slimmer quickstart (advanced commands moved out of the core loop).
- **More honest tools matrix** — replaced the blanket "native" claims with per-tool skill/routing
  support and a recommended level (Full/Good/Basic); Claude Code is stated as the primary target.
- `state.schema.md`: added a **minimalism rule** — `state.yaml` holds only operational state; long
  detail lives in `product/*` / `.harness/*`.
- Published formal GitHub Releases for v0.2.0 and v0.3.0.

### Fixed (ship-audit pass)
- **Broken references that shipped into every install.** Pipeline playbook links were zero-padded
  (`pipeline/00-…`) but the files are single-digit (`pipeline/0-…`) — fixed across `methodology.md` and
  the phase skills. Dead `/midas-business-case` "next" pointer in the market template → `/business-plan`.
- `docs/skills.md` now lists `/midas-update`, `/midas-verify`, `/midas-monorepo`; the `docs/skills.md`
  intro and `docs/faq.md` no longer overclaim non-Claude "native" support.
- `CONTRIBUTING.md` release step points at `harness/VERSION`, not a non-existent script constant.
- `SECURITY.md` now documents the `curl|bash` / `irm|iex` pipe-to-shell trust model (+ SEC-005).
- `scripts/test.mjs` now asserts the schema/example version stamps and that every referenced pipeline
  playbook resolves on disk (regression guard for the broken-link class).

---

## [0.3.0] — 2026-06-17

### Added
- `/midas-monorepo` — set Midas up across a monorepo/polyglot repo: nested `AGENTS.md` per package
  (nearest-file-wins), per-package rules/stack (Context7-verified), with dry-run + diff-confirm.
- `/midas-verify` — Playwright-gated end-to-end / UI verification (hard-gated to UI sprints); per-claim
  pass/fail with screenshot evidence frozen to `.harness/verifications/verify-NN.md`.
- `/midas-update` — migrate an install to the current engine: compares `state.yaml` `midas_version`
  against `harness/VERSION`, applies the minimal migration with dry-run + diff-confirm, bumps the stamp.
- Design-system **components** (`harness/design-system/components.md`) — a token-driven base set
  (Button, Input, Card, Dialog, …) with states + WCAG AA accessibility.
- **Docs site** — MkDocs-Material (`mkdocs.yml` + `docs/`) with a GitHub Pages deploy workflow.
- OSS polish — `NOTICE`, `CODE_OF_CONDUCT.md`, PR + issue templates.

### Changed / Fixed (external-audit pass)
- **Version is single-sourced** at `harness/VERSION` (`0.3.0`); `package.json`,
  `create-midas/package.json`, `gemini-extension.json`, `state.schema.md`, and the example all match,
  and `scripts/test.mjs` asserts it. (Was inconsistently `0.1.0`/`0.2.0`.)
- **`/midas-doctor` now runs real health checks** (version stamp vs engine, required `state.yaml` keys,
  secret-free `.mcp.json`, skills frontmatter, critical files) — not just adapter drift.
- **`market-research`** no longer hard-requires the `fetch` MCP (uses built-in `WebSearch` + Context7);
  `mcp-required: [context7]`.
- **README compatibility claims softened** — "native" = read-without-conversion, not feature parity;
  non-Claude model routing is advisory. Added a CI badge and a pinned-install recommendation.
- **CI** runs a real installer smoke test (install into a temp dir, then `doctor`).
- Tribunal "grounded in research" now cites sources in `harness/research/debate-method.md`.

---

## [0.2.0] — 2026-06-17

### Added
- `/midas-tribunal` — standing whole-project **adversarial debate** skill. Convenes a tribunal (steelman
  Defense vs red-team Prosecution + a dissent-forcing Catfish) across 11 decision-science lenses
  (Premortem, ATAM, FMEA, STRIDE, YAGNI, Economist, Competitor, Inverter, …). Debaters run on
  build/scout tiers; `midas-orchestrator` (Opus) judges **per claim**; every claim cites on-disk evidence
  or is struck. Scope modes (`whole|architecture|scope|idea|market|unit-economics|security|rules`) and a
  cost-clamped depth dial (`quick|standard|tribunal`). Freezes a ranked findings report to
  `.harness/debates/debate-NN.md` with a findings→action bridge. Complements `/close-sprint` (sprint
  conformance) by arguing *whether the decisions themselves are right*. Example:
  `examples/taskpilot/.harness/debates/debate-01.md`.
- `/market-research` — Phase 2 skill: fans out research (reuses `/deep-research`), verifies claims with
  citations, and writes `product/market.md`.
- `/business-plan` — Phase 3 skill: value proposition, MVP scope vs non-goals, measurable success
  metrics, and a go/no-go with **human sign-off** → `product/business-plan.md`.
- **Plugin marketplace rail** — `.claude-plugin/marketplace.json` + a generated `plugins/midas/` tree
  (rendered from `.claude/` by `scripts/build-plugin.mjs`), so Claude Code users can install with
  `/plugin marketplace add okuzpe/midas-harness` → `/plugin install midas@midas`. Plugins do not
  auto-install rules/`CLAUDE.md`, so run `/midas-init` once after install.
- **Test suite + CI** — `scripts/test.mjs` (dependency-free, 84 checks) validates JSON, skill/agent
  frontmatter, ritual-guard presence, adapter sync, plugin-tree sync, the example state shape, and the
  absence of stale brand tokens. A GitHub Actions workflow (`.github/workflows/ci.yml`) runs it plus
  `doctor` and a plugin-sync check on every push/PR.
- **One-command install from GitHub** — `npx github:okuzpe/midas-harness` (also `pnpm dlx` / `bunx`)
  installs Midas into any project, no npm account needed: a root `package.json` `bin` runs the
  dependency-free initializer (`create-midas/index.mjs`), which copies the harness non-destructively
  and generates the tool adapters, then points the user at `/midas-init`. The same initializer is also
  packaged as `create-midas` for a future `npm create midas`; `scripts/build-create.mjs` bundles its
  template from source and CI fails on drift.
- **Shell one-liners + `INSTALL.md`** — `install.sh` (`curl … | bash`) and `install.ps1` (`irm … | iex`)
  thin shims that bootstrap the same Node installer (no parallel logic to drift), plus a full
  `INSTALL.md` covering every method, flags, and uninstall.
- **`GEMINI.md` adapter** — a fourth generated tool adapter so Gemini CLI honors the harness too; the
  installer now prints a per-tool coverage summary on completion.
- **Brownfield adoption** — `/midas-adopt` brings Midas to an existing project: inventories the codebase
  (`harness/pipeline/0b-codebase-inventory.md`), reverse-engineers architecture + rules from the real
  code (codify reality; violations logged as debt), and wires the harness with **dry-run + diff-confirm**
  — it never overwrites a pre-existing `AGENTS.md`/`CLAUDE.md`/source without a confirmed diff.
  `/midas-init` now branches to it on brownfield repos.
- **Gemini CLI extension** — `gemini-extension.json` registers Midas as a Gemini CLI extension (context
  file `GEMINI.md`). Codex is covered by `AGENTS.md`, which it reads natively.

---

## [0.1.0] — 2026-06-16

**Build-phase 1:** greenfield foundation. Establishes the harness floor that all future phases extend.

### Added

#### Harness core
- `harness/methodology.md` — 9-phase lifecycle overview with state-machine diagram and brownfield entry notes.
- `harness/conventions.md` — always-on base conventions (code quality, naming, errors, testing, deps, git, security, design system); single body inlined into generated adapters.
- `harness/state.schema.md` — schema reference for `harness/state.yaml`, the single source of truth for phase progress.
- `harness/rules/context7-usage.md` — mandatory rule: fetch live library docs via Context7 before writing any third-party code; web fallback documented.
- `harness/pipeline/0-idea-intake.md` through `harness/pipeline/8-audit-adjust.md` — per-phase playbooks covering actor, inputs, steps, exit gate, and artifacts for each of the 9 phases.

#### Agent Skills (`.claude/skills/`)
- `/midas-init` — interactive installer; writes `harness/state.yaml` and generates adapters; guarded ritual.
- `/midas-status` — reads state and prints the single next action; scout-tier, read-only.
- `/midas-doctor` — detects adapter drift and re-renders `CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md` from source; guarded ritual.
- `/idea-intake` — Phase 0 skill; captures raw idea, 1-line pitch, and mode into `product/idea.md` + `harness/state.yaml`.
- `/contextualize` — Phase 1 skill; gap-audit loop, resolves BLOCKING open questions, writes `product/open-questions.md`.
- `/choose-architecture` — Phase 4 skill; Context7-verified stack selection, writes `product/architecture.md` and first ADR.
- `/define-conventions` — Phase 5 skill; generates stack-specific rules + design-system scaffolding; guarded ritual.
- `/plan-sprints` — Phase 6 skill; writes `product/roadmap.md` and `product/sprints/NN-*.md`.
- `/start-sprint` — Phase 7 skill; activates a sprint, gates on gate: passed; guarded ritual.
- `/close-sprint` — Phase 7→8 handoff; triggers audit; guarded ritual.

#### Agents (`.claude/agents/`)
- `midas-orchestrator` (`claude-opus-4-8`) — think/plan/audit; used for ~6 irreversible phase decisions.
- `midas-builder` (`claude-sonnet-4-6`) — implement/write artifacts; default execution model.
- `midas-scout` (`claude-haiku-4-5`) — search/extract/status; cheapest tier for mechanical tasks.

#### Tool adapters (generated; do not hand-edit)
- `CLAUDE.md` — Claude Code project law, inlined from `AGENTS.md` + `harness/conventions.md`.
- `.cursor/rules/00-midas.mdc` — Cursor adapter.
- `.windsurf/rules/00-midas.md` — Windsurf adapter.

#### MCP wiring
- `.mcp.json` — secret-free config wiring Context7 (HTTP) and sequential-thinking (npx); `${ENV_VAR}` pattern documented for optional servers.

#### Scripts
- `scripts/render-adapters.mjs` — re-renders all three tool adapters from source; no external deps.
- `scripts/doctor.mjs` — detects adapter drift, reports mismatches, optionally re-renders; called by `/midas-doctor`.

#### Docs & governance
- `AGENTS.md` — project law for all AI agents; source of truth for generated adapters.
- `README.md` — quickstart, phase overview, supported-tools matrix, MCP section, status.
- `docs/agents-and-models.md` — single bump point for model IDs and cost profiles.
- `CHANGELOG.md`, `VERSIONING.md`, `CONTRIBUTING.md`, `SECURITY.md` — governance floor.
- `LICENSE` — Apache-2.0.
- `.gitignore` — ignores caches, hashes, and volatile state; commits `harness/state.yaml`.

#### Example
- `examples/taskpilot/` — fully-populated greenfield product showing every phase artifact (idea, open questions, market, business plan, architecture, ADR, rules, design system, roadmap, sprint, audit) and a runnable code slice.

### Known limitations (v0.1)
- Brownfield entry at Phase 4/5 prints a safe manual path; full dry-run + diff-confirm support is deferred.
- Market-research (`/market-research`) and business-case (`/business-case`) skills are scaffolded but not yet interactive; they delegate to `/deep-research` with manual prompting.
- Cursor and Windsurf adapters do not yet auto-reload on `/midas-doctor`; re-open the editor after re-rendering.
- Plugin marketplace is not yet implemented; enrichment agents are consumed ad-hoc if present.

[Unreleased]: https://github.com/okuzpe/midas-harness/compare/v2.10.1...HEAD
[2.10.1]: https://github.com/okuzpe/midas-harness/compare/v2.10.0...v2.10.1
[2.10.0]: https://github.com/okuzpe/midas-harness/compare/v2.9.9...v2.10.0
[2.9.9]: https://github.com/okuzpe/midas-harness/compare/v2.9.8...v2.9.9
[2.9.7]: https://github.com/okuzpe/midas-harness/compare/v2.9.6...v2.9.7
[2.9.6]: https://github.com/okuzpe/midas-harness/compare/v2.9.5...v2.9.6
[2.9.5]: https://github.com/okuzpe/midas-harness/compare/v2.9.4...v2.9.5
[2.9.4]: https://github.com/okuzpe/midas-harness/compare/v2.9.3...v2.9.4
[2.9.3]: https://github.com/okuzpe/midas-harness/compare/v2.9.0...v2.9.3
[2.9.0]: https://github.com/okuzpe/midas-harness/compare/v2.8.2...v2.9.0
[2.8.2]: https://github.com/okuzpe/midas-harness/compare/v2.8.1...v2.8.2
[2.8.1]: https://github.com/okuzpe/midas-harness/compare/v2.8.0...v2.8.1
[2.8.0]: https://github.com/okuzpe/midas-harness/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/okuzpe/midas-harness/compare/v2.6.1...v2.7.0
[2.6.1]: https://github.com/okuzpe/midas-harness/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/okuzpe/midas-harness/compare/v2.5.5...v2.6.0
[2.5.5]: https://github.com/okuzpe/midas-harness/compare/v2.5.4...v2.5.5
[2.5.4]: https://github.com/okuzpe/midas-harness/compare/v2.5.3...v2.5.4
[2.5.2]: https://github.com/okuzpe/midas-harness/compare/v2.5.1...v2.5.2
[2.5.1]: https://github.com/okuzpe/midas-harness/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/okuzpe/midas-harness/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/okuzpe/midas-harness/compare/v2.3.9...v2.4.0
[2.3.9]: https://github.com/okuzpe/midas-harness/compare/v2.3.8...v2.3.9
[2.3.8]: https://github.com/okuzpe/midas-harness/compare/v2.3.7...v2.3.8
[2.3.7]: https://github.com/okuzpe/midas-harness/compare/v2.3.6...v2.3.7
[2.3.6]: https://github.com/okuzpe/midas-harness/compare/v2.3.5...v2.3.6
[2.3.5]: https://github.com/okuzpe/midas-harness/compare/v2.3.4...v2.3.5
[2.3.4]: https://github.com/okuzpe/midas-harness/compare/v2.3.2...v2.3.4
[2.3.2]: https://github.com/okuzpe/midas-harness/compare/v2.3.1...v2.3.2
[2.3.1]: https://github.com/okuzpe/midas-harness/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/okuzpe/midas-harness/compare/v2.1.0...v2.3.0
[2.1.0]: https://github.com/okuzpe/midas-harness/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/okuzpe/midas-harness/compare/v2.0.0-rc.5...v2.0.0
[2.0.0-rc.5]: https://github.com/okuzpe/midas-harness/compare/v2.0.0-rc.4...v2.0.0-rc.5
[2.0.0-rc.4]: https://github.com/okuzpe/midas-harness/compare/v2.0.0-rc.3...v2.0.0-rc.4
[2.0.0-rc.3]: https://github.com/okuzpe/midas-harness/compare/v2.0.0-rc.2...v2.0.0-rc.3
[2.0.0-rc.2]: https://github.com/okuzpe/midas-harness/compare/v2.0.0-rc.1...v2.0.0-rc.2
[2.0.0-rc.1]: https://github.com/okuzpe/midas-harness/compare/v1.1.4...v2.0.0-rc.1
[1.1.4]: https://github.com/okuzpe/midas-harness/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/okuzpe/midas-harness/compare/v1.1.2...v1.1.3
[1.0.0]: https://github.com/okuzpe/midas-harness/compare/v0.5.30...v1.0.0
[0.5.30]: https://github.com/okuzpe/midas-harness/compare/v0.5.29...v0.5.30
[0.5.29]: https://github.com/okuzpe/midas-harness/compare/v0.5.28...v0.5.29
[0.5.28]: https://github.com/okuzpe/midas-harness/compare/v0.5.24...v0.5.28
[0.5.24]: https://github.com/okuzpe/midas-harness/compare/v0.5.23...v0.5.24
[0.5.23]: https://github.com/okuzpe/midas-harness/compare/v0.5.22...v0.5.23
[0.5.22]: https://github.com/okuzpe/midas-harness/compare/v0.5.21...v0.5.22
[0.5.21]: https://github.com/okuzpe/midas-harness/compare/v0.5.20...v0.5.21
[0.5.20]: https://github.com/okuzpe/midas-harness/compare/v0.5.19...v0.5.20
[0.5.14]: https://github.com/okuzpe/midas-harness/compare/v0.5.13...v0.5.14
[0.5.13]: https://github.com/okuzpe/midas-harness/compare/v0.5.12...v0.5.13
[0.5.12]: https://github.com/okuzpe/midas-harness/compare/v0.5.11...v0.5.12
[0.5.11]: https://github.com/okuzpe/midas-harness/compare/v0.5.10...v0.5.11
[0.5.10]: https://github.com/okuzpe/midas-harness/compare/v0.5.9...v0.5.10
[0.5.9]: https://github.com/okuzpe/midas-harness/compare/v0.5.8...v0.5.9
[0.5.8]: https://github.com/okuzpe/midas-harness/compare/v0.5.7...v0.5.8
[0.5.7]: https://github.com/okuzpe/midas-harness/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/okuzpe/midas-harness/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/okuzpe/midas-harness/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/okuzpe/midas-harness/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/okuzpe/midas-harness/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/okuzpe/midas-harness/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/okuzpe/midas-harness/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/okuzpe/midas-harness/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/okuzpe/midas-harness/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/okuzpe/midas-harness/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/okuzpe/midas-harness/compare/v0.3.4...v0.4.0
[0.3.4]: https://github.com/okuzpe/midas-harness/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/okuzpe/midas-harness/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/okuzpe/midas-harness/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/okuzpe/midas-harness/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/okuzpe/midas-harness/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/okuzpe/midas-harness/releases/tag/v0.2.0
[0.1.0]: https://github.com/okuzpe/midas-harness/commit/f7868fd
