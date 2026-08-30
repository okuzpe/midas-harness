# ADR-007 — Canonical installed `.harness/` layout

- **Status:** accepted
- **Date:** 2026-07-26
- **Supersedes:** ADR-001 and ADR-006 for new installations
- **Amended:** 2026-08-30 — 3.0 refuses remaining 1.x trees ([ADR-018](./ADR-018-v1-layout-removal.md)); discriminator is `role` + `paths:` ([ADR-017](./ADR-017-role-and-paths.md)).

## Context

The classic, compact, and hub layouts made every command path-aware, left Midas files mixed with
application-owned `product/` and `scripts/`, and made updates responsible for distinguishing files by
location alone. Host discovery paths still have to remain outside any private engine directory.

## Decision

Engine source remains editable under `harness/` in this repository. Installed projects use one layout:

```text
.harness/
  engine/
  scripts/
  product/
  rules/
  runs/
  cache/
  migrations/{receipts,backups}/
  state.yaml
  manifest.json
```

Only selected-host discovery surfaces remain outside `.harness/`. They are generated mirrors or
marker-delimited adapters, never authored sources.

The ownership manifest classifies files as `vendor`, `generated`, or `user`. Updates replace intact
vendor files, update generated surfaces within their ownership boundary, and never replace user paths.
A vendor hash mismatch aborts before writing.

Migration from classic, compact, and hub was explicit in 2.x (`--migrate` / `--migrate --apply`).
**3.0 withdraws that path** (ADR-018): remaining 1.x trees are refused; migrate with create-midas@2.10.x first.

## Consequences

- New installs and all v2 writes resolve through `.harness/state.yaml`.
- `--update` never migrates a v1 installation (3.x refuses it outright).
- Classic/compact/hub layouts are unsupported product trees in 3.x (ADR-018).
- Node.js 22 is the minimum supported runtime.
- Root host surfaces are further constrained by ADR-008 (thin-root allowlist, default Cursor,
  `--update --tools`).
- The engine repository uses **classic** metadata (`layout: classic` in `harness/state.yaml`) for
  contributor path overrides — not a product install shape and not a Phase 0–8 ledger.
