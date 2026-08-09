---
name: midas-auto-sprints
description: "Deprecated alias — forwards to /midas-auto-pilot (sprint checklist path). Bare invoke defaults intent=sprints. CLI remains midas-autopilot.mjs."
user-invocable: true
disable-model-invocation: true
user-surface: deprecated
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[setup|status|dry-run|tick|resume]"
---

# midas-auto-sprints — alias → `/midas-auto-pilot`

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.

**Forward:** execute the **`/midas-auto-pilot`** procedure with the **same arguments**.

- Bare invoke (no args): skip Mode gate; intent=`sprints` → open `<paths.engine>/skills/midas-auto-pilot/sprint-checklist.md` (setup default).
- Args `setup|status|dry-run|tick|resume`: same L3 path (short-circuit).
- Evolve args (`pr|code|local|cloud|stop`): honor them via the unified skill (no extra Ask for Mode).

CLI unchanged: `midas-autopilot.mjs`. Never auto-`tick` from chat.

## Tier & delegation

- **Dispatch:** forward only → **build**. Same caps as `/midas-auto-pilot`.
