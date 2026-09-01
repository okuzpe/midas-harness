---
title: Engine audit remediation
date: 2026-08-27
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: engine-full-audit canvas (2026-08-27, v2.9.9, main@3ba4960)
execution: code
origin: conversation audit canvas
---

# Engine audit remediation

Close every finding from the 2026-08-27 engine audit without changing the 9-phase methodology, the ADR-007/008 layout, or the 2.9.9 public install contract — except where Lite must become a real `track:` in the program counter.

## Goal Capsule

Implement the 22 audit findings as six sequenced phases (A–F). Mechanical gates are already green (1143 tests, doctor aligned, skill-quality 0/0). This work makes advertised contracts true, then pays docs and quality debt.

Stop when: every finding ID (H1–H4, M1–M12, L1–L6) is closed or explicitly deferred in CHANGELOG with a reason; `npm run align` is green; no generated tree is hand-edited.

Do not: bump `harness/VERSION` unless a phase ships a user-visible engine contract change (Lite wiring is the only likely minor). Do not install Midas into this engine root. Do not sunset classic/compact/hub or delete `migrate-layout.mjs` in this program.

## Product Contract

Origin: audit canvas findings H1–H4, M1–M12, L1–L6.

### Requirements

- R1. Lite (`track: lite`) is either a working program-counter path or is no longer advertised. This plan **wires it** (does not un-advertise). Governs H1, M2.
- R2. The always-on precedence box in `harness/conventions.md` matches `docs/context-hierarchy.md` (project overlay wins by slug over stack and base). Governs H2.
- R3. `docs/skills.md` catalog counts equal the registry: 29 primary + 5 internal + 4 deprecated = 38. Host-mirror sentence matches ADR-008 (engine root has `.claude/skills` + `.agents/skills`, not `.cursor/skills`). Auto-pilot history must not say Unreleased for 2.9.5 work. Governs M1, M7, M8.
- R4. `docs/muninn-comparison.md` inventory matches disk (38 skills, 24 rules, Cursor hooks exist). Governs H3.
- R5. GitHub issue #1 is closed or retargeted so it no longer reads as a v0.4 roadmap. Governs H4.
- R6. Phase skills ask via `AskQuestion` with `AskUserQuestion` as fallback when the host only has that tool. Governs M3.
- R7. `/midas-help` offers `/midas-bundle`. Engine-only `/midas-precommit` is named in the engine-contributor path, not as a product menu item. Governs M4.
- R8. Every `harness/skills/*/SKILL.md` declares `user-surface:` (no implicit default). Governs L2.
- R9. `/midas-auto-pilot` evolve path states which hosts can arm `/loop` vs which get a documented fallback. Governs M11.
- R10. `docs/skill-flows.md` adopt mermaid distinguishes E2 (rules) vs E3 (sprint planning). Maintenance table includes `/midas-precommit`. Governs M12, L4.
- R11. Contributor docs state engine `layout: classic` CLAUDE.md is repo-root `CLAUDE.md`; installs with `claude-code` use `.claude/CLAUDE.md`. Governs L3.
- R12. Engine `harness/state.yaml` `updated:` is honest after the first docs/code commit of this program. Governs L1.
- R13. Comparison/changelog nits: gstack header version; CHANGELOG historical `/midas-monorepo` is labeled historical-only. Governs M8 (gstack), L6.
- R14. `/close-sprint` SKILL.md exit gate requires reading `pipeline/8-audit-adjust.md` (does not duplicate the playbook). Governs L5.
- R15. Four layouts + two migrators stay; contributor docs name them read/migrate-only. Governs M6.
- R16. Engine `tools:` stays four-host for adapter authoring; `docs/dogfood.md` names the dual shape vs ADR-008 default `[cursor]`. Governs M10.
- R17. Structural tests on Windows do not look failed solely because expected-failure lines go to stderr. Governs M9.
- R18. `scripts/test.mjs` is split by domain in a last phase; behavior of checks is unchanged. Governs M5.

### Actors

