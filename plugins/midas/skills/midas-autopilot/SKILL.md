---
name: midas-autopilot
description: Bounded sprint autopilot — thin guide to midas-autopilot setup/status/dry-run/tick. Use when enabling ADR-009 autonomy, checking blockers, or scheduling one task per tick. Does not auto-run tick or cursor-cloud from chat.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[setup|status|dry-run]"
---

# midas-autopilot — bounded autonomy (guide only)

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **ADR-009:** `.harness/autonomy/README.md` + `security.md` (optional capability).
> **Runtime:** `.harness/autonomy/bin/midas-autopilot.mjs` — **only** this CLI may start `execute-next-sprint-task`.

**Do not run `tick` or `cursor-cloud` from chat without explicit human confirmation.** This skill orients and shells `setup` / read-only checks when the user asks.

## Response shape (always)

1. **Verdict** — one line (`ready` / `blocked` + why)
2. **Next** — quote `recommendation` — **one** command (no A/B/C walls)
3. **Queued task** — only if `next.task` is a code task

## When NOT

- No `.harness/autonomy/` → installer: `npx … --update --autonomy` (see `/midas-update`).
- `stage` ≠ `sprint_execution` → finish phase gates or `/start-sprint` first.
- Blocker `no_code_task` → open items are operator/manual. Activate a **code** sprint.
- User wants a chat-only loop → Cursor `/loop`; not a substitute for this control plane.

## Procedure

### A. Setup (default — no env export)

In the project terminal (or ask the agent to run it):

```bash
node .harness/autonomy/bin/midas-autopilot.mjs setup --actor=<you> --hours=24
```

That alone: enables `bounded` policy → creates `.harness/autonomy/authz/hmac` if needed (gitignored; still a **local secret file**, not “no secrets”) → grants time-boxed multi-use authz → `dry-run`.

Do **not** ask the user to export `MIDAS_AUTONOMY_AUTHZ_KEY` for everyday local use. Env override remains valid for CI. Exit `0` with `status: configured` means authz is fine but the sprint has no code tasks — next step is `/start-sprint`, not re-setup.

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

`--runner=cursor-cloud` needs `CURSOR_API_KEY` (Cloud Agents). Local overnight without that key = `fake` pilot or Cursor `/loop` on a code sprint — not this CLI cloud path.

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
