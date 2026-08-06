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

> **Implementation route ≠ model tier.** [`organic-routing.md`](./organic-routing.md) chooses *how
> much context* a Phase-7 action needs (inline / delegated / plan-first). This rule chooses *which
> tier* runs each leg after that route is set.

## The routing

- **orchestrate** — think / plan / audit / decide. Reserved for the irreversible calls: Phase 1 gap
  loop, Phase 3 go/no-go, Phase 4 stack choice, Phase 5 rule design, Phase 6 sequencing, Phase 8
  conformance audit, and any exit-gate verdict + code/security review. Earn the expensive tier.
- **build** — implement / write artifacts. Code, tests, docs, ADRs, sprint files, rules, design system.
- **scout** — search / extract / mechanical / status. Doc fetches (`context7-usage.md`), file/status
  extraction, `/midas-status`, evidence gathering for an audit. The built-in `Explore` agent (Haiku,
  read-only) is a valid substitute for `midas-scout` on research tasks.

## Local & hybrid execution (where a tier runs)

`routing_profile` in `state.yaml` (`claude` | `openai-mini` | `local-hybrid`, with legacy `openai`
accepted) selects preset model ids for the resolved `routing:` map. The `orchestrate` tier **always**
uses Claude cloud for attested gate verdicts on the legacy `claude` profile — see
`docs/agents-and-models.md` for the preset table.

The tier names above pick *which* model; **`state.yaml -> execution_mode`** (`cloud` | `hybrid` |
`local`) picks *where* it runs. The two axes are orthogonal — `execution_mode` never changes which
Claude tier a decision uses, only where build/scout may run. The mode→placement mapping and the
consumer-hardware fit table (8/16/24 GB) live in `docs/agents-and-models.md`. One invariant binds
every mode:

- **`orchestrate` always runs on Claude cloud for the legacy Claude profile.** The ~6 irreversible
  decisions (Phase 1/3/4/8 gate verdicts, code-review, security-review) are exactly where local
  open-weight models are weakest — multi-step planning and audit — so they do **not** go local even
  under `hybrid`/`local`. `scout` and `build` MAY run on a local model when `execution_mode` is
  `hybrid` or `local`; that local model id is the provenance for what those legs produced.
- Under `execution_mode: local`, an orchestrate verdict produced without a Claude cloud model is
  recorded as **un-attested** — advisory only, never gate-advancing.

## CHECKs

- **CHECK:** A high-stakes gate verdict or audit (Phase 1/3/4/8, code-review, security-review) is
  produced **via the `midas-orchestrator` sub-agent** — its pinned `model:` is the provenance. The
  model id written into an audit/verify/tribunal record header is **provenance-by-delegation, not
  self-report**; a record produced on the inherited session model must not claim a tier it did not run on.
- **CHECK:** *(manual)* Under any `execution_mode`, a binding gate/audit/verify verdict header (Phase
  1/3/4/8, code-review, security-review) names a **Claude `orchestrate`** model as provenance; a local
  model id in a binding verdict header is a fail — it may appear only on a record explicitly marked
  `un-attested`.
- **CHECK:** Doc fetches and file/status extraction are delegated to `midas-scout` (or `Explore`),
  not run on the orchestrate tier. *(manual: a phase whose only work is fetch/extract names a scout
  delegation in its SKILL body.)*
- **CHECK:** Each multi-tier phase delegates its produce/fetch legs to `midas-builder` / `midas-scout`
  in the SKILL body — `harness-tier` is the dispatch tier only, never the whole cost story.
  *(manual.)*
- **CHECK:** `paths.state -> routing` ids are all known model ids and, under the Claude
  profile, **equal `resolveCostAwareRouting(routing_profile, cost_profile)`** (and the pinned
  `model:` of the three first-party agents). The `openai-mini` profile resolves all three tiers to
  `gpt-5.4-mini`. Run `node <paths.scripts>/doctor.mjs <project>`; a `routing:*` warning is a fail.
  *(The engine enforces the same reconciliation against the example state in `scripts/test.mjs`.)*

