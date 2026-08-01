---
name: midas-monorepo
description: DEPRECATED — removed in 2.1.0. Use /midas-init --monorepo instead. Alias that runs monorepo wiring (nested AGENTS.md per package).
metadata:
  midas-argument-hint: "[--dry-run] [path/to/package ...]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-monorepo — deprecated alias (remove in 2.1.0)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md`.
> **Removed in Midas 2.1.0.** Prefer **`/midas-init --monorepo`** now.

Tell the user verbatim: *"`/midas-monorepo` is deprecated and will be removed in 2.1.0 — run `/midas-init --monorepo` instead."*
Then follow **`<paths.engine>/pipeline/monorepo-wiring.md`** (DETECT → INDEX → WRITE).
Honor `--dry-run` and any user-named package paths. Requires `paths.state` (`/midas-init` first if absent).

## Tier & delegation
- **Dispatch + nested AGENTS.md writes:** `build` → `midas-builder`.
- Package/tree indexing → `scout` (`midas-scout`).
- Prefer `/midas-init --monorepo` (same legs) over this alias.

**Exit:** `monorepo-wiring.md` exit gate satisfied (or `--dry-run` plan shown). Next: `/midas-status`.
