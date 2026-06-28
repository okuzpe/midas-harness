# Midas

**Midas** is a portable, AI-tool-agnostic product-development harness: a copy-in kit of plain
markdown — skills, rules, slash-commands, and agent definitions — that drives a software product
from a raw idea to shipped code through **9 audited phases**.

It is a *methodology engine*: stateful, auditable, and resumable. Install it into any repo; it
works across Claude Code, Cursor, GitHub Copilot, Codex, Windsurf, and any AGENTS.md-aware agent.

## Why

Most AI coding setups jump straight to code. Midas front-loads the thinking — clarify the idea,
validate the market, freeze the architecture, encode the rules — then makes every sprint a control
loop that re-audits living code against those frozen rules. The strongest model **thinks and audits**;
cheaper models **execute**. Current library docs are fetched before third-party code (Context7 or your own tool), so code is written
against current APIs, not stale training memory.

## The 9 phases

```mermaid
flowchart LR
  I0[0 Idea] --> I1[1 Gap audit] --> M[2 Market] --> B[3 Business]
  B --> A[4 Architecture] --> R[5 Rules + Design] --> P[6 Sprint plan]
  P --> X[7 Execute]
  X --> AU[8 Audit]
  AU -- next sprint --> X
  AU -- metrics met --> SHIP[Ship]
```

Phases 0–6 run once (front-loaded). Phases 7–8 loop every sprint. Each phase produces named
artifacts under `product/` and is guarded by an exit gate the orchestrator audits before advancing.
One file holds all state: `harness/state.yaml`.

See [Methodology](methodology.md) for the full phase table and the maturity-based entry points
(E0–E3), or read the canonical [`harness/methodology.md`](https://github.com/okuzpe/midas-harness/blob/main/harness/methodology.md)
in the repo.

If you want to work on Midas itself, start with [Repository Architecture](repository-architecture.md)
for the source/generated-file map and the contributor change paths.

## Key properties

- **Portable** — plain markdown; no runtime, no lock-in, no vendor SDK.
- **Resumable** — `/midas-status` prints the single next action from any tool or agent.
- **Cost-aware** — three built-in agents at three price tiers (Opus / Sonnet / Haiku).
- **Auditable** — every gate verdict is frozen to `.harness/audits/`; drift is never silent.
- **Brownfield-safe** — `/midas-adopt` inventories existing code and never rewrites without a
  confirmed diff.

[Get started](getting-started.md){ .md-button .md-button--primary }
[GitHub](https://github.com/okuzpe/midas-harness){ .md-button }
