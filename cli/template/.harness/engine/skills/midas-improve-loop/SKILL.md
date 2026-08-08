---
name: midas-improve-loop
description: "Deprecated alias — use /midas-auto-pilot for continuous local product evolve. Not /midas-auto-sprints."
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[pr|code|local|cloud|stop] [interval]"
---

# midas-improve-loop — renamed

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.

**Verdict:** `redirect` — use **`/midas-auto-pilot`** (same args). Not `/midas-auto-sprints`.

## Tier & delegation

- **Dispatch:** redirect only → **build**. No tick, no `/loop` from this stub.
