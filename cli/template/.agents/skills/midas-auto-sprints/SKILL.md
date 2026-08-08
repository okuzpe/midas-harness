---
name: midas-auto-sprints
description: Bounded sprint checklist actuator — thin guide to midas-autopilot CLI setup/status/dry-run/tick (ADR-009). Does not auto-run tick from chat. For continuous product evolve use /midas-auto-pilot.
metadata:
  midas-argument-hint: "[setup|status|dry-run]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-auto-sprints — sprint checklist actuator (ADR-009)

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **ADR-009:** `.harness/autonomy/README.md` + `security.md` (optional capability).
> **Runtime CLI (unchanged):** `.harness/autonomy/bin/midas-autopilot.mjs` — **only** this CLI may start `execute-next-sprint-task`.

| Slash / token | Role |
|---|---|
| `/midas-auto-sprints` | This skill — sprint checklist guide |
| `/midas-auto-pilot` | Continuous product evolve (local `/loop`) — **not** this |
| `midas-autopilot.mjs` | ADR-009 controller CLI (npm bin) |
| `/midas-autopilot` | Deprecated alias → this skill |

**Do not run `tick` or `cursor-cloud` from chat without explicit human confirmation.** This skill orients and shells `setup` / read-only checks when the user asks.

## Response shape (always)

1. **Verdict** — one line (`ready` / `blocked` + why)
2. **Next** — quote `recommendation` — **one** command (no A/B/C walls)
3. **Queued task** — only if `next.task` is a code task

## When NOT

- No `.harness/autonomy/` → installer: `npx … --update --autonomy` (see `/midas-update`).
- `stage` ≠ `sprint_execution` → finish phase gates or `/start-sprint` first.
- Blocker `no_code_task` → open items are operator/manual. Activate a **code** sprint, **or** discover improvements via `/midas-auto-pilot` then return here for policy-gated `tick`s.
- User wants continuous product-aligned improve without a code checklist yet → `/midas-auto-pilot`.
- User wants a raw chat-only loop without Midas caps → Cursor `/loop`; prefer `/midas-auto-pilot` when product context should drive picks.

## Procedure

### A. Setup (default — no env export)

In the project terminal (or ask the agent to run it):

```bash
node .harness/autonomy/bin/midas-autopilot.mjs setup --actor=<you> --hours=24
```

That alone: enables `bounded` policy → creates `.harness/autonomy/authz/hmac` if needed (gitignored; still a **local secret file**, not “no secrets”) → grants time-boxed multi-use authz → `dry-run`.

Do **not** ask the user to export `MIDAS_AUTONOMY_AUTHZ_KEY` for everyday local use. Env override remains valid for CI. Exit `0` with `status: configured` means authz is fine but the sprint has no code tasks — next step is `/start-sprint` or `/midas-auto-pilot`, not re-setup.

### B. Check blockers

```bash
node .harness/autonomy/bin/midas-autopilot.mjs status
node .harness/autonomy/bin/midas-autopilot.mjs dry-run
```

### C. One task (human-confirmed only)

Only when `would_effect: true`:

```bash
node .harness/autonomy/bin/midas-autopilot.mjs tick --runner=fake
```

`--runner=cursor-cloud` needs `CURSOR_API_KEY` (Cloud Agents). Local overnight without that key = `fake` pilot or `/midas-auto-pilot` — not this CLI cloud path.

### D. Resume

```bash
node .harness/autonomy/bin/midas-autopilot.mjs resume --runner=fake
```

## Task selection

- First unchecked `- [ ]` **code** line.
- Skips `[manual]` / `[operator]` / `[human]` / `[ops]` / `[no-auto]` and release-runbook heuristics.

## Exit gate

- [ ] User ran (or confirmed) the CLI; no invented parallel autonomy.
- [ ] Reply named **one** next command from `recommendation`.
- [ ] Never required the user to export `MIDAS_AUTONOMY_AUTHZ_KEY` for local setup (local hmac file is fine).
- [ ] Did not claim “no secrets” — hmac file or cloud `CURSOR_API_KEY` may still apply.
- [ ] `tick` only after explicit human OK and `would_effect: true`.

## Tier & delegation

- **Dispatch:** narrate + shell `setup`/`status`/`dry-run` → **build**.
- **Never** auto-invoke `tick` from chat.
