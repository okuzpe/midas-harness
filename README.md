# Midas ✨ — a portable product-development harness for AI agents

> Turn a raw idea into a shipped product. Distributed as `midas-harness` (repo) · `npx create-midas`.
> Reserve the GitHub/npm namespace before publishing — "Midas" is a crowded trademark, fine for OSS but worth noting for discoverability.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![AGENTS.md](https://img.shields.io/badge/AGENTS.md-compatible-success)](https://agents.md)
[![Agent Skills](https://img.shields.io/badge/Agent_Skills-compatible-success)](https://agentskills.io)
[![Context7](https://img.shields.io/badge/Context7-enabled-6E56CF)](https://context7.com)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**Midas** is a copy-in kit of plain markdown — skills, rules, slash-commands, and agent definitions —
that drives a software **product** from a raw idea to shipped code through **9 audited phases**. It is
a *methodology engine*: stateful, auditable, and resumable. It installs into any repo and works across
**Claude Code, Cursor, GitHub Copilot, Codex, Windsurf** and any AGENTS.md-aware agent.

## Why
Most AI coding setups jump straight to code. Midas front-loads the thinking — clarify the idea, research
the market, decide architecture, **freeze the rules**, plan sprints — then makes every sprint a control
loop that re-audits the living code against those frozen rules. The best model **thinks**; cheaper
models **execute**. Live library docs come from **Context7**, so code is written against current APIs,
not stale memory.

## 60-second quickstart

Install Midas into any project (new **or** existing) with **one command** — it only adds files
(never deletes yours). Run it inside the project:

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
```
```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
```

…or with any package manager, no shell script:

```bash
npx github:okuzpe/midas-harness     # pnpm dlx · bunx github:okuzpe/midas-harness
```

Then open the project in **Claude Code** (or Cursor) and drive the lifecycle:

```text
/midas-init        # configure the harness (asks ~8 questions, writes state + adapters)
/midas-status      # → "Phase 0. Next: capture your idea"
/idea-intake       # … then /contextualize, /market-research, /business-plan, /choose-architecture,
                   #     /define-conventions, /plan-sprints, /start-sprint, /close-sprint
/midas-tribunal    # any time: a whole-project adversarial debate
```

**Alternatives:**
- **Claude Code plugin:** `/plugin marketplace add okuzpe/midas-harness` → `/plugin install midas@midas` → `/midas-init`.
- **Copy only (any tool):** `npx giget@latest gh:okuzpe/midas-harness ./my-project`.

Full guide with every method, flags, and uninstall: **[INSTALL.md](./INSTALL.md)**. No Claude Code? The
same `AGENTS.md` + `.claude/skills/` are read natively by Cursor, Copilot, Codex and Gemini.

## The 9 phases

```mermaid
flowchart LR
  I0[0 Idea] --> I1[1 Gap audit] --> M[2 Market] --> B[3 Business]
  B --> A[4 Architecture] --> R[5 Rules + Design system] --> P[6 Sprint plan]
  P --> X[7 Execute]
  X --> AU[8 Audit]
  AU -- next sprint --> X
  AU -- metrics met --> SHIP[🚢 Ship]
```

Each phase writes named artifacts under `product/` and is guarded by an **exit gate** the orchestrator
audits before advancing. State lives in one file: `harness/state.yaml`. Full spec:
[`harness/methodology.md`](./harness/methodology.md).

## Supported tools

| Tool | Procedures (skills) | Project law (AGENTS.md) | Always-on rule | Model tiering |
|---|---|---|---|---|
| Claude Code | native | via `@AGENTS.md` in `CLAUDE.md` | `CLAUDE.md` | ✅ per-agent |
| Cursor | native (`.claude/skills/`) | native | `.cursor/rules/00-midas.mdc` | prose intent |
| GitHub Copilot / VS Code | native | native | — | prose intent |
| Gemini CLI | native | native | `GEMINI.md` | prose intent |
| OpenAI Codex | native | native | — | prose intent |
| Windsurf | partial | native | `.windsurf/rules/00-midas.md` | prose intent |

Generated adapters are re-rendered from a single source by `/midas-doctor` — no hand-editing, no drift.

## MCP / Context7
Midas ships a secret-free [`.mcp.json`](./.mcp.json) wiring **Context7** (essential, live library docs)
and **sequential-thinking**. A free Context7 key is recommended for active build sprints. Optional:
git/GitHub, fetch, filesystem, Playwright (UI sprints only). See [`SECURITY.md`](./SECURITY.md) for the
least-privilege guidance.

## Cost-aware orchestration
Three self-contained agents ship with Midas — `midas-orchestrator` (Opus, think/audit),
`midas-builder` (Sonnet, implement), `midas-scout` (Haiku, search). If you have specialist packs
installed, Midas prefers them; otherwise it works with the three built-ins. One bump point for model
IDs: [`docs/agents-and-models.md`](./docs/agents-and-models.md).

## Deep audits — put the project on trial
`/midas-tribunal` runs a standing, **whole-project adversarial debate**: a steelman Defense vs a
red-team Prosecution plus a dissent-forcing Catfish argue every assumption across idea, market,
business model, architecture, scope, rules, and code. Cheaper tiers debate; the Opus judge rules
**per claim** and every claim must cite on-disk evidence or it's struck. It complements `/close-sprint`
(which checks a sprint against the frozen rules) by asking the prior question — *were those decisions
right?* Output is a ranked findings report frozen to `.harness/debates/debate-NN.md`. See a worked
run in [`examples/taskpilot/.harness/debates/debate-01.md`](./examples/taskpilot/.harness/debates/debate-01.md).

## Worked example
[`examples/taskpilot/`](./examples/taskpilot/) is a fully-populated greenfield product showing every
phase artifact, a per-sprint audit, and a runnable code slice.

## Status
**v0.2 (build-phase 2):** the full greenfield lifecycle from idea to code — Claude Code + AGENTS.md
floor (Cursor/Windsurf/Copilot/Codex via standards), the complete skill set incl. `/market-research`,
`/business-plan`, and `/midas-tribunal`, Context7, and a Claude Code **plugin marketplace** rail.
Roadmap: brownfield (with dry-run + diff-confirm), monorepo, design-system components, Playwright-gated
verify, docs site. See [`CHANGELOG.md`](./CHANGELOG.md) and [`VERSIONING.md`](./VERSIONING.md).

## License
[Apache-2.0](./LICENSE). Contributions welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
