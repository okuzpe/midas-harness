# Autonomy P0 pilot — TaskPilot value gate

Pilot target: `examples/taskpilot/` (content fixture; hub/v1 layout).

## Baseline (manual)

1. Note time-to-complete for one TaskPilot sprint task with human-driven `/start-sprint` flow.
2. Record interventions (prompt edits, re-runs, merges).

## P0 protocol

1. Install autonomy into a scratch v2 project (or copy TaskPilot product artifacts into a fresh
   `--autonomy` install):
   ```bash
   npx github:okuzpe/midas-harness --tools=cursor --autonomy /tmp/taskpilot-auto
   ```
2. Set `stage: sprint_execution`, add an active sprint + open task checklist.
3. Enable bounded policy (edit `.harness/autonomy/policy.yaml`: `enabled: true`, `mode: bounded`).
4. Grant commit/push authz:
   ```bash
   node .harness/autonomy/bin/midas-autopilot.mjs authz-grant --actor=pilot --hours=8
   ```
5. `dry-run` → must show `would_effect: true`.
6. Run **three** ticks with `--runner=fake` (no cloud tokens).
7. Optionally one bounded `--runner=cursor-cloud` run with a hard cost reserve.

## Value gate (open P1 only if all hold)

| Metric | Threshold |
|---|---|
| Tasks accepted without manual edit before audit | ≥ 80% |
| Human interventions vs baseline | ≤ 50% of baseline |
| Duplicate PRs / duplicate remote agents | 0 |
| Hook / policy bypasses | 0 |
| Each run within its budget reserve | 100% |

## P1 decision

- **Pass gate** → open ADR amending `harness/methodology.md` sign-offs; then profiles
  `custom`/`full`, merge/deploy manifests, Admin API / canary capacity revalidation.
- **Fail gate** → keep bounded-only; file findings under `{runs}/autonomy/pilot-notes.md`.

## Deferred (explicit)

custom/full, auto-merge/deploy, Automations-as-trigger, mandatory Admin API, stage-table
generalization, methodology human sign-off removal.
