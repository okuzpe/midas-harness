---
name: midas-automate
description: "Prepare a portable Cursor Automation draft for continuous product-aligned improve cycles — validate harness context, emit one-iteration instructions (discover → fix/create → verify → PR). Complements ADR-009 midas-autopilot; does not schedule Cloud Agents or run tick from chat."
metadata:
  midas-argument-hint: "[validate|draft]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-automate — Cursor improve-cycle draft (guide only)

> **Disambiguation (always say first):** This skill **prepares the draft**. The **scheduler** is Cursor’s native **`/automate`** in the Agents Window (or cursor.com/automations). Do not confuse the two names.

> **Guard:** `<paths.engine>/templates/skill-state-ritual.md` + `AGENTS.md` § Safety.
> **Template:** `<paths.engine>/templates/cursor-automation-improve.md.tmpl`
> **Journal shape:** `<paths.engine>/templates/automate-journal.md` → `{runs}/automate/journal.md` (optional dir, like explore — not in `RUNS_SUBDIRS`).
> **Playbook:** `<paths.engine>/templates/playbooks/improve-cycle.md` → propose copy to `{product}/playbooks/improve-cycle.md` (recommend-don’t-wall).

This is the **complementary** improve loop (product context → one improvement → verify → PR). It is **not** the ADR-009 policy/budget plane — that is `/midas-autopilot` + `midas-autopilot.mjs`. Automations alone have no durable lease/budget (see ADR-009 Context).

**Do not** launch Cloud Agents, create Automations via API, or run `midas-autopilot tick` from this skill without explicit human OK.

## Response shape (always)

1. **Banner** — one line: prepares draft; scheduler = Cursor `/automate` (Agents Window).
2. **Verdict** — `ready` | `ready_with_warnings` | `blocked` + why
3. **Next** — **one** command (usually: Agents Window → `/automate` + paste draft)
4. **Automation draft** — filled template body (or blocker list if blocked)

## When NOT

- No install / no `paths.state` → `/midas-reconcile` or install (`INSTALL.md`).
- No product context at all → `/midas-init` or `/midas-adopt` first.
- Already have a **code** sprint checklist and want policy-gated ticks → `/midas-autopilot` (needs `--autonomy`).
- Want Phase-8 gate verdict → `/close-sprint` (never claimed by Automations).

## Procedure

### A. Validate (read `paths.state` first)

Hard-block (`blocked`) only when:

1. `paths.state` missing or unreadable, or layout is not harness-writable.
2. **No product context** under `paths.product` (and common brownfield aliases). Accept **any one** of:
   - `idea.md`, `architecture.md`, `features.json` (greenfield / classic Midas)
   - `features.md`, `project-brief.md`, `project-state.md` (E2/E3 brownfield ledgers)
   - `open-questions.md` **plus** at least one of the above is still preferred; alone is not enough

Warn (`ready_with_warnings`) when:

- `stage` ≠ `sprint_execution` (still emit draft — early/brownfield OK).
- Active/planned sprint looks operator-only (release/publish/smoke) — draft must **create** a small code improvement, not run the release checklist.

Record `name`, `stage`, `paths.product`, `paths.runs` for the draft.

### B. Emit draft

1. Read `<paths.engine>/templates/cursor-automation-improve.md.tmpl`.
2. Substitute: project `name`, product/runs paths, `stage`, today’s ISO date hint for branch slug.
3. Print a compact table:

| Field | Suggested |
|---|---|
| Trigger | every 6h **or** GitHub workflow_run completed on default branch |
| Repository | this git remote |
| Tools | repo edit + open PR |
| Branch prefix | `midas-improve/` |

4. **Next:** `In Agents Window run /automate and paste the draft below.`

Propose (ask first): copy `<paths.engine>/templates/playbooks/improve-cycle.md` → `{product}/playbooks/improve-cycle.md` if missing.

### C. Local fallback (no Automations)

Same prompt body with Cursor `/loop 2h <paste draft body>` — not a second control plane; same caps.

### D. Optional actuator handoff

If `.harness/autonomy/` exists and dry-run would show a **code** task: after Automations have seeded checklist items, user may run `/midas-autopilot` → `setup` / `tick`. Do not require `MIDAS_AUTONOMY_AUTHZ_KEY` for `/midas-automate`.

## Exit gate

- [ ] Banner disambiguated Midas skill vs Cursor `/automate`.
- [ ] Verdict is `ready` / `ready_with_warnings` / `blocked` with evidence paths.
- [ ] One Next command only; draft from the engine template (caps + producer≠auditor intact).
- [ ] Did not auto-start Cloud Agent, `tick`, or claim Phase-8 / `gate: passed`.
- [ ] Did not require authz env for this skill.

## Tier & delegation

- **Dispatch:** validate + fill template → **build**.
- Scout may fetch remote/docs if the user asks; do not delegate drafting the Automation away from this skill’s exit gate.
- Path-pass `Delegator: yes` — parents may pass this `SKILL.md` for reading; `disable-model-invocation` still forbids Skill-tool / auto slash.
