<!-- Phase 6 — Roadmap artifact. Orchestrator sequences; covers MVP scope only.
     Exit gate: roadmap covers MVP (business-plan.md scope) only, each sprint has a goal +
     acceptance criteria + DoD referencing rules, dependencies ordered. -->

# Roadmap — {{PROJECT_NAME}}

## MVP definition (from business-plan.md)

<!-- TODO: paste / reference the MVP scope list from business-plan.md so gate audits can cross-check -->

- …

## Sprint sequence

<!-- Each sprint references its detail file at product/sprints/NN-<slug>.md.
     Ordering must respect technical dependencies (e.g. infra before features, auth before protected routes). -->

| Sprint | Title | Goal | Depends on | Status |
|---|---|---|---|---|
| 01 | <!-- TODO: slug --> | <!-- TODO: one-line goal --> | — | planned |
| 02 | <!-- TODO: slug --> | <!-- TODO: one-line goal --> | 01 | planned |
| 03 | <!-- TODO: slug --> | <!-- TODO: one-line goal --> | 02 | planned |

## Dependency notes

<!-- TODO: note any external dependencies (third-party APIs, design deliverables, human approvals)
     that could block a sprint, and which sprint they affect -->

- …

## Out of scope (v1 non-goals)

<!-- TODO: mirror the non-goals from business-plan.md — explicit, so sprint planning doesn't drift -->

- …

## Success metrics reminder

<!-- TODO: copy from business-plan.md — the audit in Phase 8 will check these are still targeted -->

| Metric | Target | Sprint where measurable |
|---|---|---|
| … | … | … |

---

*Gate check: MVP scope covered ✓, each sprint has goal + acceptance + DoD ✓, deps ordered ✓.*
*Next: run `/start-sprint 01` (Phase 7).*
