---
name: market-research
description: "Phase 2 of Midas — validate the (now-clear) idea against the real market. Derive research questions, fan out web searches (optional host deep-research if installed), adversarially verify every claim with citations, and synthesize a competitor matrix + differentiation thesis + top risks into {product}/market.md. Use after /contextualize, before the business case."
metadata:
  midas-disable-model-invocation: true
  midas-harness-tier: orchestrate
  midas-mcp-recommended: "[context7]"
  midas-model: inherit
  midas-recommended-model: claude-opus-4-8
  midas-user-invocable: true
---
# market-research — Phase 2

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Precondition:** `contextualize` passed (user/problem/metric/non-goals clear). Blocking opens → `/contextualize`.

Validate that the clarified idea addresses a real problem with a real audience, and map the
competitive landscape **with citations**. The producer gathers and synthesizes; the orchestrator
frames the questions and audits the gate — it does not rubber-stamp its own report.

## Does / Does not

| Does | Does not |
|---|---|
| Desk research with cited claims → `{product}/market.md` | Fabricate citations or leave material claims uncited |
| Competitor matrix + differentiation + top 3 risks + demand verdict | Field interviews as a hard wall (that is Phase 3) |
| Stop if Phase-1 blockers remain | Rubber-stamp the report as the gate auditor |

## When NOT
- Blocking open questions remain → `/contextualize`.
- User wants go/no-go / monetization → `/business-plan` after this gate.
- “No time to research” → still required; use scout fan-out + strike uncited claims rather than inventing.

**Anti-rationalization:** a competitor list without a **demand verdict** (strong/mixed/weak + evidence)
does **not** pass the exit gate.

## Steps
1. **Derive research questions** from `{product}/idea.md`: market-size signals, direct competitors,
   substitutes/alternatives, pricing norms, distribution channels, regulatory/compliance constraints,
   and **demand signals** — evidence that the problem is real and people pay to solve it (competitor
   traction/reviews/funding, complaints in forums/Reddit/app-store reviews, search/community interest,
   what people already pay for substitutes). This is the part you CAN validate from the desk.
2. **Fan out the research.** Dispatch **scout** subagents (Haiku) to `WebSearch` + `fetch` each question;
   for any technology/landscape facts, use Context7. If an external deep-research skill is installed
   in the host tool, you may delegate the fan-out to it — it is not part of the Midas engine.
3. **Adversarially verify.** Every material claim must cite a source URL. Strike or flag uncited
   claims. Distinguish primary sources from blog hearsay.
4. **Synthesize** (build tier) into a competitor matrix (who, what, price, gap), a one-paragraph
   **differentiation thesis**, the **top 3 market risks** with their early signals, and a frank
   **demand verdict** — *strong / mixed / weak* desk-signal — citing the evidence behind it (traction,
   pain complaints, search interest, willingness-to-pay). State plainly what the desk can and **cannot**
   prove: it shows a market exists, not that *these* customers will pay — that is field validation (Phase 3).
5. **Write `{product}/market.md`** from `<paths.engine>/templates/market.md`. Update **`paths.state`** (read-modify-write)
   (`market_research: in_progress` → leave the gate verdict to the orchestrator).

## Cost / tiers
Orchestrate (Opus) frames the questions and audits the gate. Scout (Haiku) does the bulk
search/extraction. Build (Sonnet) writes the synthesis.

## Exit gate (Phase 2)
- [ ] ≥ 3 competitors/alternatives analyzed (or a justified "no direct competitor" finding).
- [ ] A differentiation thesis is stated explicitly.
- [ ] Every material claim carries a citation (source URL).
- [ ] Top 3 market risks named, each with an early signal.
- [ ] **Demand signals** assessed with a frank desk-demand verdict (strong/mixed/weak) and evidence —
      not just a competitor list. (Whether *these* customers pay is field validation, weighed in Phase 3.)
- [ ] `{product}/market.md` written; gate verdict rendered by the orchestrator before advancing to
      `business_case`.
