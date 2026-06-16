<!-- Phase 5 — Design System artifact. Orchestrator defines; build tier writes.
     Exit gate: design tokens present, framework chosen and Context7-verified, every token CHECKABLE,
     adapters rendered. Inherits the base token layer from harness/design-system/tokens.{json,css}
     and extends it with project-specific overrides. -->

# Design system — {{PROJECT_NAME}}

## Purpose

This document records the project's design decisions on top of the Midas base design-system
(`harness/design-system/tokens.json` / `tokens.css`). The rendered token files live here:

- `product/design-system/tokens.json` — W3C-style project tokens (overrides + additions)
- `product/design-system/tokens.css` — CSS custom properties, `:root` + `[data-theme="dark"]`

**Rule:** all UI code must reference `--ds-*` custom properties. Never hardcode colour, spacing,
type size, or radius values.

## Framework

<!-- TODO: UI framework chosen in Phase 4 (Context7-verified). -->

- **Framework:** <!-- e.g. React 19, SvelteKit 2, Vue 3 -->
- **Context7 verified:** [ ] <!-- mark once docs fetched in Phase 4 / 5 -->
- **Component library (if any):** <!-- e.g. shadcn/ui, Radix, none -->

## Brand decisions (project-specific)

<!-- TODO: fill in any deviations from the Midas base token set -->

### Brand hue

<!-- The Midas base uses HSL 220° (blue-indigo). Override here if the product has a different brand colour. -->

- **Brand hue:** <!-- e.g. HSL 142° (green) for a sustainability app -->
- **Override rationale:** …

### Token overrides

<!-- List only tokens that DIFFER from harness/design-system/tokens.json. -->

| Token path | Base value | Project override | Reason |
|---|---|---|---|
| `color.brand.500` | `#6366f1` | <!-- TODO --> | … |

## Typography decisions

<!-- TODO: custom font choice (if any), licensing, loading strategy -->

- **Heading font:** <!-- e.g. "Inter" (system-ui fallback acceptable) | "none — system-ui" -->
- **Body font:** <!-- same as above -->
- **Mono font:** <!-- e.g. "JetBrains Mono" | "system mono stack" -->
- **Loading strategy:** <!-- preconnect + font-display:swap | local only -->

## Component catalogue (Phase 5 starter)

<!-- TODO: list the primitive components needed for Sprint 1. Phase 5 fills this; Phase 7 implements. -->

| Component | Tokens used | Notes |
|---|---|---|
| Button (primary) | `--ds-action-*` | CTA, always uses brand fill |
| Button (secondary) | `--ds-border-*`, `--ds-text-*` | Outlined variant |
| Input | `--ds-border-*`, `--ds-text-*`, `--ds-shadow-focus` | |
| Card | `--ds-surface-*`, `--ds-shadow-*`, `--ds-radius-*` | |
| Badge | `--ds-success-*` / `--ds-warning-*` / `--ds-danger-*` | Intent-coloured |
| <!-- TODO: add project-specific components --> | | |

## Accessibility baseline

- WCAG 2.1 AA minimum. Target AAA for text colours where feasible.
- Focus ring: `--ds-shadow-focus` (brand-hued, 3 px offset ring).
- Motion: `prefers-reduced-motion` respected — see base `tokens.css` reset.
- Dark mode: `[data-theme="dark"]` on `<html>` — toggle via `data-theme` attribute.

## Adapter status

<!-- TODO: updated by /midas-doctor after Phase 5 closes -->

- [ ] `CLAUDE.md` re-rendered
- [ ] `.cursor/rules/00-midas.mdc` re-rendered
- [ ] `.windsurf/rules/00-midas.md` re-rendered

---

*Gate check: tokens present ✓, framework Context7-verified ✓, every token checkable ✓, adapters rendered ✓.*
*Next: run `/midas-sprint-planning` (Phase 6).*
