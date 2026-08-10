---
name: midas-update
description: "Deprecated alias — forwards to /midas-init (diagnose → tip pinned --update when version/layout behind)."
user-invocable: true
disable-model-invocation: true
user-surface: deprecated
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[--dry-run]"
---

# midas-update — alias → `/midas-init`

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.

**Forward:** execute the **`/midas-init`** procedure (diagnose → tip pinned `--update` when version/layout behind). Do not invent a parallel refresh plan. The install CLI remains source of truth for `--update`.

## Tier & delegation

- **Dispatch:** forward only — same caps as `/midas-init`.
