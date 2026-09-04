# Migration — directed `/midas-auto-pilot` loop

Runbook + slash semantics for a **directed** `/loop` (planned sources only). **Controller CLI unchanged:** `node .harness/autonomy/bin/midas-autopilot.mjs`. Chat still never auto-invokes `tick`.

## What changed

| Before | After |
|---|---|
| Bare slash = Mode Ask (evolve vs sprint vs stop vs status) | Bare slash = directed loop (delivery Ask if unset → tick → `/loop`) |
| Choose fallback #5 = invent a small improvement | No invent; `idle` if no planned source; two consecutive `idle` stop the loop |
| Tick = implement then maybe journal | Freeze `{runs}/auto-pilot/ticks/tick-NN.md` **before** code |
| `delivery: code` + dirty-tree abort after tick 1 | Session branch `midas-auto/<date>-session`; allowlist = that branch’s dirty paths |
| Slash `status` → ADR-009 CLI `status` | Slash `status` → loop journal + next candidate. Control plane: `dry-run` |
| Wake prompt re-entered the full skill | Wake executes **runbook only** (no B00 / delivery Ask) |

## Install / update steps

1. `npx … update` (or refresh engine skills) so mirrors pick up the skill + runbook template + `auto-pilot-tick.md`.
2. Next `/midas-auto-pilot` **patches** Choose/Caps on stock runbooks that still contain `one small improvement aligned` (keeps `delivery:` and human notes). Custom runbooks: re-copy Choose from the engine template or pass `--force`.
3. **Cloud Automations:** re-paste `{runs}/auto-pilot/runbook.md` — a stale paste still has fallback #5.
4. Breaking: `/midas-auto-pilot status` no longer shells `midas-autopilot.mjs status`. Use `/midas-auto-pilot dry-run` (or the CLI) for the control plane.
5. ADR-009 users: `/midas-auto-pilot setup` then human-confirmed `tick` via CLI — unchanged.

## Anti-typo

| Token | Role |
|---|---|
| `/midas-auto-pilot` | Directed loop (bare) |
| `/midas-auto-pilot status` | Loop journal + next candidate |
| `/midas-auto-pilot dry-run` | ADR-009 control-plane status |
| `midas-autopilot.mjs` | ADR-009 CLI |
