# ADR-017 — `role:` + `paths:` as install discriminator

- **Status:** accepted
- **Date:** 2026-08-30
- **Supersedes:** the dual use of `layout:` as both v1 geography and “is this the engine repo?”

## Context

`layout: classic | compact | hub | harness` named 1.x product trees **and** told doctor/cache/bundle
whether the cwd was the engine repository (`classic` contributor map) or a product install
(`harness`). That overload blocked deleting v1 without also deleting the engine path model.

## Decision

State carries `role: engine | product`. `paths:` is the only source of truth for on-disk locations
(defaults: engine = `harness/` + `scripts/` + `runs/`; product = `.harness/…`).

`layout:` is a **derived alias** only: `engine` → `classic`, `product` → `harness`. Adapter writers
may still branch on it for `CLAUDE.md` vs `.claude/CLAUDE.md`. New code that means “is this an
install?” must read `role === 'product'` (or `detectRole()`).

The engine repo declares `role: engine` in `harness/state.yaml` and is **not** a v1 product tree.

## Consequences

Doctor `--fix`, cache roots, manifest/root-allowlist, and installer “already installed” guards
key off `role`, not `layout === 'harness'`.
