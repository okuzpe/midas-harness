---
name: keel-tribunal
description: Standing whole-project adversarial debate. Convene a tribunal — steelman Defense vs red-team Prosecution plus a dissent-forcing Catfish — across idea, market, business model, architecture, scope, rules, and code. Every claim cites on-disk evidence or is struck; keel-orchestrator (Opus) judges per claim, records dissent, and freezes a ranked findings report to .harness/debates/debate-NN.md. Use on demand or before big gates (pre-architecture-freeze, pre-go/no-go, pre-ship). Not tied to a sprint — distinct from /close-sprint.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-required: [sequential-thinking]
argument-hint: "[whole|architecture|scope|idea|market|unit-economics|security|rules] [--depth quick|standard|tribunal]"
---

# keel-tribunal — Whole-Project Adversarial Debate

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; this skill has no precondition stage — it runs at any stage — but
> if the project has no artifacts on disk yet, report that there is nothing to put on trial and stop.

A standing **tribunal**, not a phase. You (the orchestrator) **convene and judge but write none of the
arguments** — the producer never grades its own homework. Debaters run on the build/scout tiers; you
render a verdict **per claim**. This is distinct from `/close-sprint` (single-sprint conformance vs
frozen rules): the tribunal argues *whether the decisions themselves are right*, across the whole
`product/*` + `harness/rules/*` + `src/*` surface.

Why this shape (grounded in research): multi-agent debate only beats single-pass critique when every
claim cites **checkable evidence**, the **producer is separated from the grader**, and **genuine
dissent is forced** — otherwise it degenerates to premature consensus, sycophancy, and judge bias.
Every rule below exists to defend one of those failure modes.

## The lenses (each a persona + provocation + on-disk target)

Activate the lenses relevant to the scope; run them as **parallel** seats (parallel thinking), then
synthesize.

| Lens (persona) | Provocation | Targets |
|---|---|---|
| Premortem | "It's 12 months out and the project failed — why?" | whole project |
| Skeptic / Devil's-Advocate | "Why is this idea actually worth building?" | `product/idea.md` |
| Inverter (Munger) | "What guarantees we fail? Are we doing it?" | `product/roadmap.md` |
| Economist / Unit-Economics | "Show me the money — does the model close?" | `product/business-plan.md` |
| Competitor / Red-Team | "Why won't an incumbent crush this in a quarter?" | `product/market.md` |
| User / Red-Hat | "Would a real user actually switch? Gut check." | idea + `product/design-system.md` |
| Architecture Tribunal (ATAM) | "Name the risks, sensitivity & tradeoff points." | `product/architecture.md` + `adr/*` |
| Maintainer / ADR-review | "Will the next dev curse these decisions?" | `product/adr/*` |
| Security Adversary (STRIDE) | "Walk each trust boundary — where do I get in?" | `harness/rules/security.md` + `src/*` |
| Reliability / FMEA | "What fails silently and is invisible till prod?" | architecture + `harness/rules/testing.md` |
| Simplifier / YAGNI | "Cut it. What survives the cut and why?" | roadmap + rules + scope |

## Scope & depth

**Scope** (positional arg, default `whole`):
`whole` · `architecture` · `scope` · `idea` · `market` · `unit-economics` · `security` · `rules`.
Each scope activates the matching subset of lenses (e.g. `architecture` → ATAM + Maintainer + Reliability).

**Depth** (`--depth`, default `standard`, clamped by `state.yaml.cost_profile`):

| Depth | Seats | Rounds | Use |
|---|---|---|---|
| `quick` | 1 Prosecution + 1 Defense, no Catfish | 1 (positions only) | fast sanity panel; cheap |
| `standard` | + Catfish, lenses for the scope | 2 (positions + rebuttal) | pre-gate review |
| `tribunal` | all relevant lenses + Catfish + 3-seat PoLL jury | 3 (+ independent re-verify) | pre-ship / pre-architecture-freeze |

`max_savings` forbids `tribunal` depth and the jury; `max_quality` defaults to `tribunal`.

## Procedure

### Round 0 — Convene & index (scout / Haiku)
Read `harness/state.yaml`. Resolve scope + depth. Dispatch **scout** subagents to build a per-lens
**evidence pack**: exact paths in `product/*`, the relevant `harness/rules/*` bodies, `src/*`
`file:line` ranges, `product/adr/*`. Inject only the slice each lens needs — never dump all rules.

### Round 1 — Opening positions (build / Sonnet, parallel, one seat per lens)
For each active lens dispatch a **Defense** seat (state the **steelman** of the target claim, cited)
and a **Prosecution** seat (file charges: `{claim, severity, evidence path|file:line}`). Present both
**simultaneously** (not as rebuttal) to avoid sycophancy escalation.
**Strike any claim lacking an on-disk citation before it advances to you.**

### Round 2 — Cross-rebuttal (build / Sonnet) — *skip at `--depth quick`*
Each side rebuts only with **new or re-read evidence** (no rhetoric-only moves). Inject the
**Catfish** on any claim where the two sides agree, to force a surviving counter-argument. Dispatch a
**fresh scout in clean context** to re-verify contested factual claims (so the verdict isn't biased by
the transcript); label each `verified` or `speculative`.

