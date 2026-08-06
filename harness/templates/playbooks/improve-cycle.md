# Playbook: continuous improve cycle (Cursor Automation)

| Field | Value |
|---|---|
| **Use when** | Scheduling recurring product-aligned code improvements via Cursor Automations after `/midas-automate` |
| **Trigger** | A Cursor Automation run started from the Midas improve-cycle draft, or a human pasting that draft into `/automate` / `/loop` |
| **Stack** | Host agent = Cursor Cloud / local Agent; product stack = per `{product}/architecture.md` |
| **Owner tier** | build |

## Steps

1. Run `/midas-automate` in the project (validates context; emits draft). Do not confuse with Cursor’s native `/automate`.
2. In **Agents Window**, run Cursor `/automate` and paste the draft (trigger every 6h or post-CI; repo + PR tools).
3. Each Automation run: orient on `.harness/product/` → pick **one** code improvement → branch `midas-improve/<date>-<slug>` → verify cheapest proof → open PR → append `{runs}/automate/journal.md`.
4. Human reviews PRs; when a sprint’s worth lands, run `/close-sprint` (auditor ≠ producer).
5. Optional: if `--autonomy` is installed and the sprint has code checklist lines, use `/midas-autopilot` for policy-gated `tick`s — separate from Automations.

## Must honor

- **Rules:** base conventions + `{product}/conventions.md` + `<paths.rules>/`; never silent rule edits.
- **Design tokens:** `{product}/design-system.md` for UI touches.
- **Context7:** fetch pinned third-party docs before new API call sites.
- **Caps:** one improvement per run; ~4 source files; no merge/deploy/authz/gate claims.

## Done when

- [ ] Automation (or `/loop` fallback) is configured from the Midas draft.
- [ ] Each run leaves a PR + journal row with verify command and result.
- [ ] No run claimed Phase-8 / `gate: passed`.
- [ ] All applicable effective base/project rules still pass (audited in Phase 8).
