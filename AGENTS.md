# AGENTS.md — midas-harness

> This file is project law for **any** AI agent working in this repository (Claude Code, Cursor,
> Copilot, Codex, Windsurf, …). It is the source of truth; `CLAUDE.md`, `.cursor/rules/*.mdc` and
> `.windsurf/rules/*.md` are **generated** from it and from `harness/conventions.md`.

## What this repo is
**Midas** is a portable, AI-tool-agnostic **product-development harness**: a copy-in kit of markdown
(skills, rules, slash-commands, agent definitions) that drives a software product from raw idea to
shipped code through 9 audited phases. It installs into any project and works across many AI tools.

- Methodology: `harness/methodology.md` (+ per-phase guides in `harness/pipeline/`)
- Source of truth: `harness/`, `.claude/skills/`, this `AGENTS.md`
- Generated adapters (do not hand-edit): `CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`

## How to work on Midas
- Edit conventions in `harness/conventions.md`, then run `/midas-doctor` (or `node scripts/render-adapters.mjs`)
  to re-render the adapters. Never edit a generated adapter directly.
- Skills are authored once as `.claude/skills/<name>/SKILL.md` (Agent Skills standard). **Claude Code
  consumes them natively; other tools receive the methodology + rules via `AGENTS.md` / `GEMINI.md` /
  generated adapters where supported — feature parity varies.** No per-tool copies.
- Keep everything plain markdown + the two optional Node scripts (`render-adapters`, `doctor`).

## Build / test / verify
- No build step (markdown-first). Optional scripts: `node scripts/render-adapters.mjs`, `node scripts/doctor.mjs`.
- `/midas-doctor` is the only sync engine: it detects adapter drift and can re-render it.

## Conventions
Follow `harness/conventions.md` (code quality, naming, errors, testing, deps, git, security, design
system) and the always-on rules in `harness/rules/`. Precedence: stack rules > product/conventions >
design-system > base conventions.

## Fetch current docs before third-party code (recommended tool: Context7)
Before writing code against any third-party library, fetch its **current, version-accurate docs** — via
the Context7 MCP (recommended, **optional**) or your own doc tool / web fetch. See
`harness/rules/context7-usage.md`. **Never generate third-party code from memory.**

## Model routing (cost-aware)
Use the strongest model to **think/plan/audit** (orchestrate), a mid model to **implement** (build),
and the fastest/cheapest to **search/extract** (scout). IDs and profiles: `docs/agents-and-models.md`.
On tools without per-agent model selection, apply this as intent: fastest model for research,
strongest for architecture and audits.

## Safety
- Side-effecting skills (`/midas-init`, `/define-conventions`, `/start-sprint`, `/close-sprint`,
  `/midas-doctor`) must only run when the user explicitly invokes them — each guards this in its body.
- Secrets only via `${ENV_VAR}`; never write a key to disk or commit one.
