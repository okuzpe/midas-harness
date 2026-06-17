---
name: midas-adopt
description: Adopt Midas into an EXISTING (brownfield) project. Inventory the codebase, reverse-engineer the de-facto architecture and rules from the real code, backfill product context, and establish a baseline audit — writing into any pre-existing AGENTS.md/CLAUDE.md/source only after a dry-run diff you confirm. Use instead of greenfield /idea-intake when the repo already has code.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7, sequential-thinking]
---

# midas-adopt — brownfield adoption (existing projects)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; this skill is for **brownfield** projects (existing code). If the repo
> is empty/greenfield, stop and point at `/idea-intake`.

This is the **E2/E3 (partial / mature) branch of the adaptive intake**: `/midas-init` runs it
automatically when its scan finds real code, or you can invoke it directly on an existing repo.

Bring Midas to a project that already has code, **without trampling what's there**. The golden rule:

> **Dry-run + diff-confirm.** Never write into a pre-existing `AGENTS.md`, `CLAUDE.md`, rule file, or any
> source file without first showing the exact diff and getting explicit confirmation (via
> `AskUserQuestion`). New files (that don't exist yet) may be written directly. You only ever *add* or
> *append inside managed `<!-- midas:begin -->` markers* — you never rewrite hand-authored content.

## Procedure

### Step 1 — Inventory: code AND intent (scout)
Dispatch **scout** subagents to extract, read-only: the file/dir tree, manifests (`package.json`,
`pyproject.toml`, `go.mod`, `Cargo.toml`, …), languages/frameworks + **pinned versions** (verify with
Context7), test setup, CI, and any existing `AGENTS.md` / `CLAUDE.md` / `.cursor` / `.windsurf`. **Also
harvest the project's stated intent** — `README*`, `docs/`, any brief/spec/`NOTES`, and the manifest
`description` — so the product context comes from what's written, not invented (feeds Step 4). Write
`product/inventory.md`. Playbook: `harness/pipeline/0b-codebase-inventory.md`.
**Scan robustly:** read the repo's files (manifests/source/tests), not local toolchains a sandbox may
lack; run probes independently and swallow benign "not found" (`… || true`) so absence is data, not an error.

### Step 2 — Infer the de-facto architecture (orchestrate)
From the inventory, infer the real architecture (components, data flow, boundaries) and write
`product/architecture.md` describing **what exists** (not an ideal). Record significant existing
decisions as ADRs under `product/adr/`, marked "as-built".

### Step 3 — Reverse-engineer rules from the real code (the brownfield keystone)
Derive `harness/rules/*` and `product/conventions.md` from the **actual conventions in the code**
(folder structure, naming, error handling, test policy) — **codify reality**. Where the code violates a
sensible rule, do **not** rewrite it: record the gap as future-sprint **debt** in `product/debt.md`.
This is the inverse of greenfield Phase 5 (which invents rules); here you extract them.

### Step 4 — Backfill product context from the harvested docs (document-existing mode)
Using the intent harvested in Step 1, write `product/idea.md` (and, where the docs support it,
`product/business-plan.md`) in **document-existing** mode: record the project's *actual* purpose,
audience, and constraints — lifted from the README/docs with the source cited — rather than inventing
them. Follow **infer → SHOW → confirm**: surface what you derived for the user to accept or correct; never
silently bake it in. If the harvested intent **conflicts** with what the code/manifests show (a stale or
aspirational README), tag that field **DISPUTED** and confirm it — never silently prefer one source.
Genuinely-unknown fields stay blank for the gap loop. Skipped or backfilled gates carry a **recorded
assumption** in `state.yaml` (mirrored to `STATE.md`) and an honest `entry_stage`.

### Step 5 — Baseline audit
Run `/midas-tribunal --depth standard` (or a `/close-sprint`-style conformance pass) to establish a
**drift baseline** vs the just-derived rules. Freeze it to `.harness/audits/` so future sprints measure
against a known starting point.

### Step 6 — Wire the harness (dry-run + diff-confirm)
For each file:
- **New file** (`harness/state.yaml`, `product/*`, a missing `CLAUDE.md`/adapters) → write directly.
- **Pre-existing `AGENTS.md` / `CLAUDE.md` / `.mcp.json`** → compute the managed-marker block, **show the
  diff**, and `AskUserQuestion` to confirm before writing. On decline, print the block for manual paste.
- Generate the tool adapters via `/midas-doctor` (the single render path).
Set `harness/state.yaml`: `mode: brownfield` and the `entry_stage` by maturity — **`architecture_rules`
for an E2 (partial) repo** (record `tech_architecture` as a deliberately-skipped gate; the as-built
`product/architecture.md` + ADRs are still written, so `/define-conventions` runs under its
"`architecture_rules` resuming" precondition rather than bouncing), **`sprint_planning` for an E3 (mature)
repo** once rules + a baseline audit are in place. Record an assumption in `state.yaml` for every skipped gate.

## Exit gate (adoption complete)
- [ ] `product/inventory.md` + `product/architecture.md` (as-built) written; stack versions Context7-verified.
- [ ] Rules derived from the real code; violations logged as debt (`product/debt.md`), not silently rewritten.
- [ ] No pre-existing `AGENTS.md`/`CLAUDE.md`/source modified without a confirmed diff.
- [ ] Baseline audit frozen to `.harness/audits/`.
- [ ] `state.yaml` records `mode: brownfield`, `entry_stage`, and assumptions for skipped gates.
- [ ] Next action printed: `/define-conventions` for an E2 (partial) repo, `/plan-sprints` for an E3 (mature) repo.

## Tier & cost
Inventory + evidence → **scout** (Haiku). Architecture inference, rule derivation, baseline audit, and
every diff/confirm decision → **orchestrate** (Opus). Drafting docs → **build** (Sonnet). Context7 verifies
the existing stack's versions before any rule mentions an API.
