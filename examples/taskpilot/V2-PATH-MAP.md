# TaskPilot → v2 `.harness/` path map

TaskPilot remains on the legacy **hub** layout (`.midas/`) as a CI gate fixture. Fresh installs use
v2 **`.harness/`**. Use this map when reading the example against a current install.

| Legacy (TaskPilot) | v2 install |
|---|---|
| `.midas/state.yaml` | `.harness/state.yaml` |
| `.midas/product/` | `.harness/product/` |
| `.midas/engine/` | `.harness/engine/` |
| `.midas/scripts/` | `.harness/scripts/` |
| `.midas/audits/` | `.harness/runs/audits/` |
| `.midas/sprints/` | `.harness/runs/sprints/` |
| `.midas/debates/` | `.harness/runs/debates/` |
| `.midas/verifications/` | `.harness/runs/verifications/` |

CI: `node scripts/doctor.mjs --strict --gates-only examples/taskpilot`.

Full migrate of this fixture to `.harness/` is deferred until a dedicated sprint (paths are wired
deep into cited verify/audit evidence).
