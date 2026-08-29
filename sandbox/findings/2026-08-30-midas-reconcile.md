# Sandbox findings — midas-reconcile + update CLI

2026-08-30 · mode=`single` · skill=`midas-reconcile` (composer-2.5 Task) plus parent CLI probes against a nested `--force` install.

## Setup

- Engine: `midas-harness` 2.10.0
- Isolation: `node scripts/sandbox-run.mjs reset` then `env` exit 0; fixture `name: sandbox-example`
- Trace: `start-run` `run_id=f8a4908771fe` · `MIDAS_TRACE_ROOT=sandbox/example-product`
- Task model: `composer-2.5` (not `-fast`) · [midas-reconcile](e517c1ec-08e1-49ce-8715-9ed977c587f2)
- Parent extra (after a later reset-from-empty install): `node cli/index.mjs --tools=cursor --yes --force sandbox/example-product` then `update --check` / `--dry-run` / `--yes --offline`

## Decision-flow log

- `[SANDBOX AUTO-DECISION]` none — skill has no AskQuestion.
- Skill step 1: `node ../../scripts/install-diagnose.mjs` → MODULE_NOT_FOUND (exit 1).
- Fallback table used. Observation: `../../harness/VERSION` exists, `.harness/engine/VERSION` does not → `npx github:okuzpe/midas-harness#v2.10.0 update --yes`.
- Supplementary (not in skill text): `node cli/install-diagnose.mjs sandbox/example-product` → Status `partial_migrate`, next `/midas-init`, detail still pins `#v2.9.8 --update`.

## Issues found

1. **harness-gap** — Untracked files under `.harness/engine` survive the first `update` (as `[note] … left in place`) but `writeOwnershipManifest` walks the dest tree and records them as `vendor`. The **next** update then treats them as dropped-from-bundle and **deletes** them. Reproduced: `local-note.md` + `SKILL.md.bak` gone after the second `--offline` update. `computeOwnershipManifest` should not adopt files that were in `planReconcile.untracked`.
2. **harness-gap** — `cli/install-diagnose.mjs` `relatedCli(..., 'update')` still appends `--update`. `version_behind.nextCli` already uses `formatUpdateCmd`; detail text still says `npx ... --update`. Partial-migrate detail hardcodes `#v2.9.8`.
3. **harness-gap** — `harness/skills/midas-reconcile` (and midas-init/help) status list omits `partial_migrate`. Fallback table has no row for it, so script-missing vs live diagnose disagree (`update --yes` vs `/midas-init`).
4. **harness-gap** — Skill says “if `paths.scripts` exists, run `install-diagnose.mjs`”. Engine `scripts/` has no such file (it lives in `cli/` and is copied to `.harness/scripts/` only on install). Directory-exists is the wrong heuristic.
5. **harness-gap** — Skills still teach `--update` as the user-facing spelling (`midas-init`, `midas-help/response-map.md`, adopt/align/bundle/doctor/auto-pilot). Canonical CLI is `update`.
6. **harness-gap** — CI `test` jobs on the v2.10.0 push failed (smoke after 1237 unit tests green); `docs` failed `mkdocs build --strict` (11 link warnings, including ADR-016 → `INSTALL.md`). Job `release-manifest` was **skipped**. Branch `releases` does not exist; `update --check` is HTTP 404 / exit 2. Channel discovery is not live.
7. **harness-gap** — `bundle-integrity` is reported `ok: true` even on hash mismatch (`cli/lib/workflow/engine.mjs`). A stable payload that is not the published release should fail the report, not note it.
8. **fixture-limit** — Seed has no `.harness/engine` / `manifest.json`; `paths.engine`=`../../harness`. Diagnose always `partial_migrate`. `--force` install **over** the seed preserves those path overrides → doctor `skills:registry` fail / installer exit 6. Fresh empty dir + `--force` install works (`paths.engine=.harness/engine`).
9. **fixture-limit** — Seed `midas_version: 2.9.9` vs engine `2.10.0`; never reaches `version_behind` because `partial_migrate` wins first.

## Proposed improvements (not applied)

1. Exclude `reconcilePlan.untracked` (and any dest-only files not in the new bundle vendor list) from `computeOwnershipManifest` / `tree_sha256`. Add a two-update regression next to `installer:update-leaves-untracked-vendor-file`.
2. `relatedCli` → `formatUpdateCmd`; drop `#v2.9.8`; document `partial_migrate` in midas-reconcile + midas-init.
3. Skill diagnose: run the script only if the **file** exists; else `npx … --diagnose` or `node cli/install-diagnose.mjs` in the engine repo.
4. Retarget `harness/skills/*` copy from `--update` to `update`, then `npm run build`.
5. Fix mkdocs links (nav `INSTALL.md` / `CONTRIBUTING.md` or rewrite to in-docs paths). Make `--check` exit 1 not fail the CI step (`set +e` / expected codes). Unblock `release-manifest` so `releases/stable.json` and `edge.json` exist.
6. Fail `bundle-integrity` on stable mismatch; keep advisory on unpinned main / local builds.
7. Optional fixture: a second seed (or flag) that is a real nested install so `/midas-sandbox` can exercise `update` without `--force` over path overrides.

## Parent CLI notes (nested install, not the seed)

- `update --check --offline` → exit 2 (no cache). Network `--check` → HTTP 404 / exit 2.
- Same-version `update --yes --offline` → verify ok.
- Edited-drop of a file injected into the installed manifest → `[remove]` and deleted; unmodified drop did not create `.harness/conflicts/` (expected: `modified: false`).
- `--force` over seed: journal stuck at `verify`, `--resume` still exit 6 (`skills:registry`) because `paths.engine` stayed `../../harness`.
