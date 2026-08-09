---
name: midas-lean-review
description: Over-engineering review — delete-list for the current diff or named paths (stdlib/native/yagni/shrink). Use before /close-sprint on a fat diff, after a feature branch, or when the user asks what to cut. Complements correctness review; does not replace /midas-sweep or /close-sprint.
user-invocable: true
disable-model-invocation: true
user-surface: internal
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[--scope diff|paths|repo] [--freeze] [path ...]"
---

# midas-lean-review — What to delete (over-engineering only)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Surface:** `internal` (ADR-013) — prefer `/close-sprint` / fat-diff path-pass; power-user may still type this slash.
> **Rule:** `<paths.engine>/rules/lean-ladder.md`. Tally shape: `<paths.engine>/templates/audit-checklists.md`.

Standing **complexity review** (not a phase gate): hunt unnecessary code in the working tree / named
paths. Report a delete-list; do **not** apply fixes unless the user explicitly asks after the report.
Correctness, security, and performance bugs are **out of scope** — route those to normal review,
`/midas-security-audit`, or `/close-sprint`.

Inspired by Ponytail's review format; Midas-owned procedure and freeze path.

## Does / Does not

| Does | Does not |
|---|---|
| Rank over-engineering findings (`delete` / `stdlib` / `native` / `yagni` / `shrink`) | Advance `stage` or pass gates |
| Optional `{runs}/lean/lean-NN.md` with `--freeze` | Silently rewrite the tree |
| Emit `MIDAS_LEAN_RESULT` when freezing | Replace `/midas-sweep`, `/midas-qa`, or Phase-8 audit |

## Scope

| `--scope` | Default target |
|---|---|
| `diff` (default) | `git diff` against the default branch (or staged+unstaged if no upstream) |
| `paths` | Only user-named paths |
| `repo` | Broad pass — cap findings; prefer `diff` for sprint work |

## Finding tags (one line each)

`path:Lstart-Lend: tag: what to cut. Replacement.`

| Tag | Meaning |
|---|---|
| `delete` | Dead / unused flexibility / speculative feature → nothing replaces it |
| `stdlib` | Hand-rolled thing the standard library already does — name the API |
| `native` | Dep or code doing what the platform already does — name the feature |
| `yagni` | Abstraction with one implementation, config nobody sets, layer with one caller |
| `shrink` | Same logic, fewer lines — show the shorter form |

Never flag the lean minimum test/assert self-check as bloat. Never propose cutting trust-boundary
validation, security, or accessibility required by sibling rules.

## Procedure

1. **Read `paths.state`.** Resolve scope. If `diff` and git is dirty/empty, say so and stop or fall back to named paths.
2. **Scout** — collect the file list + relevant hunks (do not paste entire files into the report).
3. **Build** — climb `<paths.engine>/rules/lean-ladder.md` against each substantial addition; emit findings only.
4. **Report** — one line per finding; end with `net: -N lines possible` (estimate) or `Lean already. Ship.`
5. **`--freeze` (optional)** — write `{runs}/lean/lean-NN.md` (NN monotonic under `{runs}/lean/`):

```
MIDAS_LEAN_RESULT: findings=N high=N net_lines=-N verdict=report|clean
```

`verdict=clean` only when `findings=0`. Include the findings table. Do not set `gate: passed`.

6. If the user asks to apply cuts after the report → delegate to **build**; re-run a quick pass; do not invent scope.

## Tier & delegation
- **Dispatch + report / optional freeze:** `build` → `midas-builder`.
- **Diff / path extraction:** `scout` → `midas-scout`.
- No orchestrate gate verdict.
- Respect `cost_profile`.

## When NOT
- Dead routes / ledger drift → `/midas-sweep`.
- Sprint conformance audit → `/close-sprint`.
- Security-focused scan → `/midas-security-audit`.
- "Make the UI authentic" → `/midas-design`.

## Exit gate
- [ ] Findings use the one-line tag format (or `Lean already. Ship.`).
- [ ] Out-of-scope issues (security/correctness) explicitly deferred to the right skill — not silently dropped as "lean".
- [ ] No tree writes unless the user asked after the report; `--freeze` only writes the lean record.
- [ ] Next action named (apply cuts / `/midas-progress` / `/close-sprint` / nothing).
