# Phase 5 — Architecture-as-Rules + Design System

**Stage enum:** `architecture_rules` | **Tier:** orchestrate (define) + build (write)

## Purpose

Translate architectural decisions into checkable, machine-readable rules that every
subsequent phase enforces. Produce a design system so UI never diverges. Freeze the
rules before any code is written; the Phase 8 audit references exactly these files.

## Inputs

- `product/architecture.md` + `product/adr/ADR-*.md` (Phase 4)
- `harness/state.yaml` (stage must be `architecture_rules`)

## Key steps

1. **Derive rules from the architecture.** For each architectural decision:
   - Write a named rule file in `harness/rules/<slug>.md`
   - Each rule must be CHECKABLE: it describes a condition that can be verified by
     reading code or running a command — not a general principle.
   - Example: `no-cross-layer-imports.md` with a grep pattern to detect violations.
2. **Write the folder-structure rule.** `harness/rules/folder-structure.md` is mandatory.
   It defines the canonical directory layout for this project's codebase.
3. **Write `product/conventions.md`.** Project-level overrides of `harness/conventions.md`
   (naming, error handling, test patterns specific to the chosen stack).
4. **Set the design direction, then write the design system.**
   - `product/design-direction.md` — the aesthetic **intent**: brand personality, **2–3 real products to
     emulate** (+ what to borrow), mood keywords, **anti-references**. **Capture it from the human** (their
     taste is the input) — a concrete reference is what stops generic, default-looking UI. Prefer a design
     specialist (`voltagent-core-dev:ui-designer` / `design-bridge`) if installed.
   - `product/design-system.md` — human-readable reference: color palette, spacing scale, typography,
     component vocabulary, do/don't examples — **built to the direction** (each choice traces to a reference).
   - `harness/design-system/tokens.json` — machine-readable token map.
   - `harness/design-system/tokens.css` — CSS custom properties derived from the token map.
5. **Write the project playbooks.** Emit **up to 4** markdown recipes (zero is valid) to
   `product/playbooks/<verb-noun>.md` for the tasks that *repeat* in this stack (e.g. add an API
   endpoint, add a DB migration, scaffold a component). Each: use-when, steps, the rules/tokens it
   honors (reference by `<slug>.md`, don't restate), a Context7 fetch for any third-party API, and a
   done-when check that is the procedure's own signal. **CHECK:** each playbook has ≥1 step no single
   rule states (1:1-to-rules → cut). Playbooks are markdown the build agent follows — **not** slash-commands.
6. **Scaffold the enforcement tooling.** Generate the stack-standard linter + formatter
   (ESLint+Prettier / Biome / Ruff) wired to the rules, git hooks (Husky/lefthook/pre-commit) +
   lint-staged, commit-msg lint, and a CI lint job — Context7-verified. Show the configs, then
   **ask the user** whether to install: on yes, run the install; on no, leave the configs and print the
   exact command (recommend-don't-wall — never a hard dependency). This makes each rule's CHECK real on
   every commit instead of only graded at Phase 8.
7. **Render adapters.** Run `node scripts/render-adapters.mjs` (or `/midas-doctor`) to
   propagate the new rules into `CLAUDE.md`, `.cursor/rules/00-midas.mdc`, and
   `.windsurf/rules/00-midas.md`. Do not hand-edit the generated adapters.
8. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: sprint_planning`.

## Output artifacts

| File | Notes |
|---|---|
| `harness/rules/<slug>.md` | One file per rule; folder-structure required |
| `product/conventions.md` | Stack-specific overrides |
| `product/playbooks/<verb-noun>.md` | 0–4 recipes for the project's repeated tasks (zero is valid) |
| `product/design-direction.md` | Aesthetic intent (brand + real references + anti-references) — anchors the tokens |
| `product/design-system.md` | Human-readable design reference |
| `harness/design-system/tokens.json` | Token map |
| `harness/design-system/tokens.css` | CSS custom properties |
| linter/formatter + git-hook + CI config | Enforcement scaffolding wired to the rules (installed on the user's OK) |

## Exit gate checklist

- [ ] `harness/rules/folder-structure.md` exists and describes the real project layout
- [ ] Every other architectural decision from Phase 4 has a corresponding rule file
- [ ] Each rule is CHECKABLE (grep pattern, lint rule, or explicit verification command given)
- [ ] `product/conventions.md` is present and references the base `harness/conventions.md`
- [ ] `product/design-direction.md` captures the aesthetic intent (brand + ≥2 real references + anti-references) from the human; tokens trace to it (not generic)
- [ ] `product/design-system.md` defines colors, spacing, type, and components
- [ ] `product/playbooks/` holds 0–4 recipes for repeated tasks (use-when/steps/rules/Context7/done-when); each has ≥1 step no single rule states (none duplicates a rule)
- [ ] Enforcement tooling is scaffolded (linter+formatter wired to the rules, a commit hook + lint-staged, commit-msg lint, a CI lint job) — installed on the user's OK or left with the exact command
- [ ] `harness/design-system/tokens.json` and `tokens.css` are consistent with each other
- [ ] `node scripts/render-adapters.mjs` ran without errors; generated adapters are up to date
- [ ] Gate verdict written to `.harness/audits/audit-05.md`

## Recommended tier + agents

- **Define rules + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
- **Write files:** `build` (`midas-builder`, `claude-sonnet-4-6`)
