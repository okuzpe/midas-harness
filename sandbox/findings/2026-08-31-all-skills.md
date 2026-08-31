# Sandbox findings — catalog sweep (`--all`)

2026-08-31 · continuation of [phases 0–4](./2026-08-31-phases-0-4.md) + [phases 5–6](./2026-08-31-phases-5-6.md) (no reset — working copy already through Phase 6 / `sprint_execution`) · 34 of 35 `harness/skills/*` live-run; **`midas-sandbox` skipped** (do not recurse)

## Setup

- Engine: `midas-harness` 3.0.1
- Isolation: reused dirty `sandbox/example-product/` after 0–6 (reset would wipe pipeline artifacts). `name: sandbox-example`. `env` hashes of `harness/skills` + `harness/rules` still matched the capture-reset baseline after the last grade.
- Trace: `start-run` `session_id=a21436796187` `run_id=1f42b88043b5` · `MIDAS_TRACE_ROOT=C:\Users\AfterMe\Desktop\Harness\sandbox\example-product`
- `finish` exit 0 with the same session/run ids.
- Task model: `composer-2.5` (not `-fast`); in-process skill; no nested Task; no `doctor --fix`
- First Read (all Tasks): fixture `name=sandbox-example`

Catalog Tasks (this run):

| Skill | Task |
|---|---|
| midas-status | [status](e1e2e0df-0cbf-42da-94bb-cb3edcbd8729) |
| midas-recall | [recall](f6de8f21-a130-4f0c-9120-a4551257bf69) |
| midas-help | [help](62364e4c-5851-4260-8cd9-1b12e80bb186) |
| midas-doctor | [doctor](06b97b7e-6c46-466f-814e-1c939c639d95) |
| midas-init | [init](1ec811b3-82fd-4b6d-949e-27df91e351e0) |
| midas-adopt | [adopt](174ce81e-bcbb-4a61-88e7-8df33a780acc) |
| start-sprint | [kickoff](f15afc14-79cf-4f11-8234-f0cea7641205) |
| close-sprint | [close](cd70743c-4a17-495b-ad4b-6e178d80677f) |
| midas-verify | [verify](d166e636-dfa2-45ed-ad24-bf29d4e9e5fb) |
| midas-progress | [progress](9b6e7f2f-fd5d-4422-ac5b-3efca19b8be7) |
| midas-qa | [qa](daf771fc-2a5d-43d2-9bd7-8fbc3b3aa503) |
| midas-diff-gates | [diff-gates](3c910cc9-0c54-4c50-8741-20345716a29f) |
| midas-retro | [retro](b5bdbe9f-cb72-41ca-9f02-6514f2ca3252) |
| midas-investigate | [investigate](3598ec5a-8772-4059-b5b3-32d7e985e49c) |
| midas-design | [design](0cecc6aa-45bc-47df-9237-4abe9fa673dd) |
| midas-capture | [capture](1629c5f5-4779-44a9-b0a0-71401fc87f77) |
| midas-hygiene | [hygiene](fcdbcdb1-ae8b-4cb5-b276-9c213c5f9749) |
| midas-sweep | [sweep](7d0ece5a-9c11-4bd6-96da-c990ecc57d91) |
| midas-lean-review | [lean](854a9c9d-37fa-42a6-a115-94cadcc2b7b5) |
| midas-explore | [explore](30c7ca41-3e34-4a05-9e70-91e05881c532) |
| midas-bundle | [bundle](ec75e5a4-9e50-4ff3-a233-bdfaa7546baa) |
| midas-tribunal | [tribunal](b5367fdd-b882-4866-b58a-800b3b69c679) |
| midas-security-audit | [security](ee8f9d95-d4f2-45da-80af-cce2e4b18b7a) |
| midas-auto-pilot | [auto-pilot](62342757-7286-46dc-823d-d24ba7ebea66) |
| midas-align | [align](3c6b63bb-74b5-4b17-b32b-c4a46f65fe2b) |
| midas-precommit | [precommit](06ff3742-ee8c-4a96-bb2b-6fd9bedaa5de) |

Prior pipeline Tasks (separate traces, already graded): idea-intake, contextualize, market-research, business-plan, choose-architecture, define-conventions, plan-sprints, midas-reconcile (`--profile install`).

Grades this run (`--missing skip` — no per-skill oracle YAML for catalog skills). Isolation hashes passed after every Task:

```
MIDAS_SANDBOX_ORACLE: skill=midas-status isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-recall isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-help isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-doctor isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-init isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-adopt isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=start-sprint isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=close-sprint isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-verify isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-progress isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-qa isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-diff-gates isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-retro isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-investigate isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-design isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-capture isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-hygiene isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-sweep isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-lean-review isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-explore isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-bundle isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-tribunal isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-security-audit isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-auto-pilot isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-align isolation=ok … verdict=pass
MIDAS_SANDBOX_ORACLE: skill=midas-precommit isolation=ok … verdict=pass
```

Pipeline oracles (0–6) already `verdict=pass` in the earlier findings files.

## Decision-flow log

- `[SANDBOX AUTO-DECISION] midas-help intent -> Resume after a break (catalog; fixture already at sprint_execution)`
- `[SANDBOX AUTO-DECISION] Confirm start sprint 01? -> yes (next planned sprint after Phase 6)`
- `[SANDBOX AUTO-DECISION] evolve vs sprint -> status tick (sandbox catalog, no autonomy / no /loop)`

