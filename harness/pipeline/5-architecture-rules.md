# Phase 5 — Architecture-as-Rules + Design System

**Stage enum:** `architecture_rules` | **Tier:** orchestrate (define) + build (write)

## Purpose

Translate architectural decisions into checkable, machine-readable rules that every
subsequent phase enforces. Produce a design system so UI never diverges. Freeze the
rules before **new** MVP work begins (brownfield: codify as-built before sprint execution);
the Phase 8 audit references exactly these files.

## Inputs

- `{product}/architecture.md` + `{product}/adr/ADR-*.md` (Phase 4)
- `paths.state` (stage must be `architecture_rules`)

## Key steps

1. **Derive rules from the architecture.** For each architectural decision:
   - Write a named project rule file in `<paths.rules>/<slug>.md`
   - Each rule must be CHECKABLE: it describes a condition that can be verified by
     reading code or running a command — not a general principle.
   - Example: `no-cross-layer-imports.md` with a grep pattern to detect violations.
2. **Write the folder-structure rule.** `<paths.rules>/folder-structure.md` is mandatory.
   It defines the canonical directory layout for this project's codebase. For feature/module
   architectures, encode **Scope Rule** (code used by **1** feature stays local; used by **2+**
   lives in shared) and **screaming** names (folders named for user jobs, not `components/` /
   `hooks/` as the top level). A Phase-4 ADR that chose layered/hexagonal/ports **wins** when it
   conflicts — record that exception in the rule. Seed from
   `<paths.engine>/templates/folder-structure.md` when useful.
3. **Write `{product}/conventions.md`.** Project-level overrides of `<paths.engine>/conventions.md`
   (naming, error handling, test patterns specific to the chosen stack).
4. **Set the design direction, then write the design system.**
   - `{product}/design-direction.md` — the aesthetic **intent**: brand personality, **metaphor / how it
     should feel**, **first-viewport product evidence**, **2–3 real products to
     emulate** (+ what to borrow), mood keywords, **anti-references** (include the default SaaS landing
     stack unless justified). **Capture it from the human** (their
     taste is the input) — a concrete reference + metaphor is what stops generic, default-looking UI. Prefer a design
     specialist (`voltagent-core-dev:ui-designer` / `design-bridge`) if installed. Mid-project redesigns use
     `/midas-design` against this file.
   - `{product}/design-system.md` — human-readable reference: color palette, spacing scale, typography,
     component vocabulary, do/don't examples — **built to the direction** (each choice traces to a reference).
   - `{product}/design-system/tokens.json` — project-owned machine-readable token map, seeded from the base.
   - `{product}/design-system/tokens.css` — CSS custom properties derived from the project token map.
5. **Write the project playbooks.** Emit **up to 4** markdown recipes (zero is valid) to
   `{product}/playbooks/<verb-noun>.md` for the tasks that *repeat* in this stack (e.g. add an API
   endpoint, add a DB migration, scaffold a component). Each: use-when, a `Trigger` (diff predicate),
   steps, the rules/tokens it honors (reference by `<slug>.md`, don't restate), a Context7 fetch for any
   third-party API, and a
   done-when check that is the procedure's own signal. **CHECK:** each playbook has ≥1 step no single
   rule states (1:1-to-rules → cut). Playbooks are markdown the build agent follows — **not** slash-commands.
6. **Scaffold the enforcement tooling.** Generate the stack-standard linter + formatter
   (ESLint+Prettier / Biome / Ruff) wired to the rules, git hooks (Husky/lefthook/pre-commit) +
   lint-staged, commit-msg lint, and a CI lint job — Context7-verified. Show the configs, then
   **ask the user** whether to install: on yes, run the install; on no, leave the configs and print the
   exact command (recommend-don't-wall — never a hard dependency). This makes each rule's CHECK real on
   every commit instead of only graded at Phase 8.
7. **Render adapters.** Run `node <paths.scripts>/render-adapters.mjs` (or `/midas-doctor`) to
   propagate the new rules into `CLAUDE.md`, `.cursor/rules/00-midas.mdc`,
   `.cursor/rules/01-midas-checks.mdc`, and the layout-nested Windsurf
   `00-midas.md` / `01-midas-checks.md` pair. Do not hand-edit the generated adapters.
8. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: sprint_planning`.

## Output artifacts

| File | Notes |
|---|---|
| `<paths.rules>/<slug>.md` | One project-owned file per rule; folder-structure required |
| `{product}/conventions.md` | Stack-specific overrides |
| `{product}/playbooks/<verb-noun>.md` | 0–4 recipes for the project's repeated tasks (zero is valid) |
| `{product}/design-direction.md` | Aesthetic intent (brand + real references + anti-references) — anchors the tokens |
| `{product}/design-system.md` | Human-readable design reference |
| `{product}/design-system/tokens.json` | Project token map |
| `{product}/design-system/tokens.css` | Project CSS custom properties |
| linter/formatter + git-hook + CI config | Enforcement scaffolding wired to the rules (installed on the user's OK) |

## Exit gate checklist

- [ ] `<paths.rules>/folder-structure.md` exists and describes the real project layout, including
      Scope Rule (1 = local, 2+ = shared) **or** an ADR-justified exception, and names features/jobs
      rather than only technical layers
- [ ] Every other architectural decision from Phase 4 has a corresponding rule file
- [ ] Each rule is CHECKABLE (grep pattern, lint rule, or explicit verification command given)
- [ ] **`{product}/conventions.md`** present and references the base `<paths.engine>/conventions.md`
- [ ] Stack rules **Context7-verified** at pinned versions; every generated stack rule carries
      `docs: <lib>@<version> via <tool>` provenance (no provenance → fail)
- [ ] Stack rules cover the framework's canonical idiom + lint set (not just naming/format)
- [ ] Floor CHECKs re-targeted for the stack (`security`, `code-quality`, `testing`, `naming`) or
      recorded as confirmed-applicable; inert floor greps for the chosen stack → fail
- [ ] `{product}/design-direction.md` captures aesthetic intent (brand + metaphor + first-viewport
      product evidence + ≥2 real references + anti-references)
- [ ] `{product}/design-system.md` defines colors, spacing, type, and components; accessibility floor
      satisfiable or recorded **N/A (headless, no UI)**
- [ ] `{product}/playbooks/` holds 0–4 recipes; each has ≥1 step no single rule states
- [ ] Enforcement tooling scaffolded (linter+formatter, commit hook, commit-msg lint, CI lint job) —
      installed on user's OK or left with exact command; decision in `paths.state → enforcement:`
- [ ] `{product}/design-system/tokens.json` and `tokens.css` are consistent with each other
- [ ] `node <paths.scripts>/render-adapters.mjs` ran without errors; generated adapters are up to date
- [ ] Gate verdict written to `{runs}/audits/gate-05.md` (seed: `templates/gate-record.md`)

## Recommended tier + agents

- **Define rules + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
- **Write files:** `build` (`midas-builder`, `claude-sonnet-4-6`)
