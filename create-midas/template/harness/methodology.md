# Midas methodology — idea → shipped product

Midas governs how a product is built through **9 audited phases**. Each phase produces named
artifacts on disk and is guarded by an **exit gate** the orchestrator audits before advancing.
The per-phase playbooks live in [`harness/pipeline/`](./pipeline/); this file is the overview.

## The harness contract
- **Stateful** — one source of truth, [`harness/state.yaml`](./state.schema.md). Read first, write last.
- **Auditable** — every phase yields artifacts + a gate verdict frozen in `.harness/audits/`.
- **Resumable** — `/midas-status` reads the state and prints the single next action; any agent on any
  tool can resume because the methodology is markdown, not a tool's memory.

**Transition rule:** advance from phase N to N+1 **iff** the orchestrator (Opus) ran the phase-N exit
gate, every gate item is satisfied with on-disk evidence, the verdict is written to `.harness/audits/`,
and `state.yaml` records `gate: passed`. The **producer** never grades its own homework — the
**auditor** (orchestrate tier) renders the verdict.

## The phases

| # | Phase | Playbook | Output |
|---|---|---|---|
| 0 | Idea Intake | `pipeline/0-idea-intake.md` | `product/idea.md`, `harness/state.yaml` |
| 1 | Contextualize & Gap Audit | `pipeline/1-contextualize.md` | `product/idea.md` v2, `product/open-questions.md` |
| 2 | Market Research | `pipeline/2-market-research.md` | `product/market.md` |
| 3 | Business Case | `pipeline/3-business-case.md` | `product/business-plan.md` |
| 4 | Tech & Architecture | `pipeline/4-tech-architecture.md` | `product/architecture.md`, `product/adr/ADR-*.md` |
| 5 | Architecture-as-Rules + Design System | `pipeline/5-architecture-rules.md` | `harness/rules/*`, `product/design-system.md` |
| 6 | Sprint Planning | `pipeline/6-sprint-planning.md` | `product/roadmap.md`, `product/sprints/NN-*.md` |
| 7 | Sprint Execution Loop | `pipeline/7-sprint-execution.md` | code + tests + updated sprint |
| 8 | Per-sprint Audit & Adjust | `pipeline/8-audit-adjust.md` | `.harness/audits/audit-NN.md` |

## State machine

```
0 → 1 → 2 → 3 → 4 → 5 → 6 ─┐         (front-loaded, run once)
                            ▼
                   ┌──► 7 Execute ──┐
                   │                │ next sprint
                   └──── 8 Audit ◄──┘
                            │ (no sprints left + metrics met)
                            ▼
                          SHIP
```

The **7 ⇄ 8 loop** is "applying the harness each sprint": before/after each sprint, the orchestrator
re-audits the **living code** against the **rules frozen in Phase 5** and the **scope in the business
case**, then either fixes the code or **consciously amends a rule** (a logged decision, never silent).

## Entry points (greenfield vs brownfield)

| Scenario | Enters at | Notes |
|---|---|---|
| Greenfield (raw idea, empty repo) | Phase 0 | Full pipeline. **Supported in v1.** |
| Brownfield (existing code) | Phase 4/5 "audit-existing" via **`/midas-adopt`** | Inventories the codebase, reverse-engineers architecture + rules from the real code (codify reality; violations logged as debt), then 6→7→8. Writes into any pre-existing `AGENTS.md`/`CLAUDE.md`/source only after a **dry-run + diff-confirm**. Playbook: `harness/pipeline/0b-codebase-inventory.md`. |

`entry_stage` is recorded in `state.yaml` so the harness stays honest about which gates were
satisfied vs deliberately skipped (skipped gates carry a recorded assumption).

## Standing audit — the tribunal
Beyond the per-phase gates and the per-sprint `/close-sprint` conformance audit, Midas offers a
**standing, on-demand adversarial debate**: `/midas-tribunal`. It puts the *whole* project on trial
(idea, market, business model, architecture, scope, rules, code) with opposing persona-lenses and an
independent Opus judge who rules per claim against on-disk evidence. Where the gates ask "does the code
conform to what we decided?", the tribunal asks "were those decisions right?" — run it before big gates
(pre-architecture-freeze, pre-go/no-go, pre-ship) or any time. It informs the human and the gates but
never advances `stage` itself.

## Human sign-off points

Midas automates the *work*, never the *irreversible judgment*. The gates below are not model-graded —
a human must approve before the harness advances. Each is recorded on disk so a skipped one is visible.

| Where | Decision that needs a human | Recorded in |
|---|---|---|
| Phase 1 — Contextualize | The blocking open questions are answered (the gap loop will not advance with any open) | `product/open-questions.md` |
| Phase 3 — Business Case | **Go / no-go** to build the MVP at all | `product/business-plan.md` § go/no-go (sign-off line) |
| Phase 4 — Architecture | Each irreversible stack/architecture decision | `product/adr/ADR-*.md` (one ADR per decision) |
| Phase 5 / Phase 8 | Every **rule amendment** — changing a frozen rule is a conscious choice, never silent | the rule file's `## Amendment` entry (date + who) |
| Phase 8 — Scope drift | Accepting or deferring a feature outside MVP scope | `.harness/audits/audit-NN.md` § scope reconciliation |
| Any time | **Applying** `/midas-tribunal` findings (it only reports; the human decides what to act on) | the follow-up that consumes `.harness/debates/debate-NN.md` |
| Ship | Declaring the MVP done when success metrics are met | the final `.harness/audits/audit-NN.md` + `stage: shipped` |
| Always | **Committing / pushing** code — only when the human explicitly asks (see `rules/git-commits.md`) | git history |

The producer never grades its own homework, and the harness never signs off for the human on any row above.

## Cost-aware execution
Each phase names an orchestrate/build/scout tier (see [`docs/agents-and-models.md`](../docs/agents-and-models.md)).
Opus is reserved for the ~6 irreversible decisions (idea framing, stack choice, architecture audit,
sprint audit, code review, security review). Everything else routes to Sonnet (build) or Haiku (scout).
