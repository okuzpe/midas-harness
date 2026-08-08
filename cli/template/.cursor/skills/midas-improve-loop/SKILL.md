---
name: midas-improve-loop
description: Deprecated alias — use /midas-auto-pilot for continuous local product evolve. Not /midas-auto-sprints.
metadata:
  midas-argument-hint: "[pr|code|local|cloud|stop] [interval]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-improve-loop — renamed

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.

**Verdict:** `redirect` — use **`/midas-auto-pilot`** (same args). Not `/midas-auto-sprints`.

## Tier & delegation

- **Dispatch:** redirect only → **build**. No tick, no `/loop` from this stub.
