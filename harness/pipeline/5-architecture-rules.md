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
4. **Write the design system.**
   - `product/design-system.md` — human-readable reference: color palette, spacing scale,
     typography, component vocabulary, do/don't examples.
   - `harness/design-system/tokens.json` — machine-readable token map.
   - `harness/design-system/tokens.css` — CSS custom properties derived from the token map.
5. **Render adapters.** Run `node scripts/render-adapters.mjs` (or `/midas-doctor`) to
   propagate the new rules into `CLAUDE.md`, `.cursor/rules/00-midas.mdc`, and
   `.windsurf/rules/00-midas.md`. Do not hand-edit the generated adapters.
6. **Advance.** Set `stage_status: gate_pending`; run the exit gate.
   On pass, write `gate: passed` and set `stage: sprint_planning`.

## Output artifacts

| File | Notes |
|---|---|
| `harness/rules/<slug>.md` | One file per rule; folder-structure required |
| `product/conventions.md` | Stack-specific overrides |
| `product/design-system.md` | Human-readable design reference |
| `harness/design-system/tokens.json` | Token map |
| `harness/design-system/tokens.css` | CSS custom properties |

## Exit gate checklist

- [ ] `harness/rules/folder-structure.md` exists and describes the real project layout
- [ ] Every other architectural decision from Phase 4 has a corresponding rule file
- [ ] Each rule is CHECKABLE (grep pattern, lint rule, or explicit verification command given)
- [ ] `product/conventions.md` is present and references the base `harness/conventions.md`
- [ ] `product/design-system.md` defines colors, spacing, type, and components
- [ ] `harness/design-system/tokens.json` and `tokens.css` are consistent with each other
- [ ] `node scripts/render-adapters.mjs` ran without errors; generated adapters are up to date
- [ ] Gate verdict written to `.harness/audits/audit-05.md`

## Recommended tier + agents

- **Define rules + audit:** `orchestrate` (`midas-orchestrator`, `claude-opus-4-8`)
- **Write files:** `build` (`midas-builder`, `claude-sonnet-4-6`)
