# AGENTS.md — {{PROJECT_NAME}}

> This file is project law for **any** AI agent working in this repository
> (Claude Code, Cursor, Copilot, Codex, Windsurf, …).
> It is **generated** from the Midas harness. Edit `harness/conventions.md`
> and re-run `/midas-doctor` to propagate changes — never edit this file directly.

## What this project is

<!-- TODO: one-paragraph product description filled in by /midas-init from product/idea.md -->

- Stack: **{{STACK}}**
- AI tools wired: **{{TOOLS}}**
- Methodology: `harness/methodology.md` (9 audited phases, idea → shipped)
- State: `harness/state.yaml` (single source of truth — read it for current phase)

## Conventions (always-on)

All rules in `harness/conventions.md` apply unconditionally. Key points:

- **Code quality** — match surrounding code; prefer reuse over new abstractions; no dead code.
- **Naming** — kebab-case files, PascalCase types, per-language idiom for functions/vars.
- **Errors** — validate at boundaries; fail fast with actionable messages; never swallow errors.
- **Testing** — every behaviour change ships with a test; test behaviour, not implementation.
- **Dependencies** — justify before adding; pin versions; fetch current docs (Context7 or your own tool) before any third-party code.
- **Git** — Conventional Commits (`feat:` `fix:` `docs:` `refactor:` `test:` `chore:`); small reviewable commits.
- **Security** — secrets only in `${ENV_VAR}`; never commit them; least-privilege MCP scopes.
- **Design system** — all UI uses `product/design-system.md` tokens; never hardcode colour/spacing/type.

Stack-specific rules (generated in Phase 5) live in `harness/rules/` and take highest precedence.

## Fetch current docs before third-party code (recommended tool: Context7)

Before writing code against any third-party library, fetch its **current, version-accurate docs** — via
the Context7 MCP (recommended, **optional**) or your own doc tool / web fetch:
1. Resolve the library + the **version in use** (from the lockfile/manifest).
2. Fetch that version's docs for the API you need.
3. Write code against the returned docs — **never from memory**.

See `harness/rules/context7-usage.md` for the full rule, the no-tool fallback, and cost guidance.

## Model routing

| Tier | Role | Model |
|---|---|---|
| `orchestrate` | think / plan / audit / decide | `claude-opus-4-8` |
| `build` | implement / write artifacts | `claude-sonnet-4-6` |
| `scout` | search / extract / mechanical | `claude-haiku-4-5` |

Active profile and resolved IDs: `harness/state.yaml → routing`.
On tools without per-agent model selection, apply as intent: fastest for research, strongest for architecture and audits.

## Safety

- Side-effecting skills (`/midas-init`, `/define-conventions`, `/start-sprint`, `/close-sprint`, `/midas-doctor`,
  `/midas-adopt`, `/midas-verify`, `/midas-monorepo`, `/midas-tribunal`) are **user-typed slash commands**
  (`disable-model-invocation`). **Never call them via the Skill tool** (it errors) or auto-run them — when one
  is the next step, **surface the command for the user to type** ("👉 Run `/…`"). Each also guards this in its body.
- Secrets only via `${ENV_VAR}`; never write a key to disk or commit one.
- Generated adapters (`CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`) must not be
  hand-edited; they are re-rendered by `/midas-doctor`.