Catalog outcomes (this working copy at `stage: sprint_execution`, sprint 01 kickoff-only, **no app `src/`**):

| Skill | Outcome | Class |
|---|---|---|
| midas-status | next `/start-sprint` | — |
| midas-recall | brief → `/start-sprint 01` | — |
| midas-help | printed Resume-after-break | — |
| midas-doctor | `doctor.mjs` **no --fix**; missing Cursor adapters; exit 1 | fixture-limit |
| midas-init | diagnose **`partial_migrate`** (seed has product/state, no `.harness/engine`); STOP | fixture-limit |
| midas-adopt | greenfield STOP → `/idea-intake` | fixture-limit |
| start-sprint | kickoff; 01 `active`; working plan + progress | — |
| close-sprint | STOP (work not landed) | fixture-limit |
| midas-verify | 4 criteria `blocked`; froze `verify-01.md` | fixture-limit |
| midas-progress | STOP (no session delta / proof) | fixture-limit |
| midas-qa | STOP (no app / tests) | fixture-limit |
| midas-diff-gates | skip (no production-path diff) | fixture-limit |
| midas-retro | STOP (01 `active`, not `done`) | fixture-limit |
| midas-investigate | STOP (no symptom) | fixture-limit |
| midas-design | STOP (no coded UI) | fixture-limit |
| midas-capture | STOP (no recurring pattern) | fixture-limit |
| midas-hygiene | report-only sweep; 1 ledger-drift + 3 stale-doc | — |
| midas-sweep | no dead-flows; froze `sweep-01.md` | fixture-limit |
| midas-lean-review | STOP (no app diff) | fixture-limit |
| midas-explore | froze notes: no runnable Vite after kickoff | — |
| midas-bundle | export 29 files → `.harness/cache/midas-bundle-export.json` | — |
| midas-tribunal | STOP (refused abbreviated fake verdict) | fixture-limit |
| midas-security-audit | docs-only STRIDE; scanners skipped | fixture-limit |
| midas-auto-pilot | autonomy `present: false`; tick not run | fixture-limit |
| midas-align | `--scope product` report-only; `gaps=11` | fixture-limit |
| midas-precommit | ABORT engine-only from product root | fixture-limit |
| midas-sandbox | **not run** | — |

Writers stayed inside `sandbox/example-product/`. Engine `harness/skills` and `harness/rules` untouched.

## Issues found

1. **harness-gap** — `/start-sprint` sets `paths.state` sprint status to `active` but does not update `{product}/roadmap.md` Status (still `planned`). `/midas-hygiene` then reports `ledger-drift`. Duplicate status: state is the ritual source of truth; the roadmap table has no writer in start-sprint or close-sprint.
2. **model-miss** — hygiene labeled that row `ledger-drift`. Sweep’s taxonomy defines ledger-drift as missing sprint files / `features.json` evidence holes, not Status-column mismatch. The dual-write is real; the category name is not.
3. **fixture-limit** — Pipeline seed (`paths.engine=../../harness`, no `.harness/engine`) makes `/midas-init` diagnose `partial_migrate`. Real diagnose is already covered by `--profile install` (`setup_pending`). Same seed cannot honestly `doctor --fix` / re-render adapters.
4. **fixture-limit** — No app source after kickoff, so close / verify / qa / progress / lean / design / investigate / capture / tribunal / security-code / auto-pilot tick correctly STOP or skip. Not missing abort text.
5. **fixture-limit** — Parallel catalog Tasks (`hygiene` + `sweep`) both wrote `{runs}/sweeps/sweep-01.md`. Last writer wins. Lab process, not a product race.
6. **isolation-bug (mitigated)** — Cursor Task still has no cwd/env pin. Workaround: `{work}/.harness/cache/sandbox-env.json`. Cannot close from this repo.

## Proposed improvements (not applied)

1. `/start-sprint` and `/close-sprint`: update the matching `{product}/roadmap.md` Status cell (`planned` → `active` → `done`), **or** document that Status is a Phase-6 snapshot and teach hygiene not to flag it.
2. Cursor Task cwd + env pin (unchanged residual).
3. Optional: a Phase-7 fixture profile with a landed Vite slice so close / verify / qa / lean can run bodies instead of STOP.

## Harness analysis

Preconditions and When NOT held: no skill faked a pass audit, invented tests, or wrote engine source. `/midas-tribunal` refused a thin fake verdict (correct). `/midas-precommit` aborted outside the engine repo (correct). `/midas-init` on the pipeline seed is `partial_migrate` by layout, not a diagnose regression (install profile remains `setup_pending`).

The only capture/ADR candidate from this sweep is the **roadmap Status dual-write** after kickoff. Everything else that STOPped is the toy fixture having no app, no failure, no autonomy, and no vendor install tree.

```
MIDAS_SANDBOX_RESULT: skill=midas-status,midas-recall,midas-help,midas-doctor,midas-init,midas-adopt,start-sprint,close-sprint,midas-verify,midas-progress,midas-qa,midas-diff-gates,midas-retro,midas-investigate,midas-design,midas-capture,midas-hygiene,midas-sweep,midas-lean-review,midas-explore,midas-bundle,midas-tribunal,midas-security-audit,midas-auto-pilot,midas-align,midas-precommit mode=all verdict=pass auto_decisions=3 isolation=ok
```
