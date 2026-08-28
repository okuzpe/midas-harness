# Sprint checklist path (ADR-009) — L3 for `/midas-auto-pilot`

> Loaded when intent is **sprint checklist** or args are `setup|status|dry-run|tick|resume`.
> **Runtime CLI (unchanged):** `.harness/autonomy/bin/midas-autopilot.mjs` — **only** this CLI may start `execute-next-sprint-task`.
> **Do not** run `tick` or `cursor-cloud` from chat without explicit human confirmation.

## Response shape (sprint path)

1. **Verdict** — one line (`ready` / `blocked` + why)
2. **Intent** — `sprints` | `status`
3. **Next** — quote `recommendation` — **one** command (no A/B/C walls)
4. **Queued task** — only if `next.task` is a code task

## When NOT

- No `.harness/autonomy/` → installer: `npx … update --autonomy` (see `/midas-init`).
- `stage` ≠ `sprint_execution` → finish phase gates or `/start-sprint` first.
- Blocker `no_code_task` → open items are operator/manual. Activate a **code** sprint, **or** choose Continuous product evolve on `/midas-auto-pilot`.
- User wants a raw chat-only loop without Midas caps → Cursor `/loop`; prefer Continuous evolve when product context should drive picks.

## Procedure

### A. Setup (default when intent=sprints and no arg — no env export)

```bash
node .harness/autonomy/bin/midas-autopilot.mjs setup --actor=<you> --hours=24
```

That alone: enables `bounded` policy → creates `.harness/autonomy/authz/hmac` if needed (gitignored; still a **local secret file**, not “no secrets”) → grants time-boxed multi-use authz → `dry-run`.

Do **not** ask the user to export `MIDAS_AUTONOMY_AUTHZ_KEY` for everyday local use. Env override remains valid for CI. Exit `0` with `status: configured` means authz is fine but the sprint has no code tasks — next step is `/start-sprint` or Continuous evolve on `/midas-auto-pilot`, not re-setup.

### B. Check blockers (`status` / `dry-run` / Ask option **Sprint status / dry-run**)

```bash
node .harness/autonomy/bin/midas-autopilot.mjs status
node .harness/autonomy/bin/midas-autopilot.mjs dry-run
```

### C. One task (human-confirmed only)

Only when `would_effect: true`:

```bash
node .harness/autonomy/bin/midas-autopilot.mjs tick --runner=fake
```

`--runner=cursor-cloud` needs `CURSOR_API_KEY` (Cloud Agents). Local overnight without that key = `fake` pilot or Continuous evolve — not this CLI cloud path.

### D. Resume

```bash
node .harness/autonomy/bin/midas-autopilot.mjs resume --runner=fake
```

## Task selection

- First unchecked `- [ ]` **code** line.
- Skips `[manual]` / `[operator]` / `[human]` / `[ops]` / `[no-auto]` and release-runbook heuristics.

## Exit gate (sprint path)

- [ ] User ran (or confirmed) the CLI; no invented parallel autonomy.
- [ ] Reply named **one** next command from `recommendation`.
- [ ] Never required the user to export `MIDAS_AUTONOMY_AUTHZ_KEY` for local setup (local hmac file is fine).
- [ ] Did not claim “no secrets” — hmac file or cloud `CURSOR_API_KEY` may still apply.
- [ ] `tick` only after explicit human OK and `would_effect: true`.
- [ ] Never auto-invoke `tick` from chat.
