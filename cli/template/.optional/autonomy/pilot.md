# Autonomy P0 pilot — temp-dir value gate

Pilot target: a **scratch install** in a temp directory (not a committed fixture tree).

## Baseline (manual)

1. Note time-to-complete for one sprint task with human-driven `/start-sprint` flow on a scratch project.
2. Record interventions (prompt edits, re-runs, merges).

## P0 protocol

1. Install autonomy into a scratch v2 project:
   ```bash
   npx github:okuzpe/midas-harness --tools=cursor --autonomy /tmp/midas-autonomy-pilot
   ```
   **CI smoke (engine repo):** structural test `autonomy:install-fake-tick-smoke` in `scripts/test.mjs`
   runs `create-midas --autonomy` → `setup` → `tick --runner=fake` with no `CURSOR_API_KEY`.
2. Set `stage: sprint_execution`, add an active or planned sprint with open `- [ ]` tasks
   (greenfield: `{product}/sprints/`; brownfield: `{product}/planning/sprint-*.md`).
3. One-shot setup (no env key required locally — auto-creates `authz/hmac`):
   ```bash
   node .harness/autonomy/bin/midas-autopilot.mjs setup --actor=pilot --hours=8
   ```
   Setup grants a time-boxed multi-use authz (enough for several fake ticks).
4. `dry-run` → must show `would_effect: true` (or read the `setup` JSON / `recommendation`).
5. Run **three** ticks with `--runner=fake` (no cloud tokens).
6. Optionally one bounded `--runner=cursor-cloud` run with a hard cost reserve.

Editor guide: `/midas-auto-sprints` (does not auto-run `tick` from chat). Quote `recommendation` only.
CLI unchanged: `midas-autopilot.mjs`. Continuous product evolve (not this plane): `/midas-auto-pilot`.

## Value gate (open P1 only if all hold)

| Metric | Threshold |
|---|---|
| Tasks accepted without manual edit before audit | ≥ 80% |
| Human interventions vs baseline | ≤ 50% of baseline |
| Duplicate PRs / duplicate remote agents | 0 |
| Hook / policy bypasses | 0 |

## Amendment

- **2026-08-08** — Pilot target is temp-dir install; removed TaskPilot fixture references.
