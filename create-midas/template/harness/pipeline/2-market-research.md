# Phase 2 — Market Research

**Stage enum:** `market_research` | **Tier:** orchestrate (frame) + build (write) + scout (search)

> Run this phase with the **`/market-research`** skill (it fans out research, reuses `/deep-research`
> when present, and verifies every claim with a citation). This playbook is its reference.

## Purpose

Produce an evidence-based competitive landscape so Phase 3 can make a grounded go/no-go
decision. Every claim must be cited; opinions must be flagged as such.

## Inputs

- `product/idea.md` v2 (from Phase 1) — user, problem, metric, non-goals
- `harness/state.yaml` (stage must be `market_research`)

## Key steps

1. **Frame the search.** Orchestrator derives 3–5 search queries from the problem statement
   and the target user. Prioritize: (a) direct competitors, (b) adjacent solutions the user
   might substitute, (c) recent funding/M&A signals.
2. **Run research.** Use `/deep-research` or invoke `midas-scout` with `WebSearch` + `WebFetch`
   to gather raw evidence. Collect at minimum 3 distinct competitors with public evidence.
3. **Write `product/market.md`.** Build uses the template below:
   - `## Market snapshot` — size estimate with source and date
   - `## Competitors` — table: name | segment | key differentiator | weakness (one row per competitor)
   - `## Differentiation thesis` — 2–4 sentences; what Midas enables that incumbents cannot
   - `## Top risks` — exactly 3 ordered risks with mitigation note
   - `## Sources` — numbered citation list; all URLs with access date
4. **Cite everything.** Inline citation format: `[N]` pointing to the `## Sources` list.
   No uncited factual claim is acceptable.
5. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: business_case`.

## Output artifacts

| File | Notes |
|---|---|
| `product/market.md` | Competitive landscape, cited |

## Exit gate checklist

- [ ] `product/market.md` exists with all five sections present
- [ ] At least 3 named competitors with evidence (not hypothetical)
- [ ] Differentiation thesis is present and specific (not generic)
- [ ] Exactly 3 top risks are listed with mitigation notes
- [ ] Every factual claim has an inline citation `[N]`
- [ ] `## Sources` list contains at least 3 URLs with access dates
- [ ] Gate verdict written to `.harness/audits/audit-02.md`

## Recommended tier + agents

- **Frame + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
- **Write artifact:** `build` (`midas-builder`, `claude-sonnet-4-6`)
- **Search / fetch:** `scout` (`midas-scout`, `claude-haiku-4-5`) or built-in Explore agent
