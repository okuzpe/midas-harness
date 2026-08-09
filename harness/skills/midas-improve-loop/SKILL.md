---
name: midas-improve-loop
description: "Deprecated alias — forwards to /midas-auto-pilot (unified autonomy guide). Not a separate loop."
user-invocable: true
disable-model-invocation: true
user-surface: deprecated
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[pr|code|local|cloud|stop|setup|status|dry-run|tick|resume] [interval]"
---

# midas-improve-loop — alias → `/midas-auto-pilot`

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.

**Forward:** execute the **`/midas-auto-pilot`** procedure with the **same arguments** (Mode gate / delivery gate / L3 sprint path as that skill defines). Never auto-`tick` from chat.

## Tier & delegation

- **Dispatch:** forward only → **build**. Same caps as `/midas-auto-pilot`.
