# Brownfield adoption — `/midas-adopt` playbook

**Stage:** setup / brownfield on-ramp | **Tier:** scout (inventory) + orchestrate (infer/audit) + build (drafts)

> Canonical procedure for `/midas-adopt`. The skill cites this file. Inventory detail:
> `<paths.engine>/pipeline/0b-codebase-inventory.md`. Hygiene checks:
> `<paths.engine>/rules/hygiene.md`. Shared tallies:
> `<paths.engine>/templates/audit-checklists.md`.

## Purpose

Bring Midas to a project that already has code **without trampling what's there**. Codify reality
(architecture, rules, debt) instead of inventing a greenfield plan.

## Golden rule

> **Dry-run + diff-confirm.** Never write into a pre-existing `AGENTS.md`, `.claude/CLAUDE.md`, rule
> file, or any source file without first showing the exact diff and getting explicit confirmation
> (via `AskUserQuestion`). New files may be written directly. Only *add* or *append inside managed
> `<!-- midas:begin -->` markers* — never rewrite hand-authored content.

## Step 0 — Preflight (read-only; optional `--preflight`)

Produce a **preflight report**:

- What will be created vs merged (engine tree, `{product}/inventory.md`, rules draft).
- Conflicts with existing `AGENTS.md` / `.claude/CLAUDE.md` (managed-marker regions only).
- Estimated effort: **light** (E2 partial) / **medium** (E2 + debt) / **heavy** (E3 + baseline audit).
- Recommended path: full adopt vs **incremental** (folder-structure rule first, then stack rules).

If `--preflight` or the user asks for a dry run, **stop after the report** — no writes.

## Step 1 — Inventory: code AND intent (scout)

Follow `<paths.engine>/pipeline/0b-codebase-inventory.md`. Dispatch **scout** read-only: tree,
manifests, languages/frameworks + **pinned versions** (Context7), tests, CI, existing agent configs,
**and** stated intent (`README*`, `docs/`, briefs, manifest `description`). Write
`{product}/inventory.md`. Scan the repo's files, not local toolchains; probes use `|| true`.

## Step 2 — Infer the de-facto architecture (orchestrate)

From the inventory, infer the real architecture (components, data flow, boundaries) and write
`{product}/architecture.md` describing **what exists** (not an ideal). Record significant existing
decisions as ADRs under `{product}/adr/`, marked "as-built".

## Step 3 — Reverse-engineer rules (brownfield keystone)

Derive `<paths.rules>/*` and `{product}/conventions.md` from **actual conventions in the code**
(folder structure, naming, error handling, test policy) — **codify reality**. Where the code violates
a sensible rule, do **not** rewrite it: record the gap as future-sprint **debt** in
`{product}/debt.md`. Inverse of greenfield Phase 5 (which invents rules).

## Step 4 — Backfill product context (document-existing)

Using intent from Step 1, write `{product}/idea.md` (and `{product}/business-plan.md` where docs
support it) in **document-existing** mode: purpose/audience/constraints lifted from README/docs with
source cited. Follow **infer → SHOW → confirm**. Conflicts between docs and code/manifests → tag
**DISPUTED** and confirm. Unknown fields stay blank for the gap loop. Skipped/backfilled gates carry
a **recorded assumption** in `paths.state` and an honest `entry_stage`.

## Step 4b — Dead-flow sweep (inline)

Run the same **indexing checks** as hygiene (`<paths.engine>/rules/hygiene.md`) inline — orphan
routes, duplicate utilities, `open-questions.md` drift — **do not** invoke `/midas-sweep` by name.
Record findings in adoption notes; reconcile obvious drift before the baseline audit.

## Step 5 — Baseline audit

Lightweight baseline conformance: apply each derived rule's CHECK against the codebase, record
pass/fail/n/a with evidence, freeze to `{runs}/audits/audit-baseline-NN.md` with a
`MIDAS_AUDIT_RESULT` tally (shape in `audit-checklists.md`). Do **not** invoke `/midas-tribunal` or
`/close-sprint` by name.

## Step 6 — Wire the harness (dry-run + diff-confirm)

For each file:

- **New file** (`paths.state`, `{product}/*`, missing adapter) → write directly.
- **Pre-existing `AGENTS.md` / `.claude/CLAUDE.md` / `.mcp.json`** → show managed-marker diff;
  `AskUserQuestion` before write. On decline, print the block for manual paste.
- Generate adapters via `/midas-doctor` (single render path).

Set `paths.state`: `mode: brownfield` and `entry_stage` by maturity —

- **E2 (partial):** `architecture_rules` (record `tech_architecture` as deliberately skipped; as-built
  architecture + ADRs still written so `/define-conventions` resumes under `architecture_rules`).
- **E3 (mature):** `sprint_planning` once rules + baseline audit are in place.

Record an assumption in `paths.state` for every skipped gate.

## Exit gate

- [ ] `{product}/inventory.md` + `{product}/architecture.md` (as-built); stack versions Context7-verified.
- [ ] Rules derived from real code; violations in `{product}/debt.md`, not silently rewritten.
- [ ] No pre-existing adapter/source modified without a confirmed diff.
- [ ] Baseline audit frozen to `{runs}/audits/`.
- [ ] `paths.state` records `mode: brownfield`, `entry_stage`, assumptions for skipped gates.
- [ ] Next action: `/define-conventions` (E2) or `/plan-sprints` (E3).

## Recommended tier + agents

- Inventory + evidence → **scout**
- Architecture, rules, baseline audit, every diff/confirm → **orchestrate**
- Drafting docs → **build**
- Context7 verifies stack versions before any rule mentions an API
