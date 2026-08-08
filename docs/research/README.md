# Research fixtures

Worked examples and CI fixtures live here — full mini-projects for docs + gates.

| Fixture | Layout | Role |
|---|---|---|
| [`taskpilot/`](taskpilot/) | v2 `.harness/` | CI / doctor gate fixture — complete phase 0→8 sample |

Fresh product installs use `.harness/` at the project root (ADR-007). The engine repo itself does
**not** run the lifecycle — TaskPilot is the product-shaped proof. Path map:
[`taskpilot/V2-PATH-MAP.md`](taskpilot/V2-PATH-MAP.md).

CI: `node scripts/doctor.mjs --strict --gates-only docs/research/taskpilot`.
