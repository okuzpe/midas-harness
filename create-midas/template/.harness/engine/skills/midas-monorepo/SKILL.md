---
name: midas-monorepo
description: "DEPRECATED — use /midas-init --monorepo instead. Alias that runs monorepo wiring (nested AGENTS.md per package). Use only when an old doc/script still invokes /midas-monorepo."
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[--dry-run] [path/to/package ...]"
---

# midas-monorepo — deprecated alias

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md`.
> Prefer **`/midas-init --monorepo`** — works on both fresh and `setup_complete: true` projects.

Tell the user: *"`/midas-monorepo` is deprecated — run `/midas-init --monorepo` instead."*
Then follow **`<paths.engine>/pipeline/monorepo-wiring.md`** (DETECT → INDEX → WRITE).
Honor `--dry-run` and any user-named package paths. Requires `paths.state` to exist (`/midas-init` first if absent).

**Exit:** `monorepo-wiring.md` exit gate satisfied (or `--dry-run` plan shown with no writes). Next: `/midas-status`.
