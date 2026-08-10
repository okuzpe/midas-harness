# Migration — unified `/midas-auto-pilot`

Editor slash unification for continuous evolve + ADR-009 sprint checklist guide.
**Controller CLI unchanged:** `node .harness/autonomy/bin/midas-autopilot.mjs`.

## What changed

| Before | After |
|---|---|
| `/midas-auto-pilot` = evolve only; `/midas-auto-sprints` = sprint guide | `/midas-auto-pilot` = Mode Ask (evolve \| sprint \| stop \| sprint status) |
| Sprint procedure in `midas-auto-sprints/SKILL.md` | L3 `midas-auto-pilot/sprint-checklist.md` |
| `/midas-auto-sprints`, `/midas-autopilot`, `/midas-improve-loop` as separate guides/redirects | Forward stubs → `/midas-auto-pilot` (bare `/midas-auto-sprints` → intent=`sprints`) |

## Install / update steps

1. `npx … --update` (or refresh engine skills) so mirrors pick up the unified skill + L3.
2. Prefer `/midas-auto-pilot` for both planes; optional args: `pr|code|local|cloud|stop|setup|status|dry-run|tick|resume`.
3. ADR-009 users: `/midas-auto-pilot setup` (or bare `/midas-auto-sprints`) then human-confirmed `tick` via CLI.
4. No change to `{runs}/auto-pilot/` journal/runbook paths or CLI authz.

## Anti-typo

| Token | Role |
|---|---|
| `/midas-auto-pilot` | Canonical unified guide |
| `/midas-auto-sprints` | Alias → unified (bare → sprint path) |
| `midas-autopilot.mjs` | ADR-009 CLI |
| `/midas-autopilot` / `/midas-improve-loop` | Alias → unified |
