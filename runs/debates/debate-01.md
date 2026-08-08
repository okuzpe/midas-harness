# Tribunal debate-01 — scope: findings + plan — depth: standard
Convened: 2026-06-30 · Judge: midas-orchestrator · cost_profile: balanced

## Verdict tally
UPHELD: 10 (HIGH 2 · MED 5 · LOW 3) · REJECTED: 0 · AMENDED: 3 · DISSENTS: 2
MIDAS_TRIBUNAL_RESULT: criticals=0 highs=2

## Ranked findings (severity × confidence)

| ID | Severity | Claim | Verdict | Action |
|----|----------|-------|---------|--------|
| T-01 | HIGH | `build-create.mjs` can bundle engine `harness/state.yaml` | UPHELD | fix — HARNESS_EXCLUDE |
| T-03 | HIGH | TaskPilot verify cites missing `[id]/route.test.ts` | UPHELD | fix — add tests |
| T-02 | MED | CI does not enforce gate records on worked example | UPHELD | fix — `--strict --gates-only` |
| T-04 | MED | Phase gate `audit-0N` collides with sprint `audit-NN` | UPHELD | fix — rename to `gate-0N` |
| T-06 | MED | Phase 6 never seeds `product/features.json` | UPHELD | fix — pipeline + skill |
| T-07 | MED | Phase 0 assigns writes to read-only scout | UPHELD | fix — midas-builder |
| T-08 | MED | CHECK digest false positives + truncation | UPHELD | fix — extractCheckLines |
| T-05 | LOW | Missing `execution_mode` in state seeds | UPHELD | fix — seed `cloud` |
| T-09 | LOW | `adapters.hash` comment misleading | UPHELD | fix — comment only |
| T-10 | LOW | `STATE.md` referenced but absent | UPHELD | fix — remove refs |

## Minority / dissent
- **T-04 (Catfish):** Rename scope constrained to phase gate filenames only; do not alter doctor sprint parsing.
- **P2 polish (Simplifier):** Delegation prose and install README deferred unless blocking correctness.

## Recommended actions (applied in this sprint)
- T-01 through T-10 + P1b handoff fixes implemented per plan.
- CI: `doctor.mjs --strict --gates-only examples/taskpilot` + `mkdocs build --strict`.

## Full transcript (appendix)
See session tribunal audit of the six-flow investigation and plan review (2026-06-30). Key amendment:
`doctor --strict examples/taskpilot` would fail without `--gates-only` because the partial example lacks generated adapters.
