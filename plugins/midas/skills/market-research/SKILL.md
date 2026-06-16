---
name: market-research
description: Phase 2 of Midas — validate the (now-clear) idea against the real market. Derive research questions, fan out web searches (reuse /deep-research if present), adversarially verify every claim with citations, and synthesize a competitor matrix + differentiation thesis + top risks into product/market.md. Use after /contextualize, before the business case.
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-required: [context7]
---

# market-research — Phase 2

> First read `harness/state.yaml`. Precondition: stage `contextualize` passed (the idea is clear, with
> user/problem/metric/non-goals defined). If the idea still has BLOCKING open questions, stop and point
> at `/contextualize`. Read first, write last.

Validate that the clarified idea addresses a real problem with a real audience, and map the
competitive landscape **with citations**. The producer gathers and synthesizes; the orchestrator
frames the questions and audits the gate — it does not rubber-stamp its own report.

## Steps
1. **Derive research questions** from `product/idea.md`: market-size signals, direct competitors,
   substitutes/alternatives, pricing norms, distribution channels, regulatory/compliance constraints.
2. **Fan out the research.** Prefer the **`/deep-research`** skill if available (it already fans out
   searches, fetches sources, and adversarially verifies). Otherwise dispatch **scout** subagents
   (Haiku) to `WebSearch` + `fetch` each question; for any technology/landscape facts, use Context7.
3. **Adversarially verify.** Every material claim must cite a source URL. Strike or flag uncited
   claims. Distinguish primary sources from blog hearsay.
4. **Synthesize** (build tier) into a competitor matrix (who, what, price, gap), a one-paragraph
   **differentiation thesis**, and the **top 3 market risks** with their early signals.
5. **Write `product/market.md`** from `harness/templates/market.md`. Update `harness/state.yaml`
   (`market_research: in_progress` → leave the gate verdict to the orchestrator).

## Cost / tiers
Orchestrate (Opus) frames the questions and audits the gate. Scout (Haiku) does the bulk
search/extraction. Build (Sonnet) writes the synthesis. Reuse `/deep-research` when present.

## Exit gate (Phase 2)
- [ ] ≥ 3 competitors/alternatives analyzed (or a justified "no direct competitor" finding).
- [ ] A differentiation thesis is stated explicitly.
- [ ] Every material claim carries a citation (source URL).
- [ ] Top 3 market risks named, each with an early signal.
- [ ] `product/market.md` written; gate verdict rendered by the orchestrator before advancing to
      `business_case`.
