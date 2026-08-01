---
name: midas-tribunal
description: Standing adversarial debate — Defense vs Prosecution + Catfish across idea, market, arch, scope, rules, and code; orchestrator judges per claim and freezes {runs}/debates/debate-NN.md. Use on demand or before big gates (pre-go/no-go, pre-rules-freeze, pre-ship); not a sprint gate.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [sequential-thinking]
argument-hint: "[whole|architecture|scope|idea|market|design|unit-economics|security|rules] [--depth quick|standard|tribunal]"
---

# midas-tribunal — whole-project adversarial debate

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> Read **`paths.state`**. No artifacts on disk → report nothing to try and stop.

## Does / Does not

| Does | Does not |
|---|---|
| Argue whether decisions are *right* across `{product}/*`, rules, `src/*` | Advance `stage` or set `gate: passed` |
| Freeze ranked findings to `{runs}/debates/debate-NN.md` | Grade its own arguments (producer ≠ judge) |
| Propose findings→action bridge on user go-ahead | Replace `/close-sprint` (that audits diff vs frozen rules) |

Standing tribunal at any stage. You **convene and judge**; debaters are build/scout tiers. Recommended checkpoints (from `/midas-status`, never forced): pre-go/no-go, pre-rules-freeze, pre-ship. Research rationale: `<paths.engine>/research/debate-method.md`. Record shape: `<paths.engine>/templates/debate-record.md`; shared audit fragments: `<paths.engine>/templates/audit-checklists.md`.

## Lenses (parallel seats → synthesize)

Activate per scope; one persona + provocation + on-disk target each:

| Lens | Provocation | Target |
|---|---|---|
| Premortem | "12 months out, failed — why?" | whole |
| Skeptic | "Why build this?" | `{product}/idea.md` |
| Inverter | "What guarantees failure?" | `{product}/roadmap.md` |
| Economist | "Does the model close?" | `{product}/business-plan.md` |
| Competitor | "Why won't an incumbent crush this?" | `{product}/market.md` |
| User | "Would a real user switch?" | idea + `{product}/design-system.md` |
| Design Critic | "Distinctive or generic slop? Logo-swap pass?" | `{product}/design-direction.md` + design-system + `<paths.engine>/rules/visual-design.md` § Product authenticity + UI `src/*` (+ `{runs}/design/` if any) |
| ATAM | "Risks, sensitivity, tradeoffs?" | `{product}/architecture.md` + `adr/*` |
| Maintainer | "Will the next dev curse this?" | `{product}/adr/*` |
| Security (STRIDE) | "Where do I get in?" | `<paths.engine>/rules/security.md` + `src/*` |
| Reliability | "What fails silently till prod?" | architecture + `<paths.engine>/rules/testing.md` |
| Simplifier | "What survives the cut?" | roadmap + rules + scope |

## Scope & depth

**Scope** (default `whole`): `whole` · `architecture` · `scope` · `idea` · `market` · `design` · `unit-economics` · `security` · `rules` — activates matching lenses (`design` → Design Critic + User).

**Depth** (`--depth`, default `standard`, clamped by `cost_profile`):

| Depth | Seats | Rounds | Use |
|---|---|---|---|
| `quick` | 1 Prosecution + 1 Defense, no Catfish | 1 | fast sanity |
| `standard` | + Catfish, scope lenses | 2 | pre-gate |
| `tribunal` | all relevant lenses + Catfish + 3-seat PoLL jury | 3 + re-verify | pre-ship / pre-architecture-freeze |

`max_savings` forbids `tribunal` + jury; `max_quality` defaults to `tribunal`.

## Procedure

### Round 0 — Convene & index (scout)
Resolve scope + depth. Scout builds per-lens **evidence packs** (exact `{product}/*` paths, effective rules, `src/*` `file:line`, ADRs). Inject only each lens's slice.

### Round 1 — Opening positions (build, parallel)
Per active lens: **Defense** (steelman, cited) + **Prosecution** (`{claim, severity, evidence}`) **simultaneously**. **Strike uncited claims** before they reach the judge.

### Round 2 — Cross-rebuttal (build) — *skip at `quick`*
Rebut with new/re-read evidence only. **Catfish** on agreement to force counter-argument. Fresh scout re-verifies contested facts → `verified` | `speculative`.

### Round 3 — Verdict (orchestrator, independent)
Shuffle order; mask authorship. Per claim: `upheld | rejected | unproven` + evidence + rationale. Score = severity (CRIT/HIGH/MED/LOW) × confidence; `speculative` ≠ CRIT. **"So what?" filter** (cap LOW nits, max 3). **Mandatory minority/dissent** — Catfish never silently dropped. Action per upheld: `fix · amend-rule · accept-with-rationale · defer`. **`criticals=0 highs=0` is valid** — do not invent severity.

### Freeze & bridge
Write **`{runs}/debates/debate-NN.md`** from `<paths.engine>/templates/debate-record.md`
(NN monotonic; immutable) — **do not invent a parallel shape**. Required machine line:

```
MIDAS_TRIBUNAL_RESULT: criticals=X highs=Y
```

Propose bridge on user go-ahead:
- `fix` → task at next `/start-sprint` (UI authenticity / generic-landing findings → prefer `/midas-design` before more JSX)
- `amend-rule` → `{product}/adr/ADR-00X` (thesis/antithesis/synthesis)
- `defer` → `OQ-NN` in `{product}/open-questions.md`

MAY set `last_tribunal: { n, criticals, at }` in `paths.state`. **Never advance `stage` or set `gate: passed`.**

## Safeguards
1. **Evidence-or-struck** — path or `file:line`; no citation → struck.
2. **Mandatory dissent** — ruled `upheld|rejected|unproven`, never dropped.
3. **Nit-cap** — material findings first.
4. **Clean tally is valid.**
5. **Independent re-verify** — fresh scout context for contested facts.
6. **No self-grading** — at `tribunal` depth, 3-seat PoLL jury + orchestrator tiebreak.
7. **Bias hygiene** — shuffle, mask seats, distrust until scout re-opens file.

## Tier & cost
Verdict + freeze → **orchestrate**. Debaters → **build**. Evidence + re-verify → **scout**. Security lenses: installed specialist if present; else `midas-builder` / `midas-scout`. Respect `cost_profile`.

## Exit gate (tribunal complete)
- [ ] Every surviving claim cites on-disk evidence; uncited struck (logged).
- [ ] Per-claim verdict; minority/dissent recorded; LOW nits capped.
- [ ] `{runs}/debates/debate-NN.md` frozen from `debate-record.md` with `MIDAS_TRIBUNAL_RESULT`.
- [ ] Each upheld finding has one action; bridge proposed to user.
- [ ] `stage` NOT advanced; no gate marked passed.
