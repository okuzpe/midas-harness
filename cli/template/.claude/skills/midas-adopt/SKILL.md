---
name: midas-adopt
description: Adopt Midas into an EXISTING (brownfield) project. Inventory the codebase, reverse-engineer the de-facto architecture and rules from the real code, backfill product context, and establish a baseline audit — writing into any pre-existing AGENTS.md/host adapter/source only after a dry-run diff you confirm. Use instead of greenfield /idea-intake when the repo already has code.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
---

# midas-adopt — brownfield adoption (existing projects)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Precondition:** brownfield (existing code). Empty/greenfield repo → `/idea-intake`.

This is the **E2/E3 (partial / mature) branch of the adaptive intake**: `/midas-init` runs it
automatically when its scan finds real code, or you can invoke it directly on an existing repo.

Bring Midas to a project that already has code, **without trampling what's there**. The golden rule:

> **Dry-run + diff-confirm.** Never write into a pre-existing `AGENTS.md`, `.claude/CLAUDE.md`, rule
> file, or any source file without first showing the exact diff and getting explicit confirmation (via
> `AskUserQuestion`). New files may be written directly. You only ever *add* or *append inside managed
> `<!-- midas:begin -->` markers* — you never rewrite hand-authored content.

## Procedure

Full procedure: **`<paths.engine>/pipeline/adopt-brownfield.md`**.
Inventory playbook: `<paths.engine>/pipeline/0b-codebase-inventory.md`.

Step outline (Steps 0–6):
- **Step 0 — Preflight:** report what will be created vs merged, conflicts, and estimated effort; stop if `--preflight`.
- **Step 1 — Inventory** (scout): tree, manifests, pinned versions, tests, CI, intent docs; write `{product}/inventory.md`.
- **Step 2 — Infer de-facto architecture** (orchestrate): write `{product}/architecture.md` (as-built) + ADRs.
- **Step 3 — Reverse-engineer rules** (brownfield keystone): derive `<paths.rules>/*` + `{product}/conventions.md` from real code; log violations as debt.
- **Step 4 — Backfill product context:** write `{product}/idea.md` (document-existing mode); infer → SHOW → confirm; tag conflicts **DISPUTED**.
- **Step 4b — Dead-flow hygiene:** prefer `/midas-hygiene` (or path-pass
  `<paths.engine>/skills/midas-hygiene/SKILL.md`) at quick depth (optional; user may skip)
  before the baseline audit — canonical indexed pass per `<paths.engine>/rules/hygiene.md`. If skipped,
  run a light inline index (orphan routes, duplicate utilities, `open-questions.md` drift) and record
  findings in adoption notes; reconcile obvious drift before Step 5.
- **Step 5 — Baseline audit:** lightweight conformance pass; freeze to `{runs}/audits/audit-baseline-NN.md`.
- **Step 6 — Wire the harness** (dry-run + diff-confirm): write new files; show diff + confirm for pre-existing `AGENTS.md`/`.claude/CLAUDE.md`; set `paths.state`.

## Exit gate (adoption complete)
- [ ] `{product}/inventory.md` + `{product}/architecture.md` (as-built) written; stack versions Context7-verified.
- [ ] Rules derived from the real code; violations logged as debt (`{product}/debt.md`), not silently rewritten.
- [ ] No pre-existing `AGENTS.md`/`.claude/CLAUDE.md`/source modified without a confirmed diff.
- [ ] Baseline audit frozen to `{runs}/audits/`.
- [ ] `paths.state` records `mode: brownfield`, `entry_stage`, and assumptions for skipped gates.
- [ ] Next action printed: `/define-conventions` for an E2 (partial) repo, `/plan-sprints` for an E3 (mature) repo.

## When NOT

- Fresh empty repo / no real codebase yet → `/midas-init` (greenfield track).
- Install/version/cwd confusion → `/midas-reconcile` first.
- Already adopted (`mode: brownfield` + inventory present) and only need hygiene → `/midas-hygiene`.
- Engine upgrade on an installed project → `/midas-init` (tips CLI `--update`).

## Tier & delegation
Inventory + evidence → **scout** (`midas-scout`). Architecture inference, rule derivation, baseline audit, and
every diff/confirm decision → **orchestrate** (`midas-orchestrator`). Drafting docs → **build** (`midas-builder`).
Context7 verifies the existing stack's versions before any rule mentions an API. Respect `cost_profile`.

