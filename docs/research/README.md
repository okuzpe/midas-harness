# Research fixtures

Worked examples and CI fixtures live here — **not** under root `.harness/` (that folder is engine
dogfood **runs** only in this repo). These are full mini-projects for docs + gates.

| Fixture | Layout | Role |
|---|---|---|
| [`taskpilot/`](taskpilot/) | v2 `.harness/` | CI / doctor gate fixture — complete phase 0→8 sample |

Fresh product installs use `.harness/` at the project root (ADR-007). TaskPilot path map:
[`taskpilot/V2-PATH-MAP.md`](taskpilot/V2-PATH-MAP.md).

CI: `node scripts/doctor.mjs --strict --gates-only docs/research/taskpilot`.
