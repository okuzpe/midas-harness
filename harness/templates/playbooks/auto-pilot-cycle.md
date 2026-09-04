# Playbook: directed auto-pilot cycle

| Field | Value |
|---|---|
| **Use when** | Running directed, planned code improvements via `/midas-auto-pilot` (local `/loop` default) or Cursor Automations (`cloud` mode) |
| **Trigger** | Human runs `/midas-auto-pilot`, a `/loop` wake (runbook body only), or a Cursor Automation from the runbook |
| **Stack** | Host agent = Cursor local Agent (default) or Cloud Automation; product stack = per `{product}/architecture.md` / project-brief |
| **Owner tier** | build |

## Steps

1. Run `/midas-auto-pilot` (validates a **planned** candidate exists; asks **PR vs local code** once if unset; then local mode). Tick law: `{runs}/auto-pilot/runbook.md`.
2. Leave Cursor open while the local `/loop` is armed (default every 30m). Each wake: cite an **existing** source or idle → freeze `tick-NN.md` → verify → PR **or** session-branch journal (`delivery: code`) → append `{runs}/auto-pilot/journal.md`. Two consecutive `idle` → stop the loop.
3. Optional persistence when the laptop sleeps: `/midas-auto-pilot cloud` → **re-paste** the current runbook into Cursor `/automate` / cursor.com/automations (push remote first).
4. Human reviews PRs (or local diffs); when a sprint’s worth lands, run `/close-sprint` (auditor ≠ producer).
5. Optional CI control plane: `/midas-auto-pilot setup` / `dry-run` then human-confirmed `tick` — ADR-009 CLI `midas-autopilot.mjs` (needs `--autonomy`). Never auto-`tick` from chat. Slash `status` is the **loop** journal, not this CLI (`dry-run` is control-plane status).
6. Stop local mode: `/midas-auto-pilot stop`.

## Must honor

- **Rules:** base conventions + `{product}/conventions.md` + `<paths.rules>/`; never silent rule edits.
- **Design tokens:** `{product}/design-system.md` for UI touches.
- **Context7:** fetch pinned third-party docs before new API call sites.
- **Caps:** one planned improvement per tick (or idle); ~4 source files; no inventing backlog; no merge/deploy/authz/gate claims.

## Done when

- [ ] `/midas-auto-pilot` armed local `/loop` **or** a Cloud Automation is configured from the **current** runbook.
- [ ] Each non-idle tick froze `tick-NN.md` before code and left a PR (or session branch + journal row) with verify command and result.
- [ ] No tick claimed Phase-8 / `gate: passed`.
- [ ] All applicable effective base/project rules still pass (audited in Phase 8).
