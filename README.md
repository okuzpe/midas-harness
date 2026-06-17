# Midas ✨ — a lifecycle, rules, and audit gates for AI coding agents

> Midas gives AI coding agents a **project lifecycle, rules, state, and audit gates** — so they build
> with context instead of jumping straight to code. **Copy it into your repo and the agent stops improvising.**

[![CI](https://github.com/okuzpe/midas-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/okuzpe/midas-harness/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![AGENTS.md](https://img.shields.io/badge/AGENTS.md-compatible-success)](https://agents.md)
[![Agent Skills](https://img.shields.io/badge/Agent_Skills-compatible-success)](https://agentskills.io)
[![Context7](https://img.shields.io/badge/Context7-enabled-6E56CF)](https://context7.com)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**Midas** is a copy-in kit of plain markdown — skills, rules, slash-commands, and agent definitions —
that drives a software **product** from a raw idea to shipped code through **9 audited phases**. It is
a *methodology engine*: stateful, auditable, and resumable. It runs best on **Claude Code**, with
generated adapters and `AGENTS.md` carrying the rules to Cursor, Copilot, Codex, Windsurf and Gemini.

## Why
Most AI coding setups jump straight to code. Midas front-loads the thinking — clarify the idea, research
the market, decide architecture, **freeze the rules**, plan sprints — then makes every sprint a control
loop that re-audits the living code against those frozen rules. The best model **thinks**; cheaper
models **execute**. Live library docs come from **Context7**, so code is written against current APIs,
not stale memory.

## When to use Midas — and when not to
**Use it** when you want an agent to respect architecture, conventions, and tests instead of improvising —
on a new product (full lifecycle) or an existing repo (`/midas-adopt`).

**Skip it** for a quick one-off script, a throwaway prototype, or when you already have an agent setup
you're happy with. Midas adds process; that's overhead you don't want for a 20-line tool.

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

> For a **reproducible** install, pin a release: `npx github:okuzpe/midas-harness#v0.3.1`. The
> `curl … | bash` / `irm … | iex` shims run a remote script — if that's a concern, read
> [`install.sh`](./install.sh) first or just use the `npx` form (same dependency-free installer).

The installer configures the project with sensible defaults (it writes `harness/state.yaml` + the
adapters), so it works immediately. Open it in **Claude Code** (or Cursor) and drive the lifecycle:

```text
/midas-status      # → "Phase 0. Next: capture your idea" (works right after install)
/idea-intake       # start the lifecycle — /midas-status always tells you the next command
```

`/midas-status` walks you through the 9 phases one command at a time. **Optional:** `/midas-init` to
refine the defaults (cost profile, tools, Context7 key), or `/midas-adopt` for an existing codebase.
Power tools (`/midas-tribunal`, `/midas-verify`, `/midas-monorepo`) live under
**[Core vs advanced](#core-vs-advanced)** below.

**Alternatives:**
- **Claude Code plugin:** `/plugin marketplace add okuzpe/midas-harness` → `/plugin install midas@midas` → `/midas-init`.
- **Copy only (any tool):** `npx giget@latest gh:okuzpe/midas-harness ./my-project`.

Full guide with every method, flags, and uninstall: **[INSTALL.md](./INSTALL.md)**. No Claude Code?
`AGENTS.md` carries the project law to Cursor, Copilot, Codex and Windsurf (and Gemini via `GEMINI.md`);
skill/command behavior and model routing vary by tool — see the [tools matrix](#supported-tools).

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

## Core vs advanced
| Track | For | Commands |
|---|---|---|
| **Core** | drive any project through the lifecycle | `/midas-init` · `/midas-status` · the phase commands (`/idea-intake` → `/close-sprint`) · `/midas-doctor` |
| **Brownfield** | adopt Midas into an existing repo | `/midas-adopt` |
| **Advanced** | deeper audits & scale | `/midas-tribunal` (whole-project debate) · `/midas-verify` (Playwright UI checks) · `/midas-monorepo` |
| **Maintenance** | keep an install current | `/midas-update` · `/midas-doctor` |

Most users only need **Core** (+ `/midas-adopt` for an existing repo). Everything else is opt-in.

## Supported tools

| Tool | Reads `AGENTS.md` | Skills / commands | Model routing | Recommended level |
|---|---|---|---|---|
| **Claude Code** | via `@AGENTS.md` in `CLAUDE.md` | native (`.claude/skills/`) + subagents | ✅ per-agent | **Full** |
| Cursor | native | partial (`.cursor/rules` + skills where supported) | advisory | Good |
| OpenAI Codex | native | partial (Agent Skills) | advisory | Good |
| GitHub Copilot | native | partial (Agent Skills) | advisory | Good |
| Gemini CLI | via `GEMINI.md` | via extensions | advisory | Basic |
| Windsurf | native | partial (rules) | advisory | Basic |

Generated adapters (`CLAUDE.md`, `.cursor/rules`, `.windsurf/rules`, `GEMINI.md`) are re-rendered from a
single source by `/midas-doctor` — no hand-editing, no drift.

> **Honest scope.** "native" means read **without conversion**, not feature parity. **Claude Code is the
> primary target** (skills, subagents, and per-agent model tiering). Other tools get the methodology and
> rules via `AGENTS.md` / `GEMINI.md` / generated adapters; **model routing is advisory (prose), not
> enforced** there. You get the *process* everywhere — automatic cost-routing only on Claude Code.

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
**v0.3.0 — pre-1.0, actively developed (not yet a stable API).** The full lifecycle from idea to code,
**greenfield and brownfield** (`/midas-adopt`), plus `/midas-monorepo`, `/midas-verify` (Playwright), a
component design system, four install methods, the plugin marketplace, and `/midas-tribunal`. Most
complete on **Claude Code**; other tools get the methodology + adapters but not automatic model routing
(see the compatibility note above). See [`CHANGELOG.md`](./CHANGELOG.md), [`VERSIONING.md`](./VERSIONING.md),
and the docs site (`mkdocs.yml`).

## License
[Apache-2.0](./LICENSE). Contributions welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
