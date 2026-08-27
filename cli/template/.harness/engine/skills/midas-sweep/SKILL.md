---
name: midas-sweep
description: Hygiene and dead-flow sweep — find orphans, stale docs, ledger drift, and harness mismatches; freeze to {runs}/sweeps/sweep-NN.md. Optional --fix with explicit confirm. Use on demand, after brownfield adopt, or before closing a large sprint.
user-invocable: true
disable-model-invocation: true
user-surface: internal
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[code|docs|product|harness|all] [--depth quick|standard] [--fix]"
---

# midas-sweep — Hygiene, cleanup & dead-flow detection

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Surface:** `internal` (ADR-013) — prefer `/midas-hygiene` / `/close-sprint` / adopt path-pass; power-user may still type this slash.
> No stage precondition — runs anytime. No `{product}/` + no app source → limit to harness/docs consistency.
> Record shape: `<paths.engine>/templates/sweep-record.md`. Tally: `<paths.engine>/templates/audit-checklists.md` § Parseable tally lines.

Standing **hygiene pass** (not a phase gate): find dead weight and drift, report ranked by severity, apply **safe** cleanups only with explicit user confirmation. Unlike `/midas-doctor` (adapters) or `/midas-tribunal` (decisions), sweep asks *what on disk is unused, unreachable, or lying?*

**Recommended checkpoints:** prefer **`/midas-hygiene`** (primary) for product scopes; this body is the path-pass procedure. Non-advancing — never changes `stage`.

## Does / Does not

| Does | Does not |
|---|---|
| Index, classify, rank, freeze `{runs}/sweeps/sweep-NN.md` | Advance `stage` or pass gates |
| Optional `--fix` after numbered plan + explicit yes | Silently delete or rewrite business/architecture decisions |
| Emit `MIDAS_SWEEP_RESULT` tally | Replace `/midas-hygiene`, `/midas-security-audit`, `/midas-tribunal`, `/midas-doctor`, or `/close-sprint` |

## Scope & depth

**Scope** (default `all` for power-user slash; **`/midas-hygiene` always passes `product`**):
- `code` — source, routes, imports, playbooks vs `src/*`
- `docs` — `{product}/*`, broken links, stale OPEN questions
- `product` — `code` + `docs` only (**excludes** harness-drift). Prefer this from `/midas-hygiene`.
- `harness` — state vs sprint/gate files, stale audits (power-user / install health — not product hygiene)
- `all` — every row including harness (legacy; do **not** use from `/midas-hygiene`)

When scope is `product`, `code`, or `docs`: set `harness_drift=0` in the tally (do not hunt harness-drift).

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
| `needs_review` | Rule or playbook with no `## Amendment` (or stale Amendment) older than **180 days** — flag for human re-check; do not auto-delete | medium |
| `harness-drift` | `state.yaml` sprint id without file; gate disagrees with `stage` (`node <paths.scripts>/doctor.mjs --gates-only` if present); skill in docs missing under `<paths.engine>/skills/` | medium |
| `hygiene` | Commented-out blocks; bare `TODO`; duplicate utility | low |
| `dependency` | Manifest dep with zero imports (flag only — no remove without OK) | low |

## Procedure

### 1. Read state + pick NN (scout)
Read **`paths.state`**. Resolve scope + depth. Allocate next `sweep-NN` under `{runs}/sweeps/`. Dispatch **scout** for an **index pack** (path lists + grep hits, not whole trees):

- **Code:** entrypoints, routes, barrel exports; grep importers; nav/sitemap vs route files; API routes vs frontend calls/tests; playbook `Trigger` vs `src/*`.
- **Docs/harness:** `features.json` vs routes/tests; `roadmap.md` vs `{product}/sprints/`; `open-questions.md` vs `{product}/idea.md`; `state.yaml` `sprints[]` vs files; `{runs}/audits/` vs sprint status; optional `doctor.mjs --gates-only`.
- **Aging (needs_review):** for each `<paths.rules>/*.md` and `{product}/playbooks/*.md`, read the latest `## Amendment` date (else file mtime). If older than **180 days**, emit `needs_review` (path + last date). Do not auto-edit.
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
- **Aging:** `needs_review` rows (rules/playbooks >180 days without Amendment) must appear in the freeze; do not silently drop them.

## Tier & delegation

Indexing + greps → **scout**. Classification, report, confirmed fixes → **build**. Escalate to **orchestrate** only for scope/rule-amendment decisions — sweep reports; it does not amend rules.
