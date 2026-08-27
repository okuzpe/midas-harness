---
name: midas-investigate
description: "Root-cause investigation before bug fixes — Iron Law + 3 strikes; freeze {runs}/investigate/inv-NN.md. Use when debugging failures, after failed self-fixes, or when asked to investigate. Complements /midas-explore (open-ended) and verification.md inner loop."
metadata:
  midas-argument-hint: "[topic|symptom] [--dry-run] [--continue NN]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
  midas-user-surface: primary
---
# midas-investigate — root-cause before fix (non-advancing)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> No stage precondition — runs anytime. Never mutates `paths.state` stage/gates.
> Template: `<paths.engine>/templates/investigate-record.md` → `{runs}/investigate/inv-NN.md`.
> Playbook: `<paths.engine>/templates/playbooks/debug-root-cause.md`.

Standing **debug investigation** (gstack `/investigate` / Ley de Hierro): do not ship a speculative
fix until symptoms, flow, and a falsifiable root-cause hypothesis are frozen. Distinct from
`/midas-explore` (open-ended scoping outside the pipeline) and path-pass `midas-qa` (ad-hoc smoke, internal).

## Does / Does not

| Does | Does not |
|---|---|
| Freeze `{runs}/investigate/inv-NN.md` with symptoms → flow → hypothesis → evidence | Advance `stage` or pass Phase-8 gates |
| Enforce **Iron Law** + **3 strikes** before more blind fixes | Auto-apply production fixes without human OK on careful-class ops |
| Point to regression proof (`testing.md`) once a fix is chosen | Replace `/midas-verify`, `/close-sprint`, or `/midas-tribunal` |

## Iron Law + 3 strikes

1. **Iron Law:** no code fix for a defect until an investigation record exists for this failure
   (or the human explicitly waives with a one-line reason in progress notes).
2. **3 strikes:** after **3** failed fix attempts that do not deepen the investigation (new evidence
   or revised hypothesis), **stop** — surface the blocker and the latest `inv-NN.md`. Do not keep
   guessing. Matches Phase-7’s ~3 self-fix bound in `7-sprint-execution.md` / `verification.md`.

## Args

| Arg | Meaning |
|---|---|
| `topic` / symptom text | What failed (error, test id, user report) |
| `--continue NN` | Amend existing `inv-NN.md` (new evidence / strike row) |
| `--dry-run` | Print draft in chat only — no write |

## Procedure

### 1. Orient (scout)
Read **`paths.state`**. Resolve `{runs}/`. Dispatch **scout** for a tight pack:

- Failing test / log / verify row the user named
- Suspected module paths from `{product}/architecture.md` (if present)
- Latest related `{runs}/verifications/` or progress **Learned** rows

### 2. Trace (build)
Fill the template:

| Section | Content |
|---|---|
| **Symptoms** | Observable failure (command, selector, assertion) |
| **Flow** | Data/control path from input → failure site (`file:line` when known) |
| **Hypotheses** | Ranked, falsifiable; mark active vs rejected |
| **Evidence** | What confirmed/rejected each hypothesis |
| **Strikes** | Fix attempts that failed (max 3 before stop) |
| **Next** | Proposed fix **or** stop/ask-human |

Keep ≤ ~100 lines. Prefer tables.

### 3. Freeze (unless `--dry-run`)
Allocate next `inv-NN` under `{runs}/investigate/` (or update `--continue`). Emit:

```
MIDAS_INVESTIGATE_RESULT: id=NN hypotheses=N strikes=N verdict=frozen|dry-run|stop
```

`verdict=stop` when strikes ≥ 3 without a confirmed root cause. Never set `gate: passed`.

### 4. Handoff
- Ready to fix → implement with **regression** proof (`testing.md`); cite `inv-NN` in progress.
- Recurring pattern → propose `/midas-capture` (recommend-don't-wall).
- Prod-adjacent → honour `safety-guardrails.md` (careful/freeze/guard).

## Exit gate
- [ ] Symptom and at least one falsifiable hypothesis recorded (or dry-run shown).
- [ ] `--dry-run` → no write; otherwise `inv-NN.md` on disk with tally line.
- [ ] Strikes ≥ 3 → `verdict=stop` and no further speculative fixes this session.
- [ ] `paths.state` stage/gates untouched.

## Tier & delegation
- **Dispatch + freeze write:** `build` → `midas-builder`.
- **Log/test/path extraction:** `scout` → `midas-scout`.
- No orchestrate gate verdict. Respect `cost_profile`.

## When NOT
- Open-ended product scoping → `/midas-explore`.
- UI acceptance proof → `/midas-verify`.
- Branch smoke without root-cause need → path-pass `midas-qa` (internal; not gate proof).
- Decision quality debate → `/midas-tribunal`.
- Sprint conformance → `/close-sprint`.
