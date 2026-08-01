# ADR-006 — Hub layout: product artifacts under `.midas/`

| Field | Value |
|---|---|
| **Status** | **historical** — superseded for new installs by [ADR-007](./ADR-007-canonical-harness-layout.md). Hub remains a **v1 migrate input** only. |
| **Date** | 2026-07-06 |
| **Supersedes** | ADR-001 rollout step 3 (default flip) — default was `hub`, not `compact` (1.x era) |
| **Superseded by** | ADR-007 (canonical `.harness/`), ADR-008 (thin-root allowlist) |
| **Related** | ADR-001 (compact), ADR-003 (memory model) |

> **Archaeology only.** New product installs do not use `layout: hub`. Detect + `--migrate` only.

## Context

ADR-001 introduced `compact` (engine under `.midas/`, `product/` at repo root). Users still see
`product/` beside tool adapters. The hub layout moves **product methodology artifacts** under
`.midas/product/` so the repo root holds only tool-mandated paths and optional app source trees.

Tool-mandated paths remain at root (ADR-001 table) — no change.

## Decision

Introduce **`layout: hub`** as the **default** for new installs (v1.0.0).

| Layout | Default | Product path | Engine |
|---|---|---|---|
| `classic` | legacy (`--layout=classic`) | `product/` | `harness/` |
| `compact` | legacy (`--layout=compact`) | `product/` | `.midas/engine/` |
| `hub` | **yes** | `.midas/product/` | `.midas/engine/` |

### G6 — keep three layouts (not deprecating compact yet)

`compact` remains supported through v1.x as “engine centralized, product at root” for teams that
want `.midas/` without moving markdown artifacts. Deprecation target: v2.0 (document only).

### Path resolution

- `paths.product` in `state.yaml` (written by installer on hub/compact/classic).
- Pipeline/skills use token **`{product}/`** — substitute with `paths.product` before I/O (like `{runs}/`).

### Detection order (`detectLayout`)

1. Read `layout:` from state file (`.midas/state.yaml` or `harness/state.yaml`) when present.
2. Else infer: `.midas/product/` exists → `hub`; `.midas/state.yaml` + root `product/` → `compact`;
   `harness/VERSION` → `classic`.

### Migration

- Never silent on `--update`.
- `node <paths.scripts>/migrate-layout.mjs --target=hub --apply` after dry-run.
- Rewrites `phases.*.artifacts`, `enforcement.config`, and markdown links `](product/` → `](.midas/product/`.

### Monorepo

`/midas-monorepo` indexes packages under `apps/*`; only the **root** Midas `product/` tree moves.
Nested packages keep their own manifests — no per-package `product/` unless the team adds one.

### ADR-003 memory model

LTM paths are **layout-relative**: `paths.product/*`, `paths.engine/rules/*`, `{runs}/*`. The canonical
portable bundle format keeps classic coordinates; import remaps per target layout.

## Consequences

- New installs: one visible dotdir `.midas/` for Midas-owned work (+ root adapters).
- Breaking change → semver **1.0.0**.
- `bundle.mjs`, `migrate-layout.mjs`, uninstall, and tests must understand three layouts.
