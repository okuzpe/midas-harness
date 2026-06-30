---
name: midas-sweep
description: Hygiene and dead-flow sweep — find orphan code, unreachable routes, stale docs, zombie playbooks, features.json drift, and harness artifacts that no longer match reality. Reports first; optional --fix applies safe cleanups only with explicit user confirm. Freezes findings to .harness/sweeps/sweep-NN.md. Use on demand, after brownfield adopt, or before closing a large sprint.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[code|docs|harness|all] [--depth quick|standard] [--fix]"
---

# midas-sweep — Hygiene, cleanup & dead-flow detection

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; this skill has no precondition stage — it runs at any stage — but
> if the project has no `product/` tree and no application source yet, report that there is little to
> sweep and limit the pass to harness/docs consistency.

A standing **hygiene pass**, not a phase gate. You find **dead weight** (orphans, stale links, flows
nothing reaches) and **drift** (ledger says X, disk says Y), report it ranked by severity, and — only
with explicit user confirmation — apply **safe** cleanups. Unlike `/midas-doctor` (adapter sync) or
`/midas-tribunal` (adversarial *decisions* audit), sweep asks: *what on disk is unused, unreachable, or
lying about itself?*

> **Recommended checkpoints** (surfaced by `/midas-status`, never forced):
> **post-adopt** (after `/midas-adopt` inventory, before wiring), **pre-close-sprint** (large or messy
> sprint, before `/close-sprint`), and **pre-plan-sprints** (reconcile `product/features.json` vs reality).
> Non-advancing — it never changes `stage` by itself.

## Scope & depth

**Scope** (positional arg, default `all`):

| Scope | What it sweeps |
|---|---|
| `code` | source, tests, routes, imports, playbooks vs `src/*` |
| `docs` | `product/*`, README, broken internal links, answered open questions still OPEN |
| `harness` | `state.yaml` vs sprint/gate files, skills referenced in docs, stale audits |
| `all` | every row above |

**Depth** (`--depth`, default `standard`):

| Depth | Seats | Use |
|---|---|---|
| `quick` | scout index only — grep/import cross-refs, no judgment | fast pre-commit sanity |
| `standard` | scout index + build classification + ranked report | default; pre-close-sprint |

**Fix mode** (`--fix`): off by default. When passed, present a **numbered fix plan** and require an
explicit **yes** (or per-item approval) before any write or delete. Never delete without listing the
path first. Prefer **archive** (`product/archive/` or note in the sweep record) over hard delete when
the item might still be useful history.

## What counts as a finding

Classify every hit into one category; cite `path` or `path:line`.

| Category | Examples | Default severity |
|---|---|---|
| `dead-flow` | API route or page with no inbound link, nav entry, or test caller; playbook `Trigger` never matches `src/*` | high |
| `orphan` | file/module never imported; export only referenced from tests of itself | medium |
| `ledger-drift` | `product/features.json` `passing` with empty `evidence`; feature in code absent from ledger; sprint in `roadmap.md` with no `product/sprints/NN-*.md` | high |
| `stale-doc` | `product/open-questions.md` still OPEN but answered in `product/idea.md`; doc cites deleted path; acceptance criterion references removed test | medium |
| `harness-drift` | `state.yaml` sprint id without file; gate record disagrees with `stage` (run `node scripts/doctor.mjs --gates-only` if present); skill named in docs but missing under `.claude/skills/` | medium |
| `hygiene` | commented-out code blocks; `TODO` without `TODO(owner):`; duplicate utility next to an existing one | low |
| `dependency` | manifest dep with zero imports (flag only — do not remove without user OK) | low |

**Not in scope** (use the right tool instead): security vulns → `/midas-security-audit`; whether
decisions were *right* → `/midas-tribunal`; adapter drift → `/midas-doctor`; sprint conformance →
`/close-sprint`.

## Procedure

