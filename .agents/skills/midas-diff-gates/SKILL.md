---
name: midas-diff-gates
description: "Run diff-scoped test/quality gate receipts into {paths.cache}/gates/<run>/; use before close-sprint when production paths changed. Does not replace close-sprint or midas-verify."
metadata:
  midas-argument-hint: "[--run <id>] [--base <ref>]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-diff-gates — Diff-scoped gate receipts

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).

Mechanical **test + quality** receipts for the current working diff. Run before `/close-sprint` when
production paths changed. Does **not** replace `/midas-verify` (UI/API journeys) or Phase-8 rule
conformance — `/close-sprint` still owns the independent orchestrate audit.

## When to run

| Diff touches | Action |
|---|---|
| **Production paths** — product source, deploy config, public API contracts | Run both gates; freeze receipts under `{paths.cache}/gates/<run>/` |
| **Engine-only** contributor edits (`harness/`, `scripts/`, `cli/`, installer) | Skip OK — record reason in progress or audit notes |
| **Docs-only** (`docs/`, markdown rituals, no product source) | Skip OK — record reason |

## Commands

Use the **same** `--run` id for both scripts (default: sprint id or timestamp):

```bash
node <paths.scripts>/gates/test-gate.mjs --run <id> [--base <ref>]
node <paths.scripts>/gates/quality-gate.mjs --run <id> [--base <ref>]
```

Receipts:

- `{paths.cache}/gates/<run>/test.json`
- `{paths.cache}/gates/<run>/quality.json`

## Receipt semantics (`isPassingReceipt`)

A receipt **passes** when `status` is `pass` **or** `skipped` with a non-empty `reason`.
`fail` or `blocked` → **blocks** `/close-sprint` until fixed or re-run green.

## Procedure

1. Read `paths.state` + active sprint; resolve production diff (`git diff` vs base or staged).
2. If no production paths → log skip + reason; stop (no receipts required).
3. Run `test-gate.mjs` then `quality-gate.mjs` with the same `--run` id.
4. Confirm both receipts exist and satisfy `isPassingReceipt`; cite paths in `{runs}/sprints/NN-progress.md` or session notes.

## Does / Does not

| Does | Does not |
|---|---|
| Freeze deterministic test/quality receipts to cache | Advance `stage` or pass Phase-8 |
| Block close when gates fail/blocked | Replace `/midas-verify` or UI proof |
| Allow explicit skip for non-production diffs | Run LLM conformance audit |

## Tier & delegation

- **Run gates + verify receipts:** `build` → `midas-builder`.
- **Diff path extraction (scout):** delegate file-list / production-path classification to `midas-scout` when the diff is large.
- No orchestrate gate verdict — failures route to fix + re-run, then `/close-sprint`.
- Respect `cost_profile`.

## Exit gate

- [ ] Production diff → both `test.json` and `quality.json` exist under `{paths.cache}/gates/<run>/`.
- [ ] Each receipt is `pass` or `skipped` with reason (`isPassingReceipt`).
- [ ] Non-production diff → explicit skip recorded (progress, audit § notes, or session).
- [ ] `/close-sprint` not opened while any receipt is `fail` or `blocked`.
