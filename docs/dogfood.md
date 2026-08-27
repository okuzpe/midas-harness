# Engine repository vs product installs

This repository **authors** the Midas engine (`harness/`, `scripts/`, `cli/`). It does **not** run the
9-phase Midas lifecycle on itself.

| Mode | Where | What it proves |
|---|---|---|
| **Engine source** | This repo | Skills, rules, installer, adapters, `npm test`, doctor adapters |
| **Product install** | Another project’s `.harness/` | Full 9-phase lifecycle — **never** at this engine root |
| **Lifecycle CI fixture** | `scripts/fixtures/product-closed/` | Closed sprint + strict gates + bundle export |

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
| Product-shaped gates | `node scripts/doctor.mjs --strict --gates-only scripts/fixtures/product-closed` |

See `harness/rules/engine-repo-boundary.md`.

## Dual tool shape

Engine `harness/state.yaml` keeps `tools: [claude-code, cursor, windsurf, gemini]` so this repo can
**author** all four adapters. Fresh product installs default to `tools: [cursor]` (ADR-008). Do not
thin the engine list to match the install default — Windsurf/Gemini adapters would stop being
maintained here.
