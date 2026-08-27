# AGENTS.md — harness

> This file is project law for **any** AI agent working in this repository
> (Claude Code, Cursor, Copilot, Codex, Windsurf, …).
> It is **engine-repo only** (manually curated; ADR-005). Product installs get a different
> `AGENTS.md` from `harness/templates/AGENTS.md.tmpl` → `cli/template/AGENTS.md` at install time.
> Edit `harness/conventions.md` and re-run `/midas-doctor` to propagate adapter changes — this
> summary file is updated manually when engine metadata changes.

## What this project is

**Midas-harness** is the engine repository for the Midas methodology — a copy-in kit of skills,
rules, slash-commands, and agent definitions that drives software products from idea to shipped code
through 9 audited phases. This repo **authors** that methodology in `harness/` — it does **not**
run the lifecycle on itself (see `docs/dogfood.md`). Never run `create-midas` install/update
against this root (see `harness/rules/engine-repo-boundary.md`).

- Stack: **Node ESM scripts + MkDocs** (engine tooling); product stacks are chosen per install in Phase 4
- AI tools wired: **claude-code, cursor, windsurf, gemini**
- Methodology: `harness/methodology.md` (9 audited phases, idea → shipped)
- State: `harness/state.yaml` (contributor metadata — version, routing, path overrides)
- Trace cache: `runs/cache/` (gitignored); lifecycle CI fixture: `scripts/fixtures/product-closed/`

## Conventions (always-on)

All rules in `harness/conventions.md` apply unconditionally. Key points:

- **Code quality** — match surrounding code; prefer reuse over new abstractions; no dead code.
- **Naming** — kebab-case files, PascalCase types, per-language idiom for functions/vars.
- **Errors** — validate at boundaries; fail fast with actionable messages; never swallow errors.
- **Testing** — every behaviour change ships with a test; test behaviour, not implementation.
- **Dependencies** — justify before adding; pin versions; fetch current docs (Context7 or your own tool) before any third-party code.
- **Git** — Conventional Commits (`feat:` `fix:` `docs:` `refactor:` `test:` `chore:`); small reviewable commits.
- **Engine releases (this repo)** — publish / bump versions only with `npm run bump -- <X.Y.Z>`
  (`harness/rules/change-propagation.md` + `VERSIONING.md`). Do not hand-edit version pins across the tree.
- **Security** — secrets only in `${ENV_VAR}`; never commit them; least-privilege MCP scopes.
- **Design system** — all UI uses `{product}/design-system.md` tokens; never hardcode colour/spacing/type.
- **Skills portability** — `harness/skills/` is the editable source; `.claude/skills` and
  `.agents/skills` are generated mirrors (`npm run build`) for host discovery (Claude / Codex /
  Cursor / Gemini). Never hand-edit the mirrors.

Stack-specific rules are generated in Phase 5 on **product installs**. Project overlays at
`<paths.rules>/` win over stack and base rules with the same slug — see `harness/conventions.md`
precedence. In this engine repo, `harness/rules/` is the **base** set, not a stack overlay.

## Path resolution

The engine repository keeps authored source in `harness/` and development scripts in `scripts/`.
Installed v2 projects read `layout` and `paths` from **`.harness/state.yaml`** first:

- **`{runs}/`** — `.harness/runs/`
- **`{product}/`** — `.harness/product/`

Installed engine source lives at `.harness/engine/`; project rule overlays live at `.harness/rules/`.
Classic, compact, and hub paths are read-only migration inputs.

## Continuous capture of recurring patterns (always-on)

When the user asks for the **same thing ~2-3 times**, or **corrects you the same way** repeatedly, it is no
longer a one-off — **pause and propose codifying it** so every later sprint and audit honours it
automatically (*recommend-don't-wall* — propose, never write silently):

> *"You've asked for X three times — want me to capture it as a rule so the project always follows it?"*

On the user's **OK**, write the **right** artifact and show the diff:
- a **constraint / preference** → a **rule** in `.harness/rules/<slug>.md` in installed projects (with a `**CHECK:**`; re-render adapters);
- a **procedure** → a **playbook** in `{product}/playbooks/<verb-noun>.md`;
- a **prose preference** → an entry in `{product}/conventions.md`.

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

Active profile and resolved IDs: `harness/state.yaml → routing` (must match
`resolveCostAwareRouting(routing_profile, cost_profile)` under Claude — doctor enforces).
On tools without per-agent model selection, apply as intent: fastest for research, strongest for architecture and audits.
Skills must name produce/fetch legs in `## Tier & delegation` — `harness-tier` alone is not enough.

## Safety

- **Trace observe ≠ safety deny.** Harness Trace hooks are fail-open (record only; ADR-010). When
  `tools` includes `cursor`, the installer may also merge **fail-closed** safety hooks (ADR-012) —
  agents must not treat Trace spans as enforcement. See `harness/rules/cursor-safety-hooks.md`.
- Side-effecting skills are **user-typed slash commands** (`disable-model-invocation`) **or**
  **path-pass reads** under a parent orchestrator the human typed (ADR-013). **Never call them via
  the Skill tool** (it errors) or auto-run them as slash. When a **primary** skill is the next step,
  **surface the command for the user to type** ("👉 Run `/…`"). When an **internal** procedure is
  needed (`user-surface: internal`: `/midas-progress`, `/midas-qa`, `/midas-diff-gates`,
  `/midas-lean-review`, `/midas-sweep`), the parent (`/start-sprint`, `/close-sprint`, `/midas-hygiene`, Phase 7 body)
  **reads** `<paths.engine>/skills/<name>/SKILL.md` and runs those steps in-process — power-users
  may still type the internal slash. Primary side-effect examples: `/midas-init`, `/define-conventions`,
  `/start-sprint`, `/close-sprint`, `/midas-doctor`, `/midas-adopt`, `/midas-hygiene`, `/midas-verify`,
  `/midas-design`, `/midas-init --monorepo`, `/midas-tribunal`, `/midas-security-audit`, `/midas-capture`,
  `/midas-align`, `/midas-precommit`, `/midas-bundle`, `/midas-explore`, `/midas-auto-pilot`,
  `/midas-retro`, `/midas-investigate`. Deprecated aliases (`/midas-improve-loop`, `/midas-autopilot`,
  `/midas-auto-sprints`, `/midas-update`) forward to their primary — do not list in `/midas-help`.
- **State ritual (shared):** skills read **`paths.state` first** and **write last** (read-modify-write). They
  cite `harness/templates/skill-state-ritual.md` (installed: `<paths.engine>/templates/skill-state-ritual.md`)
  instead of restating stage enums or path substitution. Schema: `harness/state.schema.md`.
- Secrets only via `${ENV_VAR}`; never write a key to disk or commit one.
- Generated adapters (`.claude/CLAUDE.md` in installs, `CLAUDE.md` in this engine repo, `.cursor/rules/00-midas.mdc`, `.cursor/rules/01-midas-checks.mdc`, `harness/.windsurf/rules/00-midas.md`, `harness/.windsurf/rules/01-midas-checks.md`, `GEMINI.md`) must not be
  hand-edited; they are re-rendered by `/midas-doctor`.
