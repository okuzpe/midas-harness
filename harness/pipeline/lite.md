# Midas Lite track — 3-phase fast path

**Track:** `lite` in `harness/state.yaml` (alternative to `full`)

Use Lite for prototypes, hackathons, and small MVPs where the full 0–8 market/business/tribunal
ceremony is overhead. Full track remains the default for production products.

## Lite phases (mapped to full phases)

| Lite step | Full phases merged | Skill / command |
|-----------|-------------------|-----------------|
| **Idea + Plan** | 0–6 (idea, contextualize, market*, business*, architecture, rules, sprint plan) | `/midas-init` (lite) then guided single pass: capture idea, minimal architecture, freeze lean rules, one sprint plan |
| **Execute** | 7 | `/start-sprint` |
| **Audit** | 8 | `/close-sprint` |

\* Market and business phases are **skipped by default** in Lite; record assumptions in `state.yaml`.
Tribunal is optional, not default.

## Entry

During `/midas-init`, when the user selects `track: lite`:

1. Set `track: lite` in `harness/state.yaml`.
2. Set `entry_stage: sprint_planning` after the Idea+Plan pass completes (or `sprint_execution` if a plan exists).
3. Record skipped gates with assumptions (market_research, business_case, etc.).

## Exit

Same as full track: final `/close-sprint` may set `stage: shipped` when MVP metrics are met.

## When not to use Lite

- Regulated domains, multi-team products, or repos needing adversarial market validation.
- Brownfield E3 repos with existing CI/rules — use full track or `/midas-adopt` instead.