### 1. Read state + pick NN (scout)
Read `harness/state.yaml`. Resolve scope + depth. Allocate the next `sweep-NN` id under
`.harness/sweeps/` (create the directory if missing). Dispatch **scout** subagents to build an
**index pack** — do not dump whole trees; return path lists and grep hits:

- **Imports graph (code scope):** entrypoints (`main`, `app/`, `pages/`, `src/index`), route files,
  barrel `index.*` exports; grep importers for each route/page/module flagged as suspicious.
- **Navigation / flow (code scope):** link targets in UI nav, sitemap, router config vs route files on
  disk; API routes referenced from frontend `fetch`/client calls or covered by `*.test.*`.
- **Playbooks (code scope):** for each `product/playbooks/*.md`, read the `Trigger` block; grep `src/`
  for the predicate — flag playbooks whose trigger has **zero** matches.
- **Ledger (docs/harness):** diff `product/features.json` against routes/tests; diff `product/roadmap.md`
  sprint list against `product/sprints/`; scan `product/open-questions.md` against `product/idea.md`.
- **Harness (harness scope):** compare `state.yaml` `sprints[]` to files; list `.harness/audits/`
  whose sprint is not `done` in state; optional `node scripts/doctor.mjs --gates-only` when
  `scripts/doctor.mjs` exists.
- **Hygiene greps (all):** `grep` for commented-out code (`^\s*(//|#).*[;{}()]`), bare `TODO` (no owner),
  duplicate filenames for utilities (`utils`, `helpers`).

### 2. Classify + rank (build)
Merge scout packs. Deduplicate. For each finding assign `severity` + `category` + `evidence`. Sort:
high → medium → low. Cap `--depth quick` at the top 15 findings.

### 3. Report (always)
Print a compact table:

```
| # | severity | category | path | note |
```

Then a one-line summary and the recommended next command (`/close-sprint`, `/midas-doctor`, manual
delete list, etc.). If zero findings: say so plainly.

### 4. Freeze the record
Write `.harness/sweeps/sweep-NN.md` (append-only). Include:

- Scope, depth, date, `state.yaml` `stage` snapshot
- The **gate-parseable tally line** (mirrors audit/verify/tribunal):
  ```
  MIDAS_SWEEP_RESULT: dead_flows=N orphans=N ledger_drift=N stale_docs=N harness_drift=N hygiene=N verdict=clean|report|fixed
  ```
  `verdict=clean` only when every count is 0.
- Full findings table + evidence column
- Fix plan applied (or "none — report only")

### 5. Optional fix (`--fix` only)
After the report, if `--fix`:

1. Propose a numbered plan — each line: action (`delete` | `archive` | `edit` | `reconcile`), path,
   rationale. **No action on `high` dead-flow removals without explicit per-item OK.**
2. On user confirm, delegate safe edits to **build**:
   - reconcile `features.json` `status`/`evidence` only (never rewrite spec fields)
   - close answered rows in `open-questions.md`
   - remove commented-out blocks the user approved
   - update doc links
3. Re-run the affected checks; update the sweep record `verdict=fixed` and list what changed.
4. If adapters or rules changed, remind: `👉 Run /midas-doctor`.

## Output

- **Console:** summary table + next action
- **Disk:** `.harness/sweeps/sweep-NN.md`
- **Never:** advance `stage`, silently delete, or rewrite business/architecture decisions

## Rule contract

Graded at Phase 8 via [`harness/rules/hygiene.md`](../../harness/rules/hygiene.md):

- **Brownfield** (`mode: brownfield`): a sweep record this sprint cycle, or `sweep: skipped — reason` in
  the audit, is **required** before close.
- **Any mode:** unresolved high-severity `dead-flow` / `ledger-drift` rows from a sweep must appear in
  the audit as fixed, deferred, or accepted — never silent.

## Tier & cost

Indexing + greps → **scout** (Haiku). Classification, report, and confirmed fixes → **build** (Sonnet).
Escalate to **orchestrate** only if a finding requires a scope or rule-amendment decision — sweep
reports it; it does not amend rules.
