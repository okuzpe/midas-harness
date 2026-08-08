# Sprint retrospective retro-03

Ran: 2026-08-07 · Tier: build · Sprint: 03 · Status snapshot: done

## Went well
| # | Note | Evidence |
|---|------|----------|
| 1 | INSTALL.md documents conflicts + rebaseline with test anchors | § Updating an existing install; F-003 |
| 2 | Structural locks prevent silent doc regression | `install:update-docs:*` in `scripts/test.mjs` |
| 3 | Cross-link from repository-architecture | `docs/repository-architecture.md` Install layouts |

## Hurt
| # | Note | Evidence |
|---|------|----------|
| 1 | Binding audit still un-attested | `.harness/audits/audit-03.md` |
| 2 | Earlier README TaskPilot links used wrong layout (`.harness` vs `.midas`) | fixed in sweep-09 |

## Learned
| # | Takeaway | Capture candidate? |
|---|----------|--------------------|
| 1 | Cite exact `installer:*` check ids in user docs when documenting installer contracts | no — now locked by test |
| 2 | Legacy example paths need V2-PATH-MAP discipline in root README | no |

## Carry forward
| # | Item | Next home |
|---|------|-----------|
| 1 | Orchestrate re-attest audit-03 | `/close-sprint` |
| 2 | MVP feature work complete — next product work is backlog (midas-doc, etc.) | roadmap / gstack |

MIDAS_RETRO_RESULT: sprint=03 went_well=3 hurt=2 learned=2 carry=2 verdict=frozen
