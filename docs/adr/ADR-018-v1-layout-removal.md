# ADR-018 — v1 layouts removed in 3.0

- **Status:** accepted
- **Date:** 2026-08-30
- **Related:** ADR-007 (canonical `.harness/`), ADR-017 (`role` + `paths`), `harness/migrations/v3.0.md`

## Context

2.x kept classic / compact / hub as read/migrate-only inputs. `update` on a 1.x tree silently
promoted to `--migrate --apply`. Removing that promotion without a guard would overlay `.harness/`
on a classic tree.

## Decision

3.x **refuses** 1.x product trees: `update`, `--migrate`, and uninstall on classic/compact/hub exit
non-zero, print a pin-2.10.x message, and write nothing. Diagnose status is `unsupported_v1`.

Migrators deleted: `scripts/migrate-layout.mjs`, `cli/migrate-harness.mjs`,
`cli/lib/steps/migrate.mjs`. `scripts/lib/migrate-state.mjs` stays (field ledger).

Users still on 1.x migrate with `create-midas@2.10.x`, then upgrade to 3.x.

## Consequences

Installer tests assert refuse + zero writes on v1 fixtures. Hybrid classic fixtures were rewritten
to v2 `role: product`.
