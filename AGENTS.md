# AGENTS.md — harness

> This file is project law for **any** AI agent working in this repository
> (Claude Code, Cursor, Copilot, Codex, Windsurf, …).
> It is **generated** from the Midas harness. Edit `harness/conventions.md`
> and re-run `/midas-doctor` to propagate changes — never edit this file directly.

## What this project is

<!-- TODO: one-paragraph product description filled in by /midas-init from product/idea.md -->

- Stack: **undecided — set in Phase 4 (`/choose-architecture`)**
- AI tools wired: **claude-code, cursor, windsurf, gemini**
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

## Continuous capture of recurring patterns (always-on)

When the user asks for the **same thing ~2-3 times**, or **corrects you the same way** repeatedly, it is no
longer a one-off — **pause and propose codifying it** so every later sprint and audit honours it
automatically (*recommend-don't-wall* — propose, never write silently):

> *"You've asked for X three times — want me to capture it as a rule so the project always follows it?"*

On the user's **OK**, write the **right** artifact and show the diff:
- a **constraint / preference** → a **rule** in `harness/rules/<slug>.md` (with a `**CHECK:**`; re-render adapters);
- a **procedure** → a **playbook** in `product/playbooks/<verb-noun>.md`;
- a **prose preference** → an entry in `product/conventions.md`.

A per-project pattern is a rule/playbook/convention — **not** a new slash-command. `/midas-capture` is the
manual trigger and the canonical procedure. Captures go to these **visible** artifacts (reviewable in git),
never a hidden store.

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
  `/midas-adopt`, `/midas-update`, `/midas-verify`, `/midas-monorepo`, `/midas-tribunal`, `/midas-security-audit`, `/midas-sweep`, `/midas-capture`) are **user-typed slash commands**
  (`disable-model-invocation`). **Never call them via the Skill tool** (it errors) or auto-run them — when one
  is the next step, **surface the command for the user to type** ("👉 Run `/…`"). Each also guards this in its body.
- Secrets only via `${ENV_VAR}`; never write a key to disk or commit one.
- Generated adapters (`CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`, `GEMINI.md`) must not be
  hand-edited; they are re-rendered by `/midas-doctor`.