### Round 3 — Verdict (you, the orchestrator — independently)
Shuffle argument order and mask seat authorship. For each claim render `upheld | rejected | unproven`
with the cited evidence and a one-line rationale. Score upheld = **severity (CRIT/HIGH/MED/LOW) ×
confidence (verified/speculative)**; a `speculative` claim may not be ranked CRIT. Apply the
**"so what?" filter** (cap LOW stylistic nits, e.g. max 3, collapsed). Record a **mandatory
minority/dissent** section — a Catfish or lens objection is never silently dropped. Assign each upheld
finding an action: `fix · amend-rule · accept-with-rationale · defer`.
**"Nothing material found" (`criticals=0 highs=0`) is a valid, honest verdict — do not invent severity.**

### Freeze & bridge
Write `.harness/debates/debate-NN.md` (NN monotonic, mirroring `audit-NN.md`) — frozen and immutable:
the gate-parseable tally line, the ranked findings table, the dissent section, the recommended-action
routing, and the full transcript as a collapsible appendix. Then **propose** (and on the user's
go-ahead, apply) the findings→action bridge:
- `fix` → a task surfaced at the next `/start-sprint`;
- `amend-rule` → open `product/adr/ADR-00X` capturing thesis / antithesis / synthesis;
- `defer` → append `OQ-NN` to `product/open-questions.md` (non-blocking, logged).

You MAY set `last_tribunal: { n: NN, criticals: X, at: <date> }` in `state.yaml` (read-modify-write the
whole file per schema). **Never set `gate: passed` or advance `stage`** — the tribunal informs; the
gates decide.

## Output format (`.harness/debates/debate-NN.md`)

```markdown
# Tribunal debate-NN — scope: <scope> — depth: <depth>
Convened: <YYYY-MM-DD> · Judge: keel-orchestrator (claude-opus-4-8) · cost_profile: <profile>

## Verdict tally
UPHELD: n (CRIT a · HIGH b · MED c)  ·  REJECTED: n  ·  UNPROVEN: n  ·  DISSENTS: n
KEEL_TRIBUNAL_RESULT: criticals=X highs=Y        # gate-parseable line

## Ranked findings  (severity × confidence)
| ID | Lens | Severity | Conf | Claim | Evidence (path / file:line) | Verdict | Action |
|----|------|----------|------|-------|-----------------------------|---------|--------|

## Minority / dissent
- <claim id> (<seat>): <what is still contested and the judge's ruling>

## Recommended actions (findings → action bridge)
- <id> fix    → task at next /start-sprint
- <id> amend  → open product/adr/ADR-00X (thesis/antithesis/synthesis)
- <id> defer  → product/open-questions.md OQ-NN

## Full transcript (appendix)
<round-by-round positions, rebuttals, struck-for-no-evidence claims, re-verification results>
```

## Safeguards (avoid theater)
1. **Evidence-or-struck** — every finding is falsifiable and cites an on-disk artifact path or `src`
   `file:line`. No citation → struck before you see it.
2. **Mandatory dissent** — you MUST record a minority/dissent section; a Catfish objection is ruled
   `upheld|rejected|unproven` with a cited reason, never dropped.
3. **"So what?" / nit-cap** — weight by owner/business impact, not volume; cap LOW nits so the report
   leads with what is material.
4. **"Nothing material found" is valid** — a clean tally is a legitimate, recorded outcome.
5. **Independent verification** — re-check contested claims in fresh scout context; tag
   `verified` vs `speculative`.
6. **No self-grading** — you wrote none of the arguments; debaters are a different tier. At
   `--depth tribunal` add a 3-seat Sonnet PoLL jury with you as tiebreak to dilute self-preference bias.
7. **Bias hygiene** — shuffle argument order, mask seat authorship, penalize verbosity, distrust
   citations until a scout re-opens the file.

## Tier & cost
Convene + per-claim verdict + freeze → **orchestrate** (Opus, the irreversible judge call).
Prosecution / Defense / Catfish debaters → **build** (Sonnet, parallel). Evidence packs + re-verification
→ **scout** (Haiku). Prefer an installed specialist for the security/code lenses if present
(`voltagent-qa-sec:code-reviewer` / `security-auditor`, `/code-review`), exactly as `/close-sprint`
does; otherwise the first-party `keel-builder` / `keel-scout`. Respect `state.yaml.cost_profile`.

## Exit gate (tribunal complete)
- [ ] Every surviving claim cites on-disk evidence; uncited claims struck (logged).
- [ ] A per-claim verdict rendered; minority/dissent recorded; LOW nits capped.
- [ ] `.harness/debates/debate-NN.md` frozen with the `KEEL_TRIBUNAL_RESULT` tally line.
- [ ] Each upheld finding carries one action; the action bridge is proposed to the user.
- [ ] `stage` NOT advanced and no gate marked passed (the tribunal only informs).
