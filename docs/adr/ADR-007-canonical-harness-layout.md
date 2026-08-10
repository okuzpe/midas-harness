# ADR-007 — Canonical installed `.harness/` layout

- **Status:** accepted
- **Date:** 2026-07-26
- **Supersedes:** ADR-001 and ADR-006 for new installations

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

Migration from classic, compact, and hub is explicit. `--migrate` is read-only; `--migrate --apply`
builds the target in external staging, rejects collisions, verifies hashes, and rolls back on any
failure. Unknown application files under legacy `product/` or `scripts/` remain in place.

## Consequences

- New installs and all v2 writes resolve through `.harness/state.yaml`.
- `--update` never migrates a v1 installation.
- Classic/compact/hub layouts remain detectable and migratable under the harness layout.
- Node.js 22 is the minimum supported runtime.
- Root host surfaces are further constrained by ADR-008 (thin-root allowlist, default Cursor,
  `--update --tools`).
- The engine repository uses **classic** metadata (`layout: classic` in `harness/state.yaml`) for
  contributor path overrides — not a product install shape and not a Phase 0–8 ledger.
