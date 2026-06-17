# Methodology

This page summarizes the Midas methodology. The canonical specification lives in
[`harness/methodology.md`](https://github.com/okuzpe/midas-harness/blob/main/harness/methodology.md)
and the per-phase playbooks in `harness/pipeline/`.

---

## The 9 phases

| # | Phase | Key output |
|---|---|---|
| 0 | Idea Intake | `product/idea.md`, `harness/state.yaml` |
| 1 | Contextualize & Gap Audit | `product/idea.md` v2, `product/open-questions.md` |
| 2 | Market Research | `product/market.md` |
| 3 | Business Case | `product/business-plan.md` |
| 4 | Tech & Architecture | `product/architecture.md`, `product/adr/ADR-*.md` |
| 5 | Architecture-as-Rules + Design System | `harness/rules/*`, `product/design-system.md`, `product/playbooks/*` |
| 6 | Sprint Planning | `product/roadmap.md`, `product/sprints/NN-*.md` |
| 7 | Sprint Execution | code + tests + updated sprint |
| 8 | Per-sprint Audit & Adjust | `.harness/audits/audit-NN.md` |

**Transition rule:** advance phase N to N+1 only when the orchestrator (Opus) ran the exit gate,
every item is satisfied with on-disk evidence, the verdict is frozen to `.harness/audits/`, and
`state.yaml` records `gate: passed`. The producer never grades its own homework.

**Gates are mechanically checkable, not just prose.** Every `harness/rules/*` item ships a concrete
`CHECK:` (a grep/command or a `manual:` observable). `/close-sprint` freezes a gate-parseable tally line —
`MIDAS_AUDIT_RESULT: rules_failed=X unresolved=Y amended=Z verdict=pass|blocked` — and
`node scripts/doctor.mjs` parses it against `state.yaml`, warning when a sprint is marked `done` while its
audit still shows `unresolved>0` or `verdict=blocked`. That doctor check is the first gate signal that
lives **outside the model**.

**Phase 5 also emits project playbooks:** 0–4 `product/playbooks/*` recipes (zero is valid) for the
tasks that recur in the chosen stack — procedures the build agent follows, not new slash-commands.

---

## The 7–8 loop

Phases 0–6 run once (front-loaded planning). Phases 7 and 8 repeat every sprint:

```
0 → 1 → 2 → 3 → 4 → 5 → 6 ─┐
                             ▼
                    ┌──► 7 Execute ──┐
                    │                │ next sprint
                    └──── 8 Audit ◄──┘
                             │ (no sprints left + metrics met)
                             ▼
                           SHIP
```

Each sprint: `/start-sprint` opens it (pre-audits living code against frozen rules), work lands,
`/close-sprint` audits it (pass/fail per rule with evidence). Drift is never silent — every
failure is either fixed or the rule is consciously amended (logged, never silent).

---

## Entry points — the maturity spectrum

`/midas-init` is an **adaptive intake**: it scans everything the project already has (code, manifests,
README, docs, notes), classifies its **maturity**, pre-fills what it can infer, asks only the genuine
gaps, and places the project at the right phase — so a finished product is never marched back through
`/idea-intake`, and a "just an idea written down" repo doesn't start from a blank page.

| Level | What's there | Enters at |
|---|---|---|
| **E0 — Empty** | nothing | Phase 0 (`/idea-intake`) |
| **E1 — Idea-only** | a README/brief/notes, little or no code | Phase 1 (`/contextualize`) — pre-fills `product/idea.md` from the docs |
| **E2 — Partial** | real but incomplete code | Phase 5 (`/define-conventions`) via `/midas-adopt` (Phase 4 recorded as a skipped gate) |
| **E3 — Mature** | structured codebase + tests/CI | Phase 6 (`/plan-sprints`) via `/midas-adopt` |

E2/E3 run the `/midas-adopt` branch (inventory → reverse-engineer architecture + rules **and product
context from the harvested docs** → baseline audit → wire with dry-run + diff-confirm). Classification
follows infer → show → confirm. The `entry_stage` is recorded in `state.yaml` so the harness stays honest
about which gates were passed vs deliberately skipped (skipped gates carry a recorded assumption).

---

## The harness contract

- **Stateful** — one source of truth: `harness/state.yaml`. Skills read first, write last.
- **Auditable** — every phase yields artifacts and a gate verdict frozen in `.harness/audits/`.
- **Resumable** — `/midas-status` reads state and prints the single next action; any agent on any
  tool can resume because the methodology is markdown, not a tool's memory.

---

## Standing adversarial audit — the tribunal

`/midas-tribunal` puts the whole project on trial (idea, market, business model, architecture,
scope, rules, code) with a steelman Defense, a red-team Prosecution, and a dissent-forcing Catfish.
An independent Opus judge rules per claim against on-disk evidence. Where `/close-sprint` asks
"does the code conform to what we decided?", the tribunal asks "were those decisions right?" Run it
before big gates or any time confidence needs stress-testing.

---

## Cost-aware execution

Three built-in agents cover the three tiers. See [Agents & Models](agents-and-models.md).

| Tier | Role | Reserved for |
|---|---|---|
| orchestrate (Opus) | think / plan / audit | The ~6 irreversible decisions: gap loop, stack choice, phase gates, sprint audit, code-review, security-review |
| build (Sonnet) | implement / write | Phase 7 execution, docs, ADRs, sprint files, tests |
| scout (Haiku) | search / extract / status | Context7 fetches, file/status extraction, `/midas-status` |
