# Engine dogfood modes

| Mode | Where | What it proves |
|---|---|---|
| **Contributor / classic** | This repo (`layout: classic`) | Propagation, adapters, skill quality, installer tests |
| **Product install / harness** | `npx …#vX.Y.Z` → `.harness/` | Full 9-phase lifecycle on a real product |
| **Worked example** | `examples/taskpilot/` (legacy `.midas/` hub) | Closed sprint + audit in CI — see [V2-PATH-MAP.md](../examples/taskpilot/V2-PATH-MAP.md) |

The engine closes Phase 5 (`architecture_rules`) with artifacts under `product/`. It does **not**
run Phase 7–8 sprints on itself; that loop is demonstrated by TaskPilot + CI `--gates-only`.
