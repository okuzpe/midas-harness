# Phase 2 — Market Research

**Stage enum:** `market_research` | **Tier:** orchestrate (frame) + build (write) + scout (search)

> Run this phase with the **`/market-research`** skill (it fans out research via scout-tier
> WebSearch/WebFetch; an external deep-research skill in the host tool may be used if installed).
> This playbook is its reference.

## Purpose

Produce an evidence-based competitive landscape so Phase 3 can make a grounded go/no-go
decision. Every claim must be cited; opinions must be flagged as such.

## Inputs

- `{product}/idea.md` v2 (from Phase 1) — user, problem, metric, non-goals
- `paths.state` (stage must be `market_research`)

## Key steps

1. **Frame the search.** Orchestrator derives 3–5 search queries from the problem statement
   and the target user. Prioritize: (a) direct competitors, (b) adjacent solutions the user
   might substitute, (c) recent funding/M&A signals, (d) **demand signals** — complaints/reviews about
   the problem, search/community interest, and what people already pay for substitutes (the desk-doable
   proof that demand is real).
2. **Run research.** Invoke `midas-scout` with `WebSearch` + `WebFetch` to gather raw evidence.
   If an external deep-research skill is installed in the host tool, you may delegate the fan-out.
   Collect at minimum 3 distinct competitors with public evidence.
3. **Write `{product}/market.md`** from `<paths.engine>/templates/market.md`. Headings are those
   of the template — not a parallel outline:
   - `## Market overview` — size / growth / tailwinds with citations
   - `## Target segment` — ICP narrowed from Phase 1
   - `## Competitive landscape` — table, ≥3 named competitors, cited
   - `## Differentiation thesis` — 1 paragraph grounded in the gap
   - `## Demand signals` — traction / complaints / search / willingness-to-pay, ending in a frank
     **demand verdict**: strong / mixed / weak
   - `## Top 3 risks` — likelihood, impact, mitigation
   - `## Sources` — numbered list; every URL with access date
4. **Cite everything.** Inline citation format: `[N]` pointing to the `## Sources` list.
   No uncited factual claim is acceptable.
5. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: business_case`.

## Output artifacts

| File | Notes |
|---|---|
| `{product}/market.md` | Competitive landscape, cited |
| `{runs}/audits/gate-02.md` | Phase-2 gate freeze |

## Exit gate checklist

- [ ] `{product}/market.md` exists with the template headings (`## Market overview`, `## Target segment`,
      `## Competitive landscape`, `## Differentiation thesis`, `## Demand signals`, `## Top 3 risks`,
      `## Sources`)
- [ ] At least 3 named competitors with evidence (not hypothetical)
- [ ] Differentiation thesis is present and specific (not generic)
- [ ] `## Demand signals` present with a frank demand verdict (strong/mixed/weak) and cited evidence
- [ ] `## Top 3 risks` lists exactly 3 risks with mitigation notes
- [ ] Every factual claim has an inline citation `[N]`
- [ ] `## Sources` list contains at least 3 URLs with access dates
- [ ] Gate verdict written to `{runs}/audits/gate-02.md`

## Recommended tier + agents

- **Frame + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
- **Write artifact:** `build` (`midas-builder`, `claude-sonnet-4-6`)
- **Search / fetch:** `scout` (`midas-scout`, `claude-haiku-4-5`) or built-in Explore agent
