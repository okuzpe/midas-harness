# Rule: Cost-aware model routing (always-on)

Use the **right tier for each task** so cost tracks the stakes: the strongest model only on the
~6 irreversible decisions, a mid model to build, the cheapest to search. The three tiers and their
literal model ids live in **`docs/agents-and-models.md`** (the single bump point) — reference tier
*names* (`orchestrate` / `build` / `scout`), never hard-code an id here.

> **The binding is the sub-agent, not a label.** A tier becomes a real model only when work is
> delegated to its first-party agent (`.claude/agents/midas-{orchestrator,builder,scout}.md`, each
> with a pinned `model:`). A skill's frontmatter `harness-tier` names only its **dispatch/decision**
> tier — the leg that renders the gate verdict. Its produce/fetch legs must be **delegated**, in the
> SKILL body, to the matching agent, or they silently run on the inherited session model and the
> routing is lost.

## The routing

- **orchestrate** — think / plan / audit / decide. Reserved for the irreversible calls: Phase 1 gap
  loop, Phase 3 go/no-go, Phase 4 stack choice, Phase 5 rule design, Phase 6 sequencing, Phase 8
  conformance audit, and any exit-gate verdict + code/security review. Earn the expensive tier.
- **build** — implement / write artifacts. Code, tests, docs, ADRs, sprint files, rules, design system.
- **scout** — search / extract / mechanical / status. Doc fetches (`context7-usage.md`), file/status
  extraction, `/midas-status`, evidence gathering for an audit. The built-in `Explore` agent (Haiku,
  read-only) is a valid substitute for `midas-scout` on research tasks.

## CHECKs

- **CHECK:** A high-stakes gate verdict or audit (Phase 1/3/4/8, code-review, security-review) is
  produced **via the `midas-orchestrator` sub-agent** — its pinned `model:` is the provenance. The
  model id written into an audit/verify/tribunal record header is **provenance-by-delegation, not
  self-report**; a record produced on the inherited session model must not claim a tier it did not run on.
- **CHECK:** Doc fetches and file/status extraction are delegated to `midas-scout` (or `Explore`),
  not run on the orchestrate tier. *(manual: a phase whose only work is fetch/extract names a scout
  delegation in its SKILL body.)*
- **CHECK:** Each multi-tier phase delegates its produce/fetch legs to `midas-builder` / `midas-scout`
  in the SKILL body — `harness-tier` is the dispatch tier only, never the whole cost story.
  *(manual.)*
- **CHECK:** `harness/state.yaml -> routing` ids are all known model ids and, under
  `cost_profile: balanced`, **equal the pinned `model:` of the three first-party agents**. Run
  `node scripts/doctor.mjs <project>`; a `routing:*` warning is a fail. *(The engine enforces the same
  reconciliation against the example state in `scripts/test.mjs`.)*

## Cost profiles — what is real vs. intent

`cost_profile` (`balanced` | `max_savings` | `max_quality`) and the resolved `routing:` map are
recorded in `state.yaml`. **Only `balanced` is executor-backed** — its ids are the agent pins the
platform actually dispatches to. `max_savings` / `max_quality` are **routing *intent*** the
orchestrating model self-applies; there is no engine that rewrites an agent's pinned model from the
profile, so do **not** rely on selecting a non-balanced profile to change dispatch automatically. If a
project needs a different default tier-to-model mapping, change it at the source (`docs/agents-and-models.md`
+ the three agent files), then re-run `node scripts/doctor.mjs` to confirm `routing:` reconciles.

## Token economy

Beyond tier selection, the biggest savings in a multi-agent harness come from not re-paying for the
same tokens:
- **Cache the stable corpus.** `state.yaml` + `harness/rules/*` + `product/*` are re-read on every
  dispatch — put them behind a prompt-cache breakpoint so repeated reads are not re-billed.
- **Batch the fan-outs.** Latency-tolerant parallel work (tribunal debaters, market-research / scout
  sweeps, per-rule audits) belongs on the Batch API, not N synchronous calls.
- **Budget the thinking.** Set an explicit reasoning/effort budget on `orchestrate` decisions — the
  expensive tier should think hard on the ~6 irreversible calls, not on mechanical ones.
- **Skip redundant fetches.** Don't re-fetch docs already pulled this session for the same version
  (`context7-usage.md`); route the fetch that is needed to `scout`.

- **CHECK:** *(manual)* a latency-tolerant fan-out of ≥3 same-shaped calls uses batching, not a serial loop.

## Non-Claude tools

Cursor / Copilot / Windsurf lack per-subagent model tiering, so the tiers collapse to **prose intent**
(fastest model for search/extract, strongest for architecture and audits). Methodology and MCP are
fully preserved; only automatic cost-routing is lost. See `docs/agents-and-models.md` → "Non-Claude tools".
