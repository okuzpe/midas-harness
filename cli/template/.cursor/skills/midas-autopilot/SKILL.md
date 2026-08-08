---
name: midas-autopilot
description: Deprecated alias — use /midas-auto-sprints for ADR-009 sprint checklist ticks. CLI remains midas-autopilot.mjs. Not /midas-auto-pilot.
metadata:
  midas-argument-hint: "[setup|status|dry-run]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-autopilot — renamed

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.

**Verdict:** `redirect` — use **`/midas-auto-sprints`**. CLI: `midas-autopilot.mjs`. Not `/midas-auto-pilot`.

## Tier & delegation

- **Dispatch:** redirect only → **build**. Never auto-`tick` from this stub.
