---
name: midas-sweep
description: "Hygiene and dead-flow sweep — find orphans, stale docs, ledger drift, and harness mismatches; freeze to {runs}/sweeps/sweep-NN.md. Optional --fix with explicit confirm. Use on demand, after brownfield adopt, or before closing a large sprint."
metadata:
  midas-argument-hint: "[code|docs|harness|all] [--depth quick|standard] [--fix]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-sweep — Hygiene, cleanup & dead-flow detection

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> Read **`paths.state`** first. No precondition stage — runs anytime. If no `{product}/` tree and no app source, limit to harness/docs consistency.

> **Paths:** Engine = `<paths.engine>/`; scripts = `<paths.scripts>/`; `{runs}/` = `paths.runs`. See `AGENTS.md` § Path resolution.

Standing **hygiene pass** (not a phase gate): find dead weight and drift, report ranked by severity, apply **safe** cleanups only with explicit user confirmation. Unlike `/midas-doctor` (adapters) or `/midas-tribunal` (decisions), sweep asks *what on disk is unused, unreachable, or lying?*

**Recommended checkpoints** (surfaced by `/midas-status`, never forced): post-adopt, pre-close-sprint (large/messy), pre-plan-sprints (`features.json` reconcile). Non-advancing — never changes `stage`.

## Does / Does not

| Does | Does not |
|---|---|
| Index, classify, rank, freeze `{runs}/sweeps/sweep-NN.md` | Advance `stage` or pass gates |
| Optional `--fix` after numbered plan + explicit yes | Silently delete or rewrite business/architecture decisions |
| Emit `MIDAS_SWEEP_RESULT` tally | Replace `/midas-security-audit`, `/midas-tribunal`, `/midas-doctor`, or `/close-sprint` |

## Scope & depth

**Scope** (default `all`): `code` (source, routes, imports, playbooks vs `src/*`) · `docs` (`{product}/*`, broken links, stale OPEN questions) · `harness` (state vs sprint/gate files, stale audits) · `all` (every row).

**Depth** (`--depth`, default `standard`): `quick` = scout index only (grep/import cross-refs, cap 15 findings) · `standard` = scout index + build classification + ranked report.

**Fix mode** (`--fix`): off by default. Present numbered plan; require explicit yes (or per-item approval) before any write/delete. List path before delete. Prefer **archive** (`{product}/archive/` or sweep note) over hard delete.

## Finding categories

Classify every hit; cite `path` or `path:line`.

| Category | Examples | Severity |
|---|---|---|
| `dead-flow` | Route/page with no inbound link, nav, or test caller; playbook `Trigger` never matches `src/*` | high |
| `orphan` | Module never imported; export only self-referenced | medium |
| `ledger-drift` | `features.json` `passing` with empty `evidence`; code feature absent from ledger; roadmap sprint without `{product}/sprints/NN-*.md` | high |
| `stale-doc` | OPEN question answered in `{product}/idea.md`; doc cites deleted path | medium |
| `harness-drift` | `state.yaml` sprint id without file; gate disagrees with `stage` (`node <paths.scripts>/doctor.mjs --gates-only` if present); skill in docs missing under `<paths.engine>/skills/` | medium |
| `hygiene` | Commented-out blocks; bare `TODO`; duplicate utility | low |
| `dependency` | Manifest dep with zero imports (flag only — no remove without OK) | low |

## Procedure

### 1. Read state + pick NN (scout)
Read **`paths.state`**. Resolve scope + depth. Allocate next `sweep-NN` under `{runs}/sweeps/`. Dispatch **scout** for an **index pack** (path lists + grep hits, not whole trees):

- **Code:** entrypoints, routes, barrel exports; grep importers; nav/sitemap vs route files; API routes vs frontend calls/tests; playbook `Trigger` vs `src/*`.
- **Docs/harness:** `features.json` vs routes/tests; `roadmap.md` vs `{product}/sprints/`; `open-questions.md` vs `{product}/idea.md`; `state.yaml` `sprints[]` vs files; `{runs}/audits/` vs sprint status; optional `doctor.mjs --gates-only`.
- **Hygiene greps:** commented-out code (`^\s*(//|#).*[;{}()]`), bare `TODO`, duplicate utility filenames.

### 2. Classify + rank (build)
Merge scout packs; dedupe. Assign `severity` + `category` + `evidence`. Sort high → medium → low.

### 3. Report (always)
Print table `| # | severity | category | path | note |`, one-line summary, recommended next command. Zero findings → say so plainly.

### 4. Freeze the record
Write `{runs}/sweeps/sweep-NN.md` (append-only): scope, depth, date, `stage` snapshot; gate-parseable tally:

```
MIDAS_SWEEP_RESULT: dead_flows=N orphans=N ledger_drift=N stale_docs=N harness_drift=N hygiene=N verdict=clean|report|fixed
```

`verdict=clean` only when every count is 0. Full findings table + fix plan applied (or "none — report only").

### 5. Optional fix (`--fix` only)
After report, if `--fix`:

1. Numbered plan — each line: action (`delete` | `archive` | `edit` | `reconcile`), path, rationale. **No `high` dead-flow removal without per-item OK.**
2. On confirm, delegate safe edits: reconcile `features.json` status/evidence only; close answered `open-questions.md` rows; remove approved commented blocks; update doc links.
3. Re-run affected checks; update record `verdict=fixed`.
4. If adapters/rules changed: `👉 Run /midas-doctor`.

## Rule contract

Graded at Phase 8 via `<paths.engine>/rules/hygiene.md`:

- **Brownfield:** sweep record this sprint cycle, or `sweep: skipped — reason` in audit, required before close.
- **Any mode:** unresolved high `dead-flow` / `ledger-drift` rows must appear in audit as fixed, deferred, or accepted.

## Tier & cost

Indexing + greps → **scout**. Classification, report, confirmed fixes → **build**. Escalate to **orchestrate** only for scope/rule-amendment decisions — sweep reports; it does not amend rules.
