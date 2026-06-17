---
name: define-conventions
description: Phase 5 — THE KEYSTONE. Freeze the architecture into checkable rules and a design system, then re-render the tool adapters. Use once, after the architecture is pinned (stage tech_architecture → architecture_rules), to encode folder structure, stack conventions, and design tokens that every later sprint is audited against.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
---

# define-conventions (Phase 5 — Architecture-as-Rules + Design System)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; if the precondition stage is wrong, report and stop.

This is the **keystone** of Midas: it converts the pinned architecture into **machine-checkable rules**
and a **design system** that every Phase-7 sprint is built to and every Phase-8 audit grades against.
A vague rule here weakens every downstream audit, so each rule MUST be checkable (a reviewer can say
pass/fail with on-disk evidence). Orchestrate-tier decides the rules; **build** writes the files.

> **Precondition.** `stage: tech_architecture` must be `passed` (or `architecture_rules` resuming).
> If `product/architecture.md` or the ADRs are missing, stop — there is nothing to encode yet.

## Inputs
- `harness/state.yaml`, `product/architecture.md`, `product/adr/ADR-*.md`.
- `harness/conventions.md` (the base floor — extend, never overwrite) and `harness/rules/` (existing
  always-on rules) and `harness/rules/context7-usage.md`.
- `harness/design-system/tokens.json` + `tokens.css` (the token store the design system references).

## Procedure

### 1. Encode folder-structure + conventions as CHECKABLE rules
Extend `harness/rules/` with project rules derived from the architecture's boundaries:
- A **folder-structure rule** (`harness/rules/folder-structure.md`): the canonical tree, where each
  layer lives, and the **import/boundary rules** (which layer may import which) — stated so a diff
  can be checked against it.
- **Stack-specific convention rules**, generated for the chosen frameworks and **Context7-verified**
  per `harness/rules/context7-usage.md` (idioms, file naming, state/data patterns, testing approach
  for that stack at its pinned version). Pin versions; do not write framework rules from memory.
- Each rule states a **CHECK** line: the concrete, evidence-based condition the Phase-8 audit
  evaluates (e.g. "no file under `ui/` imports from `db/`"). Drop anything you cannot make checkable.

### 2. Build the DESIGN SYSTEM
Write `product/design-system.md` that **references** `harness/design-system/tokens.json` and
`tokens.css` (do not duplicate token values into prose). It defines:
- **Color palette**, **typography scale**, **spacing scale**, **radii** — as token references.
- The chosen **UI framework/component library** (Context7-verified at its pinned version) and how it
  consumes the tokens.
- The rule that all UI references tokens — **never** hardcoded colors/spacing/type/radii.
If the token files are missing or stale, populate them from the architecture's UI decision first.

### 3. Build the project PLAYBOOKS (the few repeated tasks, done the project's way)
Rules are *constraints* the audit checks; **playbooks** are *procedures* the build agent follows so every
sprint does a recurring task the same way. Emit a **small, bounded set** to `product/playbooks/<verb-noun>.md`
(from `harness/templates/playbook.md`):
- **Pick the 0–4 tasks that actually recur** for this stack/architecture — derived from the architecture's
  real surfaces (e.g. "add an API endpoint", "add a DB migration", "scaffold a UI component", the
  "implement → test → done" ritual), not a generic list. **Zero is valid** — an empty `product/playbooks/`
  passes the gate when nothing both recurs *and* has a non-obvious right way.
- Each playbook is a tight recipe: *use-when*, ordered **steps**, the **rules/tokens it must honor**
  (reference `harness/rules/*` + the design tokens by `<slug>.md` — never restate them), the **Context7**
  fetch for any third-party API it touches, and a **done-when** check that is the procedure's *own* signal
  (not a restatement of the rules).
- **Anti-bloat guard:** cap at 4; include a task only if it *repeats across sprints* AND has a
  project-specific "right way" not obvious from a rule + Context7 alone. **CHECK:** each playbook has ≥1
  step stating a decision (an ordering, a status-code contract, a scoping choice) that no single
  `harness/rules/*` states — a playbook whose every step maps 1:1 to a rule is a duplicate → **cut it**.
  Playbooks are markdown the agent reads — **not** new slash-commands or generated skills.

### 4. State the precedence explicitly
The encoded layer must agree with `harness/conventions.md`:

```
stack-specific rules  >  product/conventions.md  >  product/design-system.md  >  base conventions
```

This is the single taxonomy — do not introduce a parallel "standards" layer.

### 5. Re-render adapters (sync engine)
Generated adapters (`CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`) must
reflect the new rules. Run `node scripts/render-adapters.mjs` (or `/midas-doctor`). **Never** hand-edit
a generated adapter. Confirm the render succeeded and adapters are in sync.

### 6. Record state
Update `harness/state.yaml`: list the new rule files + `product/design-system.md` + the
`product/playbooks/*` in `phases.architecture_rules.artifacts`, set `stage_status: gate_pending`, and
record which `tools` the adapters were rendered for. Do not self-advance the stage.

## Exit gate (orchestrate audits)
- A **folder-structure rule** exists with explicit boundary/import constraints.
- Conventions are encoded and **every rule is CHECKABLE** (has a concrete pass/fail CHECK).
- Stack rules are **Context7-verified** at pinned versions.
- The **design system** exists: tokens (color, type, spacing, radii) + UI framework, referenced from
  `product/design-system.md`, with the "tokens not hardcoded values" rule.
- **Playbooks** for the project's repeated tasks: **0–4** in `product/playbooks/` (zero is valid), each
  with use-when, steps, the rules/tokens it honors, a Context7 fetch, and a done-when check. **CHECK:**
  every playbook has ≥1 step not stated by any single `harness/rules/*` (1:1-to-rules → cut); none is a
  new slash-command.
- **Adapters are rendered** and in sync (no drift reported by `/midas-doctor`).

On pass: freeze the verdict in `.harness/audits/`, set the gate passed; next action is `/plan-sprints`
(Phase 6). On fail: report the uncheckable rule or unrendered adapter.

## Tier & cost
Deciding the rule set, the design-system structure, and **which 0–4 tasks deserve a playbook** →
**orchestrate** (Opus). Writing the rule files, `product/design-system.md`, tokens, and the playbooks →
**build** (Sonnet). Context7 fetches for stack/UI-framework
rules → **scout** (Haiku). Prefer a UI/design specialist (`voltagent-core-dev:ui-designer`,
`frontend-design`) for the design system if installed; otherwise `midas-builder`.
