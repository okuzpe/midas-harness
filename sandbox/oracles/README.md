# Sandbox oracles

Deterministic disk checks for `/midas-sandbox`. The cheap Task does **not** grade itself.

```bash
node scripts/sandbox-run.mjs reset
node scripts/sandbox-run.mjs grade --skill idea-intake
# expected: verdict=fail (seed has not advanced Phase 0)
# after a real skill run:
node scripts/sandbox-run.mjs grade --skill idea-intake --ledger
```

| File | When |
|---|---|
| `isolation.json` | Always (merged into every `grade`) — env, fixture name, engine `state.yaml` + `harness/skills` + `harness/rules` hashes from reset |
| `<skill>.json` | When `--skill <skill>` (`/idea-intake` normalizes to `idea-intake`) |

`idea-intake.json` requires the Phase-0 **exit gate** (`stage: contextualize`,
`phases.idea_intake` passed, `{product}/idea.md` listed in `artifacts`, `{runs}/audits/gate-00.md`
with `MIDAS_GATE_RESULT: verdict=pass`) and fixture `state.yaml` / `updated` different from the
reset snapshot in `sandbox-baseline.json`. Template `<!-- TODO:` markers in the raw/pitch sections
must be gone (`pitch-not-todo`, `raw-not-todo`). Default seed already has a filled idea — use
`reset --profile capture` (`--blank-idea` / `--empty-idea`) when the lab should certify capture.

`contextualize.json` is the Phase-1 delta: `## Contextualized`, `{product}/open-questions.md` in
artifacts, `stage: market_research`, `gate-01.md` with a pass verdict. After `reset` that grade
**must fail**.

`market-research.json` and `business-plan.json` grade procedure fidelity against
`templates/market.md` / `templates/business-plan.md` headings plus `gate-02.md` / `gate-03.md`.
Cheap-model judgment on the toy idea is not the oracle — headings, artifacts, and gate freeze are.
After `reset` those grades **must fail**.

`choose-architecture.json`, `define-conventions.json`, and `plan-sprints.json` grade Phases 4–6 the
same way against `templates/architecture.md`, `design-direction.md` / `folder-structure.md`, and
`templates/roadmap.md` plus `gate-04.md`…`gate-06.md`. After `reset` those grades **must fail**.

`{product}` `{state}` `{runs}` `{rules}` `{cache}` expand from the fixture `paths.*`.
Paths that resolve outside `sandbox/example-product/` fail closed.

`--ledger` appends one JSON line to `sandbox/findings/_ledger.jsonl` (opt-in so `npm test` does not pollute it). Lines include `fail_ids`.

`--missing skip` treats a **missing** skill oracle file as ok (isolation still fail-closes).
Invalid JSON is always a fail. Default is `--missing fail`.
