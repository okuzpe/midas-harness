# Engine repository vs product installs

This repository **authors** the Midas engine (`harness/`, `scripts/`, `cli/`). It does **not** run the
9-phase Midas lifecycle on itself.

| Mode | Where | What it proves |
|---|---|---|
| **Engine source** | This repo | Skills, rules, installer, adapters, `npm test`, doctor adapters |
| **Product install** | Another project’s `.harness/` | Full 9-phase lifecycle — **never** at this engine root |
| **Lifecycle demo (CI)** | `docs/research/taskpilot/` | Closed sprint + strict gates — see [V2-PATH-MAP.md](research/taskpilot/V2-PATH-MAP.md) |

## Not “harness on harness”

- **No** root `.harness/state.yaml` or `.harness/engine/` — installer refuses this root.
- `harness/state.yaml` holds **contributor metadata** (version, routing, path overrides) — not a Phase 0–8 ledger.
- `docs/product/` is a **stub** explaining that product lifecycle docs live in installs, not here.
- `runs/cache/` (gitignored) is **Trace observe** tooling for contributors — not committed audit/sprint evidence.

## Verification

| Check | Command |
|---|---|
| Structural tests | `node scripts/test.mjs` |
| Adapter health | `node scripts/doctor.mjs` |
| Product-shaped gates | `node scripts/doctor.mjs --strict --gates-only docs/research/taskpilot` |

See `harness/rules/engine-repo-boundary.md`.
