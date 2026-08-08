# TaskPilot path map (v2)

TaskPilot uses the canonical v2 **`.harness/`** layout (migrated from legacy hub `.midas/`).

| Path | Role |
|---|---|
| `.harness/state.yaml` | Lifecycle state |
| `.harness/product/` | Phase artifacts + Sprint-1 code slice |
| `.harness/engine/` | Vendored engine (from template) |
| `.harness/scripts/` | Vendored scripts (from template) |
| `.harness/rules/` | Phase-5 stack rule overlays |
| `.harness/runs/audits/` | Frozen audits |
| `.harness/runs/sprints/` | STM progress logs |
| `.harness/runs/debates/` | Tribunal / debate records |
| `.harness/runs/verifications/` | `/midas-verify` records |

CI: `node scripts/doctor.mjs --strict --gates-only docs/research/taskpilot`.

Historical hub → v2 move used `cli/migrate-v2.mjs` (then named `create-midas/migrate-v2.mjs`;
full `.midas/product/` tree + stack
rules extracted to `.harness/rules/`). Leftover vendored engine-repo scripts under `.midas/scripts/`
were dropped — not part of the fixture contract.
