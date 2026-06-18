# Midas ✨ — a stateful, auditable, resumable product lifecycle for AI coding agents

> **Copy Midas into your repo and your AI agent builds with context instead of improvising.**
> Nine audited phases take a raw idea to shipped code — the rules are **frozen**, the gates are
> **machine-checkable** (not just model-graded), and the whole run is **resumable** from one state file.

[![CI](https://github.com/okuzpe/midas-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/okuzpe/midas-harness/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Docs](https://img.shields.io/badge/docs-mkdocs-6E56CF)](https://okuzpe.github.io/midas-harness/)
[![AGENTS.md](https://img.shields.io/badge/AGENTS.md-compatible-success)](https://agents.md)
[![Agent Skills](https://img.shields.io/badge/Agent_Skills-compatible-success)](https://agentskills.io)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**Midas** is a copy-in kit of plain markdown — skills, rules, slash-commands, and agent definitions —
that drives a software **product** from a raw idea to shipped code through **9 audited phases**. It runs
best on **Claude Code**; generated adapters and `AGENTS.md` carry the rules to Cursor, Copilot, Codex,
Windsurf and Gemini (see [Supported tools](#supported-tools) for what carries to other tools).

Full docs: **[okuzpe.github.io/midas-harness](https://okuzpe.github.io/midas-harness/)**.

## Why
Most AI coding setups jump straight to code. Midas front-loads the thinking — clarify the idea, research
the market, decide architecture, **freeze the rules**, plan sprints — then makes every sprint a control
loop that re-audits the living code against those frozen rules.

## What makes Midas different
- **Gates are real, not prose.** Every floor rule in `harness/rules/*` ships a concrete `CHECK:`
  (a grep/command or a `manual:` observable), and `/midas-doctor` parses each frozen sprint audit
  against `harness/state.yaml` — flagging any sprint marked `done` while its audit still shows
  unresolved critical findings. *The first gate check that lives outside the model.*
- **It closes the loop on disk.** [`examples/taskpilot`](./examples/taskpilot/) drives Sprint 1 to
  `done` — build → [`audit-01.md`](./examples/taskpilot/.harness/audits/audit-01.md) (verdict **PASS**,
  one rule consciously amended and tracked forward to Sprint 3) → Sprint 2 queued. The signature
  execute ⇄ audit loop (phases 7 and 8), demonstrated.
- **Cost-aware by default.** Opus runs only the ~6 irreversible decisions (idea framing, stack choice,
  the audits); Sonnet builds, Haiku scouts. Current library docs are fetched before any third-party code
  ([Context7](#mcp--context7) recommended, or your own tool), so it's written against real APIs, not memory.

## When to use Midas — and when not to
**Use it** when you want an agent to respect architecture, conventions, and tests instead of improvising —
on a new product (full lifecycle) or an existing repo (`/midas-adopt`).

**Skip it** for a quick one-off script, a throwaway prototype, or when you already have an agent setup
you're happy with. Midas adds process; that's overhead you don't want for a 20-line tool.

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
audits before advancing — and a human signs off on the irreversible calls (go/no-go, each ADR, every
rule amendment, ship). State lives in one file, `harness/state.yaml`, so any agent on any tool can
resume. Full spec: [`harness/methodology.md`](./harness/methodology.md).

## Quickstart

Install Midas into any project (new **or** existing) — it only adds files (never deletes yours). Run it
**inside the project**:

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
```
```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
```

The installer writes `harness/state.yaml` + the adapters and leaves the project ready. Open it in
**Claude Code** and run the one-time setup, then let `/midas-status` drive the rest:

```text
/midas-init        # one-time guided setup — a few questions once (adopts an existing repo for you)
/midas-status      # from here on: the current phase and the single next command
/idea-intake       # …then the phases in order — /midas-status always tells you what's next
```

Other install methods (`npx github:okuzpe/midas-harness`, the Claude Code plugin, copy-only, pinned
releases) and installer-safety notes are in **[INSTALL.md](./INSTALL.md)**.

---

## Reference

### Core vs advanced
| Track | For | Commands |
|---|---|---|
| **Core** | drive any project through the lifecycle | `/midas-init` · `/midas-status` · the phase commands (`/idea-intake` → `/close-sprint`) · `/midas-doctor` |
| **Brownfield** | adopt Midas into an existing repo | `/midas-adopt` |
| **Advanced** | deeper audits & scale | `/midas-tribunal` (whole-project debate) · `/midas-verify` (Playwright UI checks) · `/midas-monorepo` |
| **Maintenance** | keep an install current | `/midas-update` · `/midas-doctor` |

Most users only need **Core** (+ `/midas-adopt` for an existing repo). Everything else is opt-in.

### Supported tools

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

> **Honest scope.** Claude Code gets the full experience — skills, subagents, and per-agent model
> tiering. Every other tool reads the same methodology and rules via `AGENTS.md` / `GEMINI.md` /
> generated adapters, so you get the *process* everywhere; there, **model routing is advisory (prose),
> not enforced**. "native" means read **without conversion**, not feature parity.

### MCP / current docs
Midas ships a secret-free [`.mcp.json`](./.mcp.json) wiring **sequential-thinking**. The
**fetch-current-docs** rule (`harness/rules/context7-usage.md`) is **tool-agnostic** — Midas mandates the
*habit* (fetch version-accurate docs before third-party code), not a vendor. Wire whichever doc tool you
like: **[Context7](https://context7.com)** is the recommended free option (add `CONTEXT7_API_KEY` to your
env to raise the rate limit), or use a web-fetch MCP / your editor's docs. Other optional servers:
git/GitHub, fetch, filesystem, Playwright (UI sprints only). See [`SECURITY.md`](./SECURITY.md) for
least-privilege guidance.

### Cost-aware orchestration
Three self-contained agents ship with Midas — `midas-orchestrator` (Opus, think/audit),
`midas-builder` (Sonnet, implement), `midas-scout` (Haiku, search). If you have specialist packs
installed, Midas prefers them; otherwise it works with the three built-ins. One bump point for model
IDs: [`docs/agents-and-models.md`](./docs/agents-and-models.md).

### Deep audits — put the project on trial
`/midas-tribunal` runs a standing, **whole-project adversarial debate**: a steelman Defense vs a
red-team Prosecution plus a dissent-forcing Catfish argue every assumption across idea, market,
business model, architecture, scope, rules, and code. Cheaper tiers debate; the Opus judge rules
**per claim** and every claim must cite on-disk evidence or it's struck. It complements `/close-sprint`
(which checks a sprint against the frozen rules) by asking the prior question — *were those decisions
right?* Output is a ranked findings report frozen to `.harness/debates/debate-NN.md`. See a worked run
in [`examples/taskpilot/.harness/debates/debate-01.md`](./examples/taskpilot/.harness/debates/debate-01.md).

### Worked example
A runnable Sprint-1 vertical slice — auth, task CRUD, middleware, board stub + tests — plus every phase
artifact on disk. See [`examples/taskpilot/`](./examples/taskpilot/).

## Status
**v0.5.7 — pre-1.0, actively developed (not yet a stable API).** Most complete on **Claude Code**
(see [Honest scope](#supported-tools)). Details: [`CHANGELOG.md`](./CHANGELOG.md) ·
[`VERSIONING.md`](./VERSIONING.md) · [docs site](https://okuzpe.github.io/midas-harness/).

## License
[Apache-2.0](./LICENSE). Contributions welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
