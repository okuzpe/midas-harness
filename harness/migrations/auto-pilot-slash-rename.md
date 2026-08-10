# Migration — auto-pilot slash rename

Slash and evidence-path rename for continuous improve + ADR-009 editor guide.
**Controller CLI unchanged:** `node .harness/autonomy/bin/midas-autopilot.mjs`.

## What changed

| Before (2.6.1–2.8.1) | After (2.8.2) |
|---|---|
| `/midas-improve-loop` | `/midas-auto-pilot` (stub alias remains) |
| `/midas-autopilot` (slash) | `/midas-auto-sprints` (stub alias `/midas-autopilot` remains) |
| `{runs}/improve-loop/` | `{runs}/auto-pilot/` |
| Templates `improve-loop-*` | `auto-pilot-runbook.md.tmpl`, `auto-pilot-journal.md` |
| Playbook `improve-cycle.md` | `auto-pilot-cycle.md` (copy target `{product}/playbooks/auto-pilot-cycle.md`) |
| Branch `midas-improve/` | `midas-auto/` |

## Install / update steps

1. `npx … --update` (or engine `npm run bump` consumers) to refresh skills/templates.
2. First `/midas-auto-pilot` run migrates journal/runbook:
   - Prefer `{runs}/improve-loop/` → `{runs}/auto-pilot/` when dest journal is empty/template-only.
   - Never overwrite a non-empty `{runs}/auto-pilot/journal.md`.
3. Kill any armed Cursor `/loop` using sentinel `AGENT_LOOP_TICK_midas_improve_loop_*`, then re-arm via `/midas-auto-pilot`.
4. ADR-009 users: prefer `/midas-auto-pilot` (Sprint checklist / `setup`); CLI commands unchanged. Legacy `/midas-auto-sprints` forwards.

## Anti-typo

| Token | Role |
|---|---|
| `/midas-auto-pilot` | Continuous product evolve |
| `/midas-auto-sprints` | Sprint checklist guide |
| `midas-autopilot.mjs` | ADR-009 CLI |
