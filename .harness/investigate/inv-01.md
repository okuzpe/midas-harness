# Investigation inv-01

Ran: 2026-08-07 · Tier: build · Topic: dogfood — ship `/midas-investigate` skill wiring

## Symptoms
| # | Observable | Source |
|---|------------|--------|
| 1 | gstack `/investigate` gap still open after safety-guardrails | `docs/gstack-comparison.md` §6.1 |

## Flow
| Step | Where | Note |
|------|-------|------|
| 1 | `docs/gstack-comparison.md` | Adoptar `/midas-investigate` |
| 2 | `harness/skills/` | No skill directory |
| 3 | Phase-7 self-fix bound | Needed Iron Law freeze path |

## Hypotheses
| # | Hypothesis | Status | Falsify by |
|---|------------|--------|------------|
| 1 | Shipping skill + template + playbook closes the gap | confirmed | catalog + registry + tests |

## Evidence
| # | Finding | Supports / rejects |
|---|---------|-------------------|
| 1 | Skill + `investigate-record.md` + `debug-root-cause.md` on disk | H1 |

## Strikes (failed fixes — stop at 3)
| # | Attempt | Result |
|---|---------|--------|
| — | none | first-pass ship |

## Next
- [x] Proposed fix: ship `/midas-investigate` (this record is the dogfood freeze)
- [ ] Stop / ask human (strikes ≥ 3 or blocked)
- [x] Regression proof plan: `dogfood:midas-investigate:*` structural tests

MIDAS_INVESTIGATE_RESULT: id=01 hypotheses=1 strikes=0 verdict=frozen
