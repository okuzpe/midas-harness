# Engine dogfood modes

| Mode | Where | What it proves |
|---|---|---|
| **Contributor / classic** | This repo (`layout: classic`) | Propagation, adapters, skill quality, installer tests, **engine MVP sprints** under `docs/product/sprints/` |
| **Product install / harness** | `npx …#vX.Y.Z` → **other** project’s `.harness/` | Full 9-phase lifecycle on a real product — **never** into this engine repo root |
| **Worked example** | `docs/research/taskpilot/` (`.harness/` layout) | Closed sprint + audit in CI — see [V2-PATH-MAP.md](research/taskpilot/V2-PATH-MAP.md) |

## Not “harness on harness”

This repository **authors** the engine in `harness/`. Root **`runs/`** here is dogfood evidence
(`paths.runs` in `harness/state.yaml`) — there is **no** `.harness/engine` product install and **no**
root `.harness/state.yaml`. `create-midas` (folder `cli/`, same npm name) **refuses** install/update/migrate
against this root (see `harness/rules/engine-repo-boundary.md`).

The engine closes Phase 5 (`architecture_rules`) with artifacts under `docs/product/`, then dogfoods
Phase 6–8 on itself for thin engine MVP work (sprints 01–03: autonomy CI smoke, `/midas-retro`,
installer update docs). Feature ledger: `docs/product/features.json` (F-001–F-003). Binding Phase-8
provenance for sprints 02–03 may still need orchestrate re-attestation (`audit-02`/`audit-03` drafts
are marked `un-attested`).

TaskPilot remains the **product-shaped** CI fixture (`doctor.mjs --strict --gates-only docs/research/taskpilot`).
