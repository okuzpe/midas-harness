---
name: midas-autopilot
description: "Deprecated alias — use /midas-auto-sprints for ADR-009 sprint checklist ticks. CLI remains midas-autopilot.mjs. Not /midas-auto-pilot."
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[setup|status|dry-run]"
---

# midas-autopilot — renamed

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.

**Verdict:** `redirect` — use **`/midas-auto-sprints`**. CLI: `midas-autopilot.mjs`. Not `/midas-auto-pilot`.

## Tier & delegation

- **Dispatch:** redirect only → **build**. Never auto-`tick` from this stub.
