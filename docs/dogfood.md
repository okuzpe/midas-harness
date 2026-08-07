# Engine dogfood modes

| Mode | Where | What it proves |
|---|---|---|
| **Contributor / classic** | This repo (`layout: classic`) | Propagation, adapters, skill quality, installer tests, **engine MVP sprints** under `product/sprints/` |
| **Product install / harness** | `npx …#vX.Y.Z` → `.harness/` | Full 9-phase lifecycle on a real product |
| **Worked example** | `examples/taskpilot/` (legacy `.midas/` hub) | Closed sprint + audit in CI — see [V2-PATH-MAP.md](../examples/taskpilot/V2-PATH-MAP.md) |

The engine closes Phase 5 (`architecture_rules`) with artifacts under `product/`, then dogfoods
Phase 6–8 on itself for thin engine MVP work (sprints 01–03: autonomy CI smoke, `/midas-retro`,
installer update docs). Feature ledger: `product/features.json` (F-001–F-003). Binding Phase-8
provenance for sprints 02–03 may still need orchestrate re-attestation (`audit-02`/`audit-03` drafts
are marked `un-attested`).

TaskPilot remains the **product-shaped** CI fixture (`doctor.mjs --strict --gates-only examples/taskpilot`).
