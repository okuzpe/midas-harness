---
name: business-plan
description: "Phase 3 of Midas — turn the validated opportunity into a go/no-go business case. Define the value proposition, MVP scope vs explicit non-goals, the business/monetization model, and MEASURABLE success metrics (which later phase-8 audits grade against), then capture an explicit go/no-go with HUMAN sign-off into {product}/business-plan.md. Use after /market-research."
metadata:
  midas-disable-model-invocation: true
  midas-harness-tier: orchestrate
  midas-model: inherit
  midas-recommended-model: claude-opus-4-8
  midas-user-invocable: true
---
# business-plan — Phase 3

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Precondition:** `market_research` passed. **Hard human checkpoint** — no engineering until go/no-go sign-off.
> Optional: `/midas-tribunal` (pre-go/no-go) — high-leverage, never forced.

Turn the validated opportunity into a decision. The orchestrator owns the go/no-go judgment and the
gate; the builder drafts the document.

## Does / Does not

| Does | Does not |
|---|---|
| Draft go/no-go case with MVP scope, metrics, monetization, validation status | Start engineering or self-advance past Phase 3 without human sign-off |
| Require **human** go/no-go via `AskUserQuestion` (name + date recorded) | Invent a hard “interview N customers or no product” wall for resource-constrained founders |
| Log deferred field validation as an explicit assumption | Rubber-stamp go/no-go without the human |

## When NOT
- Market research gate not passed / blockers remain → `/market-research` or `/contextualize`.
- Human already signed no-go → stop; do not reopen without an explicit ask.
- User only wants a decision debate → optional `/midas-tribunal` (never required).

## Steps
1. **Value proposition** — for the target segment from `{product}/idea.md` + `{product}/market.md`.
2. **MVP scope vs non-goals** — the minimum surface that validates the core hypothesis, and an
   **explicit** list of what is out of scope for the MVP. (The Phase-8 audit checks the build against
   this scope; vague scope here weakens every later audit.)
3. **Business / monetization model** — even if v1 is free, state the intended model and what v1 must
   prove for it to work.
4. **Measurable success metrics** — each with a target, a measurement method, and a window. These
   become the acceptance signals the per-sprint audit (`/close-sprint`) and `/midas-tribunal` grade
   against, so make them concrete and queryable.
5. **Cost/effort envelope** — a rough build estimate (sprints, dependencies).
6. **Validation status — desk vs field (do NOT hard-wall a resource-constrained founder).** State both:
   - **Desk validation (done in Phase 2):** the demand signals + competitive landscape — the part the AI
     can prove. Carry over the demand verdict (strong/mixed/weak).
   - **Field validation (strongest evidence — recommend, don't mandate):** customer interviews, a real
     preorder / letter-of-intent, or a small paid-ad demand test. This is the only thing that proves
     *these* customers pay. If the founder can do it, **strongly recommend it before building.**
   - **If field validation is not feasible now** (e.g. solo / AI-only founder, no audience yet): you MAY
     still proceed — record an explicit **assumption** ("real-customer demand is unproven; field
     validation deferred") as a top risk, re-surfaced before launch/scale and in `/midas-tribunal`.
     **Do NOT invent a hard "no product until you interview N people" gate that walls the founder.** The
     go/no-go is the human's informed risk call, not a lock.
7. **Go / no-go** — render an explicit recommendation with rationale, then obtain **human sign-off**
   via `AskUserQuestion`. A valid verdict is **GO with field validation deferred (assumption logged)**
   when desk demand is at least *mixed* and the human accepts the unproven-demand risk. Record the
   decision + who signed off + the date in the document and in **`paths.state`**. On "no-go", stop and log why.
8. **Write `{product}/business-plan.md`** from `<paths.engine>/templates/business-plan.md`; update
   **`paths.state`** (gate verdict by the orchestrator).

## Cost / tiers
Orchestrate (Opus) decides go/no-go and audits the gate — delegate to `midas-orchestrator`.
Build (Sonnet) drafts the document — delegate to `midas-builder`.

## Exit gate (Phase 3)
- [ ] MVP scope defined with **explicit** non-goals.
- [ ] ≥ 2 measurable success metrics, each with target + measurement method + window.
- [ ] Business/monetization model stated.
- [ ] **Validation status** recorded: the desk demand verdict + field-validation status (done, or
      **deferred with a logged assumption**). The founder is not hard-walled — go/no-go is their informed call.
- [ ] Explicit go/no-go recorded **with human sign-off** (name + date) in the doc and **`paths.state`**.
- [ ] `{product}/business-plan.md` written; gate verdict rendered by the orchestrator before advancing
      to `tech_architecture`.
