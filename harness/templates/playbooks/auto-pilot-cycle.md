# Playbook: continuous auto-pilot cycle

| Field | Value |
|---|---|
| **Use when** | Running continuous product-aligned code improvements via `/midas-auto-pilot` (local `/loop` default) or Cursor Automations (`cloud` mode) |
| **Trigger** | Human runs `/midas-auto-pilot`, a `/loop` wake, or a Cursor Automation from the runbook |
| **Stack** | Host agent = Cursor local Agent (default) or Cloud Automation; product stack = per `{product}/architecture.md` / project-brief |
| **Owner tier** | build |

## Steps

1. Run `/midas-auto-pilot` (validates context; asks **PR vs local code** once if unset; then local mode).
2. Leave Cursor open while the local `/loop` is armed (default every 30m). Each wake: one code improvement → branch `midas-auto/<date>-<slug>` → verify → PR **or** journal-only (`delivery: code`) → append `{runs}/auto-pilot/journal.md`.
3. Optional persistence when the laptop sleeps: `/midas-auto-pilot cloud` → paste runbook into Cursor `/automate` / cursor.com/automations.
4. Human reviews PRs (or local diffs); when a sprint’s worth lands, run `/close-sprint` (auditor ≠ producer).
5. Optional: if `--autonomy` is installed and the sprint has code checklist lines, use `/midas-auto-pilot` (Sprint checklist) for policy-gated `tick`s — ADR-009 control plane (CLI `midas-autopilot.mjs`; see `docs/skills.md` § Autonomy commands).
6. Stop local mode: `/midas-auto-pilot stop`.

## Must honor

- **Rules:** base conventions + `{product}/conventions.md` + `<paths.rules>/`; never silent rule edits.
- **Design tokens:** `{product}/design-system.md` for UI touches.
- **Context7:** fetch pinned third-party docs before new API call sites.
- **Caps:** one improvement per tick; ~4 source files; no merge/deploy/authz/gate claims.

## Done when

- [ ] `/midas-auto-pilot` armed local `/loop` **or** a Cloud Automation is configured from the runbook.
- [ ] Each tick leaves a PR (or local branch + journal row) with verify command and result.
- [ ] No tick claimed Phase-8 / `gate: passed`.
- [ ] All applicable effective base/project rules still pass (audited in Phase 8).
