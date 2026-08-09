---
name: close-sprint
description: Phase 8 — per-sprint conformance and scope audit. Diff the code against every frozen rule (pass/fail with evidence), reconcile scope vs the business case, resolve drift, freeze {runs}/audits/audit-NN.md, update state, and select the next sprint or declare MVP complete. Use after a sprint's work lands (stage stays `sprint_execution`; Phase 8 runs in place).
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
---

# close-sprint (Phase 8 — Per-sprint Audit & Adjust)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).

The closing half of the **7 ⇄ 8 loop**. After a sprint's code lands, the orchestrator audits the
**living code** against the **rules frozen in Phase 5** and the **scope in the business case**,
resolves drift, freezes the verdict, and decides what's next. **The producer never grades its own
homework** — this is an independent orchestrate-tier audit.

> **vs `/start-sprint`:** `start-sprint` ran the **pre-sprint** drift audit and set the sprint `active`.
> `close-sprint` is the **formal Phase-8 gate** — only after tasks, tests, and UI `/midas-verify` journeys
> (web and/or mobile sections in `verify-NN.md`, when applicable) are green. Never open a sprint with
> close-sprint; never ship a gate without it.

> **Precondition.** A sprint must be `active` in `paths.state → sprints[]` with its work landed (tasks
> done, tests run). If no active sprint, stop and report.

> **Shared audit fragments:** `<paths.engine>/templates/audit-checklists.md` (gate semantics, evidence
> rule, tally format, hygiene hook). Record shape: `<paths.engine>/templates/audit-record.md`.

## Procedure

Full procedure: **`<paths.engine>/pipeline/8-audit-adjust.md`**.

Step outline (Steps 0–6):
- **Step 0 — Hygiene pass (path-pass, not Skill-tool):** Read and follow
  `<paths.engine>/skills/midas-sweep/SKILL.md` when brownfield requires a sweep record or the diff is
  large (greenfield: recommended; document any skip). On a fat feature/UI diff, path-pass
  `<paths.engine>/skills/midas-lean-review/SKILL.md` (optional `--freeze`) before the conformance pass —
  does not block the gate alone. **Do not** Skill-tool / auto-slash these internals; power-users may
  still type `/midas-sweep` / `/midas-lean-review`.
- **Step 0.5 — Diff gate receipts (when production paths changed):** require `{paths.cache}/gates/<run>/test.json` and `quality.json` with **`isPassingReceipt`** semantics (`pass` or `skipped` + reason) **or** record an explicit skip with reason in `{runs}/sprints/NN-progress.md` or audit notes. Engine-only / docs-only diffs: skip OK. When receipts are missing or stale, **path-pass** `<paths.engine>/skills/midas-diff-gates/SKILL.md` and run its receipt commands in this same close run — still not Skill-tool invoke. Does **not** change `verify-NN.md` semantics — UI/API proof stays `/midas-verify` (primary; human-typed when needed).
- **Step 1 — Read state + frozen rules:** `paths.state`, active sprint, all effective rules, architecture + idea docs, design system.
- **Step 2 — Conformance audit:** every rule, pass/fail with on-disk evidence; confirm Context7 doc coverage; trigger every matching playbook.
- **Step 3 — Scope audit:** delivered scope vs plan and business-case success metrics; no scope creep, no silent drops.
- **Step 4 — Resolve drift:** fix now or consciously amend the rule (+ ADR); re-render adapters if amended; nothing left silent.
- **Step 5 — Freeze the audit:** write `{runs}/audits/audit-NN.md` with `MIDAS_AUDIT_RESULT` tally; `unresolved=0` required before closing.
- **Step 6 — Plan adjustment + update state:** set sprint `status: done`; reconcile `sprints[]`; select next sprint or declare MVP complete.
- **Optional — lifecycle journal:** `node <paths.scripts>/lifecycle-journal.mjs close_sprint --detail "sprint-NN"` (fail-open metrics under `{paths.cache}/metrics/lifecycle.jsonl`).
- **Optional — quality log:** `node <paths.scripts>/quality-log.mjs audit pass --detail "sprint-NN"` (metadata-only JSONL; never secrets).
- **Optional — carryover refresh:** `node <paths.scripts>/carryover-refresh.mjs` after sprint `done` (snapshot → idle). Resume ladder: `<paths.engine>/templates/session-resume-precedence.md`.
- **Optional — capture proposals:** after `{runs}/sprints/NN-progress.md` § Learned is filled, the human may run `node <paths.scripts>/capture-candidates.mjs --progress {runs}/sprints/NN-progress.md` — propose only; never auto-write rules/playbooks.

## Exit gate
- **Every rule audited** pass/fail **with evidence**.
- **Diff gate receipts** when production paths changed: Step 0.5 satisfied (`{paths.cache}/gates/<run>/` or documented skip).
- **Playbook triggers honored:** any diff matching a `{product}/playbooks/*` `Trigger` shows that playbook's done-when satisfied.
- **Drift fixed or the rule consciously amended** (logged) — nothing silent.
- **Scope reconciled** against the business case.
- `{runs}/audits/audit-NN.md` frozen; `paths.state` updated.
- A clear next step: **next sprint** or **"MVP complete"**.

## Tier & cost
The audit, drift decisions, and ship/continue call → **orchestrate** (Opus). Mechanical diff
extraction → **scout** (Haiku). Step-4 conformance fixes → **build** (Sonnet); then **re-run
`/close-sprint`** until `MIDAS_AUDIT_RESULT` shows `unresolved=0`. Only after Step 6 marks the
sprint `done` does the next code sprint begin with **`/start-sprint`**.
Under `cost_profile: max_savings`, **escalate this Phase-8 audit to Opus** even if the default
orchestrate pin is Sonnet.
