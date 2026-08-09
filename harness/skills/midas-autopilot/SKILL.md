---
name: midas-autopilot
description: "Deprecated alias — forwards to /midas-auto-pilot (unified autonomy guide). CLI remains midas-autopilot.mjs."
user-invocable: true
disable-model-invocation: true
user-surface: deprecated
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[pr|code|local|cloud|stop|setup|status|dry-run|tick|resume] [interval]"
---

# midas-autopilot — alias → `/midas-auto-pilot`

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.

**Forward:** execute the **`/midas-auto-pilot`** procedure with the **same arguments** (Mode gate / delivery gate / L3 sprint path as that skill defines). CLI: `midas-autopilot.mjs`. Never auto-`tick` from chat.

## Tier & delegation

- **Dispatch:** forward only → **build**. Same caps as `/midas-auto-pilot`.