- Engine contributor (this repo) implementing phases A–F.
- Product-install user of `track: lite` and `/midas-status` (phase B).
- Host agents (Cursor vs Claude Code) running phase skills (phase C).

### Out of scope

- Renaming phase skills to `/midas-*` (issue #1 item 1 — rejected; keep intentional prefix split).
- Memory Lite / `/midas-remember` / vector stores (issue #1 item 3 — ADR-003 stands).
- Deleting `scripts/migrate-layout.mjs` or v1 layout detectors.
- Changing default install `tools: [cursor]`.
- Splitting `scripts/doctor.mjs` or `cli/lib/runtime/execute.mjs` (named in the audit, not required to close findings).

### Key decisions

- KTD1. Wire Lite, do not un-advertise. `track: lite` remains a state field, not a new stage enum. Lite Idea+Plan **writes the stubs later skills already require**: `{product}/idea.md`, thin `{product}/architecture.md`, lean rules, and a **thin `{product}/business-plan.md`** (MVP + metrics + GO-assumed, sourced from the idea — not a skipped file). `{product}/market.md` is optional; skipped `market_research` is an assumption in `paths.state`. After that pass, `stage` is `sprint_planning`. `/midas-status` prints `Track: lite|full` and never recommends `/market-research` when `track: lite`. `/plan-sprints`, `/start-sprint`, and `/close-sprint` keep reading `business-plan.md` (the stub counts) and must not hard-stop on missing `market.md` when `track: lite`. Governs R1. Units: U2.
- KTD2. Precedence box becomes `project rule overlay > stack-specific rules > {product}/conventions.md > {product}/design-system.md > base conventions`. Re-render adapters. Governs R2. Units: U1.
- KTD3. Keep engine `tools: [claude-code, cursor, windsurf, gemini]`. Fix is documentation of dual-shape, not thinning the engine. Governs R16. Units: U5.
- KTD4. `AskQuestion` is the canonical prompt tool in skill bodies; one fallback sentence for Claude `AskUserQuestion`. Do not host-fork skills. Governs R6. Units: U3.
- KTD5. Issue #1: close as superseded by 2.x (naming kept; Lite wired in this program; Memory Lite rejected by ADR-003). Human must confirm the close. Governs R5. Units: U4.
- KTD6. Test split (U7) is last and may ship as its own PR. Earlier phases add checks to `scripts/test.mjs` in place. Governs R18.

### Assumptions

- The user wants all 22 findings implemented, not a subset.
- No version bump until Lite (U2) lands if status/init behavior changes for installs; docs-only phases stay patch-level or unreleased until that minor.
- Independent `ce-doc-review` was not run on this plan (same-session author as the audit).

## Planning Contract

### Technical design

Lite status algorithm (directional):

1. Read `paths.state` as today.
2. Print `Track: <track or full>`.
3. If `track: lite` and `stage` is one of `idea_intake` … `architecture_rules`, Next is not the STAGE_ROWS command for that stage — Next is “finish lite Idea+Plan” (`/midas-init` if setup incomplete) or `/plan-sprints` when idea+minimal arch+rules+sprint outline exist. Never `/market-research` / `/business-plan`.
4. If `track: lite` and `stage` is `sprint_planning` / `sprint_execution` / `shipped`, use existing STAGE_ROWS.

Stage table YAML stays 9 rows. Lite is a status/init overlay, not a second table. Add a `lite:` note field only if doctor/status need a machine string; prefer skill prose + tests over YAML schema growth.

Init: Phase D Ask batch gains track (full / lite) as an explicit option. `midas-init/SKILL.md` cites `pipeline/lite.md` in Does/Does not.

Catalog: replace `~31` / `~30` / `3 deprecated` with exact 29 / 5 / 4. Count is derived from registry in a test (`skills:catalog-counts`) so it cannot drift again.

user-surface: add a skill-quality-check warn (or fail) when frontmatter lacks `user-surface`. Fill all 38 files.

Windows stderr: expected-failure tests that today `console.error` a rollback line should write that line to stdout, or tests should not print on stderr when the failure is injected. Do not swallow real errors.

Test split: extract `scripts/lib/test-*.mjs` or `scripts/tests/*.mjs` imported by a thin `scripts/test.mjs` runner. Preserve `node scripts/test.mjs` as the single npm test entry.

### Sequencing

```
A (U1) → B (U2) → C (U3)
                ↘ D (U4, U5)   [docs; parallel with C after A]
                         → E (U6)  [Windows; independent after A]
                         → F (U7)  [last; after B tests exist]
```

U1 first because adapters and catalog tests are the floor. U2 depends on U1 only for align habit. U3/U4/U5 can parallel after U1. U6 is independent. U7 last so Lite/catalog tests are not moving during a file split.

### Risks

- Lite status overlay can contradict STAGE_ROWS if written loosely — mitigate with explicit “never recommend market/business on lite” tests.
- Requiring `user-surface` will fail skill-quality until all files are filled — same PR.
- Closing issue #1 without human OK is out of band — U4 drafts the comment; close only if the user asks.

## Implementation Units

### U1. Law and catalog truth

Phase A. Findings H2, M1, M7, M8 (Unreleased line).

Files: `harness/conventions.md`, `docs/context-hierarchy.md` (cross-read only), `docs/skills.md`, `scripts/test.mjs` (catalog-count check), then `npm run align` (adapters + `cli/template`).

Behavior: boxed precedence includes overlay; catalog numbers are exact; engine mirror sentence matches ADR-008; auto-pilot history cites 2.9.5 not Unreleased.

Tests:

- `conventions.md` boxed formula contains `overlay` (or `paths.rules`) before `stack-specific`.
- `docs/skills.md` does not contain `~31` or `3 deprecated` as live counts; contains `29` / `5` / `4` (or a generated count comment).
- `docs/skills.md` does not claim engine `npm run build` emits root `.cursor/skills` as the always-on trio.
- Align / doctor adapters-in-sync after conventions edit.

### U2. Wire Lite into the program counter

Phase B. Findings H1, M2.

Files: `harness/pipeline/lite.md`, `harness/pipeline/init-adaptive.md`, `harness/pipeline/6-sprint-planning.md`, `harness/skills/midas-init/SKILL.md`, `harness/skills/midas-status/SKILL.md`, `harness/skills/plan-sprints/SKILL.md` (missing `market.md` OK when `track: lite`; `business-plan.md` still required), `harness/skills/start-sprint/SKILL.md` and `harness/pipeline/8-audit-adjust.md` (same market skip), `harness/methodology.md`, `docs/methodology.md`, `README.md` / `docs/getting-started.md` only if the lite sentence must name status, `docs/skill-flows.md` (lite branch), `scripts/test.mjs` (replace `pipeline:lite` existsSync-only), fixture `scripts/fixtures/product-lite/` (`track: lite`, skipped `market_research` assumption, stub `business-plan.md`, no `market.md`). Then `npm run build` (skill mirrors + template).

Behavior: per KTD1. Init Phase D asks track. Status prints track and lite Next rules. plan-sprints/start/close do not demand `market.md` on lite. Methodology (engine + docs summary) has a short Lite paragraph pointing at `pipeline/lite.md`.

Tests:

- Fixture `product-lite` exists: `track: lite`, stub `business-plan.md`, no `market.md`.
- `plan-sprints` / `start-sprint` / `8-audit-adjust` bodies mention `track: lite` (or `market.md` optional on lite).
- `midas-status` SKILL.md matches `/track:\s*lite/i` and forbids `/market-research` as Next when lite.
- `midas-init` SKILL.md or init-adaptive Phase D lists track as an Ask option.
- `pipeline:lite` check becomes more than `existsSync` (reads fixture or skill contracts).
- Recall paths: lite fixture must not fail a “required file missing” check for `market.md`.

### U3. Skill host UX

Phase C. Findings M3, M4, L2, L5, M11.

Files: phase `SKILL.md` files that say only `AskUserQuestion`; `harness/skills/midas-help/SKILL.md`; all skills missing `user-surface`; `harness/skills/close-sprint/SKILL.md`; `harness/skills/midas-auto-pilot/SKILL.md`; `scripts/skill-quality-check.mjs`; `docs/skills.md` help/catalog if bundle is listed as primary (already is) but help menu options.

Behavior: AskQuestion canonical; help option for bundle (and engine-only precommit mentioned under “Install confusion / engine”); explicit `user-surface` on every skill; close-sprint exit gate “read pipeline/8-audit-adjust.md”; auto-pilot When NOT / host table for `/loop`.

Tests:

- `AskUserQuestion` without nearby `AskQuestion` is empty in `harness/skills`.
- Help SKILL.md option list includes `/midas-bundle`.
- skill-quality-check **warns** (not fail) on missing `user-surface` — tightening to a hard fail would be a frontmatter contract change (`VERSIONING.md` MAJOR). Same PR fills all 38 files so the warn is clean.
- Internals still omitted from help AskQuestion options (existing banned-slash checks stay green).

### U4. Public inventory and tracker

Phase D (docs + GitHub). Findings H3, H4, M8 gstack pin, M12, L4, L6.

Files: `docs/muninn-comparison.md` §3 inventory, `docs/gstack-comparison.md` header version, `docs/skill-flows.md` mermaid + maintenance table, `CHANGELOG.md` note on historical `/midas-monorepo` (do not rewrite ancient bullets as if they were never shipped — add a one-line pointer at the current Unreleased or 2.9.x notes: command removed, use `/midas-init --monorepo`).

GitHub: draft close comment for issue #1; close only with explicit user OK.

Tests: grep/check that muninn inventory no longer says `33 skills` or `Cero hooks`; gstack header does not claim current engine `2.9.3`; skill-flows mermaid has distinct E2 vs E3 adopt edges.

### U5. Engine contributor honesty

Phase D. Findings L1, L3, M6, M10.

Files: `harness/state.yaml` (`updated:`), `docs/dogfood.md`, `docs/repository-architecture.md` mermaid/table for CLAUDE.md paths, short “layouts + migrators” note in `docs/repository-architecture.md` (classic/compact/hub read-only; `migrate-layout.mjs` intra-v1; `cli/migrate-harness.mjs` v1→v2).

Do not change `tools:` in engine state.

Tests: architecture doc mentions root `CLAUDE.md` for engine classic; dogfood mentions dual-shape vs default `[cursor]`.

### U6. Windows test stderr

Phase E. Finding M9.

Files: the migrate-layout (or other) test helper that `console.error`s expected rollback lines; or `scripts/test.mjs` capture.

Behavior: `node scripts/test.mjs` on PowerShell does not emit a NativeCommandError for injected expected failures. Real failures still surface.

Tests: existing migrate-layout rollback check still passes; document in contributing-quickstart if a remaining stderr line is intentional.

### U7. Split scripts/test.mjs

Phase F (last, own PR). Finding M5.

Files: new `scripts/tests/*.mjs` (or `scripts/lib/test-*.mjs`) imported from thin `scripts/test.mjs`. `package.json` `test` script unchanged.

Behavior: same 1143+ checks, same CLI. No check semantics change.

Tests: `node scripts/test.mjs` still prints `passed, 0 failed`; CI job unchanged.

## Verification Contract

Per phase, before marking the unit done:

1. `node scripts/skill-quality-check.mjs` (must stay 0 fails; warns only if the unit introduced a new warn class that is then fixed).
2. `node scripts/doctor.mjs` (adapters in sync after U1 and after any skill/convention edit).
3. `node scripts/test.mjs` (full suite).
4. After skill or conventions edits: `npm run align` (not hand-edit `cli/template`, `.claude/skills`, plugins).
5. U4 GitHub close is a **human gate**, not a suite gate. Code DoD for H4 is: CHANGELOG or `docs/` names issue #1 as superseded. `gh issue close` only after explicit user OK.
6. Catalog-count test in U1 **computes** primary/internal/deprecated from the registry (or skill-registry.mjs) and asserts `docs/skills.md` contains those integers — do not hardcode 29/5/4 forever.

Producer does not grade the whole program as done until U1–U6 are green; U7 may remain a follow-up PR listed in CHANGELOG Unreleased. Lite (U2) is a **MINOR** (`VERSIONING.md` additive behavior), not a silent patch. Docs-only PRs (A/D/E) need no bump if they land before U2; the U2 PR runs `npm run bump -- 2.10.0` (or the next minor the maintainer names).

## Definition of Done

Global:

- [x] All finding IDs mapped in Appendix are Done (U7 shipped in 3.0.0; H4 GitHub issue #1 closed 2026-08-27). Closed by 2.10 Lite + catalog/UX and 3.0 layout refuse / test split.
- [x] `npm run align` exits aligned (verified at land time; re-run after later engine edits).
- [x] No generated-only diffs (align ritual).
- [x] CHANGELOG recorded Lite + catalog/precedence (2.10.x archive; 3.0.0 test split).

Per unit: the unit’s Tests bullets pass; files in the unit’s Files list are the ones changed (no drive-by).

## Appendix

### Finding → unit map

| ID | Sev | Unit | Phase |
|---|---|---|---|
| H1 | high | U2 | B |
| H2 | high | U1 | A |
| H3 | high | U4 | D |
| H4 | high | U4 | D |
| M1 | medium | U1 | A |
| M2 | medium | U2 | B |
| M3 | medium | U3 | C |
| M4 | medium | U3 | C |
| M5 | medium | U7 | F |
| M6 | medium | U5 | D |
| M7 | medium | U1 | A |
| M8 | medium | U1 (Unreleased) + U4 (gstack) | A + D |
| M9 | medium | U6 | E |
| M10 | medium | U5 | D |
| M11 | medium | U3 | C |
| M12 | medium | U4 | D |
| L1 | low | U5 | D |
| L2 | low | U3 | C |
| L3 | low | U5 | D |
| L4 | low | U4 | D |
| L5 | low | U3 | C |
| L6 | low | U4 | D |

### What not to do (audit temptations)

- Do not prefix `/idea-intake` as `/midas-idea-intake` in this program.
- Do not add `.cursor/skills` at engine root to “match the old catalog sentence”; fix the sentence.
- Do not set engine `tools: [cursor]`; adapters for windsurf/gemini would stop being authored here.
- Do not implement Lite as “status overlay only” while `/plan-sprints` still hard-requires `market.md` / a missing `business-plan.md`.

### Plan audit — 2026-08-27 (pre-implementation)

Reviewed the plan against `plan-sprints`, `start-sprint`, `pipeline/8-audit-adjust.md`, dual `methodology.md`, and `VERSIONING.md` in the same session as the author (not independent). Findings folded into KTD1 / U2 / Verification above.

| ID | Sev | Plan defect | Resolution |
|---|---|---|---|
| P0 | high | U2 patched status/init only; `plan-sprints` Inputs still require `business-plan.md`; close-sprint playbook requires it; none mentioned lite/`market.md` | KTD1: lite writes a thin business-plan stub; market optional on lite in plan/start/close |
| P1 | medium | U2 tests were grep-on-status-body only; no fixture | `scripts/fixtures/product-lite/` |
| P1 | medium | `docs/methodology.md` + getting-started/README omitted from U2 files | listed |
| P1 | medium | `user-surface` fail would be a frontmatter MAJOR | warn + fill 38 |
| P1 | medium | H4 (`gh issue close`) treated as code DoD | human gate; docs note still required |
| P2 | low | Catalog test hardcoding 29/5/4 | compute from registry |
| P2 | low | L1 `updated:` only in U5; first landing PR would still look stale | acceptable; U5 still owns it, or stamp on whichever PR lands first |
| P2 | low | Lite is additive engine behavior | U2 PR is a MINOR bump |
