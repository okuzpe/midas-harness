# AGENTS.md — keel-harness

> This file is project law for **any** AI agent working in this repository (Claude Code, Cursor,
> Copilot, Codex, Windsurf, …). It is the source of truth; `CLAUDE.md`, `.cursor/rules/*.mdc` and
> `.windsurf/rules/*.md` are **generated** from it and from `harness/conventions.md`.

## What this repo is
**Keel** is a portable, AI-tool-agnostic **product-development harness**: a copy-in kit of markdown
(skills, rules, slash-commands, agent definitions) that drives a software product from raw idea to
shipped code through 9 audited phases. It installs into any project and works across many AI tools.

- Methodology: `harness/methodology.md` (+ per-phase guides in `harness/pipeline/`)
- Source of truth: `harness/`, `.claude/skills/`, this `AGENTS.md`
- Generated adapters (do not hand-edit): `CLAUDE.md`, `.cursor/rules/00-keel.mdc`, `.windsurf/rules/00-keel.md`

## How to work on Keel
- Edit conventions in `harness/conventions.md`, then run `/keel-doctor` (or `node scripts/render-adapters.mjs`)
  to re-render the adapters. Never edit a generated adapter directly.
- Skills are authored once as `.claude/skills/<name>/SKILL.md` (Agent Skills standard) — Cursor,
  Copilot and Codex read them natively too. No per-tool copies.
- Keep everything plain markdown + the two optional Node scripts (`render-adapters`, `doctor`).

## Build / test / verify
- No build step (markdown-first). Optional scripts: `node scripts/render-adapters.mjs`, `node scripts/doctor.mjs`.
- `/keel-doctor` is the only sync engine: it detects adapter drift and can re-render it.

## Conventions
Follow `harness/conventions.md` (code quality, naming, errors, testing, deps, git, security, design
system) and the always-on rules in `harness/rules/`. Precedence: stack rules > product/conventions >
design-system > base conventions.

## Context7 (mandatory)
Before writing code against any third-party library, fetch current docs via Context7
(`resolve-library-id` → `get-library-docs` at the in-use version). See `harness/rules/context7-usage.md`.
If Context7 is down, use the documented web fallback — never generate third-party code from memory.

## Model routing (cost-aware)
Use the strongest model to **think/plan/audit** (orchestrate), a mid model to **implement** (build),
and the fastest/cheapest to **search/extract** (scout). IDs and profiles: `docs/agents-and-models.md`.
On tools without per-agent model selection, apply this as intent: fastest model for research,
strongest for architecture and audits.

## Safety
- Side-effecting skills (`/keel-init`, `/define-conventions`, `/start-sprint`, `/close-sprint`,
  `/keel-doctor`) must only run when the user explicitly invokes them — each guards this in its body.
- Secrets only via `${ENV_VAR}`; never write a key to disk or commit one.