## Cost profiles — executable, not advisory

`cost_profile` (`balanced` | `max_savings` | `max_quality`) and the resolved `routing:` map are
recorded in `state.yaml`. `routing_profile` chooses the preset that fills `routing:`. Under the
Claude profile, **`scripts/model-profiles.mjs` → `resolveCostAwareRouting`** is the single resolver:
`max_savings` / `max_quality` rewrite the expected tier ids (not prose-only intent).

- Doctor reconciles `state.routing` **and** the three first-party agent `model:` pins against that map.
- Product installs (`layout: harness`): `node <paths.scripts>/doctor.mjs --fix` rewrites `routing:` and
  syncs `.claude/agents` + `<paths.engine>/agents` pins to match.
- Engine classic dogfood: `--fix` may rewrite `harness/state.yaml → routing:` but never the
  published balanced pins under `harness/agents/`.
- Under `max_savings`, Phase 4 (`tech_architecture`) and Phase 8 (`audit_adjust`) gate skills still
  **escalate orchestrate to Opus** even when the default pin is Sonnet — see
  `MAX_SAVINGS_ORCHESTRATE_ESCALATE_STAGES` in `scripts/model-profiles.mjs`.

The legacy Claude profile is executor-backed through the first-party agent pins; `openai-mini`
resolves all tiers to `gpt-5.4-mini` (`cost_profile` overlays do not apply); `local-hybrid` keeps
`orchestrate` on Claude and routes build/scout to the local model. If a project needs a different
default tier-to-model mapping, change it at the source (`docs/agents-and-models.md` + the three
agent files + `scripts/model-profiles.mjs`), then re-run `node <paths.scripts>/doctor.mjs` to
confirm `routing:` reconciles.

- **CHECK:** `paths.state -> routing` ids equal `resolveCostAwareRouting(routing_profile, cost_profile)`
  under the Claude profile (any `cost_profile`); agent pins match the same map. Run
  `node <paths.scripts>/doctor.mjs <project>`; a `routing:*` warning is a fail.
- **CHECK:** each phase / lifecycle skill body has a `## Tier & delegation` (or equivalent
  `## Tier & cost`) section that names which legs go to `midas-orchestrator` / `midas-builder` /
  `midas-scout` — `harness-tier` alone is not enough. Mechanized: `node <paths.scripts>/skill-quality-check.mjs`
  warns `missing \`## Tier & delegation\`...` when the heading is absent; a warning on a touched skill is a fail.
- **CHECK:** a skill's `recommended-model` frontmatter matches its `harness-tier` under the canonical
  balanced-Claude map (`CLAUDE_COST_PROFILE_ROUTING.balanced` in `scripts/model-profiles.mjs`).
  Mechanized: `node <paths.scripts>/skill-quality-check.mjs` warns on drift; a warning on a touched
  skill is a fail.

## Token economy

Beyond tier selection, the biggest savings in a multi-agent harness come from not re-paying for the
same tokens:
- **Cache the stable corpus.** `paths.state` + `<paths.engine>/rules/*` + `{product}/*` are re-read on every
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
fully preserved; only automatic cost-routing is lost. Their skills are discovered through the portable
`.agents/skills/` tree. See `docs/agents-and-models.md` → "Non-Claude tools".

## Amendment

- **2026-08-06** — Cross-link to [`organic-routing.md`](./organic-routing.md): organic chooses how
  much context; this rule chooses which tier. Delegated Phase-7 legs pass matched `SKILL.md` paths
  from `<paths.engine>/skill-registry.md`.
- **2026-08-01** — `cost_profile` is executable under the Claude `routing_profile`:
  `resolveCostAwareRouting` + doctor reconciliation of `state.routing` and agent pins; product
  `--fix` syncs pins. Skills must declare `## Tier & delegation` (not only `harness-tier`).
  `max_savings` escalates orchestrate to Opus on Phase 4/8 stages.
