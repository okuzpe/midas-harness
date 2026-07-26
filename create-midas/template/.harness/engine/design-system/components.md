# Design System — Component Conventions

> Framework-agnostic. Works for React, Vue, Svelte, or plain HTML/CSS.
> Referenced by `/define-conventions` (phase 5) and `/midas-tribunal`'s design lens.
> Token names below are the CSS custom properties defined in `tokens.css` (`var(--ds-*)`) and
> their JSON counterparts in `tokens.json`.

---

## Cross-cutting rules

1. **Always reference tokens, never hardcode.** Every color, size, spacing, radius, shadow, and
   transition value must resolve to a `var(--ds-*)` custom property. Raw hex, px literals, or
   arbitrary `ms` durations in component CSS are a conformance violation.

2. **`focus-visible` everywhere.** Every interactive element must expose a visible focus ring on
   keyboard navigation using `outline: 2px solid var(--ds-border-focus)` + `outline-offset: 2px` +
   `box-shadow: var(--ds-shadow-focus)`. Never suppress `outline` without an equivalent replacement.
   Mouse-only users are exempt via `:focus-visible` (already in the base reset).

3. **Dark mode via `[data-theme]`.** Components must not hardcode light-mode colors. The semantic
   tokens (`--ds-bg-*`, `--ds-surface-*`, `--ds-text-*`, etc.) flip automatically when
   `[data-theme="dark"]` is set on any ancestor; no per-component dark-mode overrides are needed
   unless a component introduces a new raw value.

4. **Respect `prefers-reduced-motion`.** Transitions and animations are suppressed globally by the
   base reset. Components must not re-introduce `transition` or `animation` via `!important` or
   inline styles that bypass the media-query guard.

5. **AA contrast floor.** All text/icon on any surface must meet WCAG 2.1 §1.4.3 AA (4.5:1 for
   normal text, 3:1 for large/bold). The semantic token pairings in `tokens.css` are pre-verified;
   do not swap text and surface tokens in ways not listed here.

6. **8 px grid.** Padding, margin, gap, and min/max sizes must use `--ds-space-*` tokens.
   Half-grid steps (`--ds-space-05`, `--ds-space-1`, `--ds-space-15`) are allowed for fine-tuning.

7. **Z-index from tokens.** Use `--ds-z-dropdown`, `--ds-z-modal`, `--ds-z-toast`,
   `--ds-z-tooltip` — never arbitrary integers.

8. **Containment & sizing — fit the parent.** Controls (Button/Input/Select) take their height from one
   shared `--ds-size-control-*` token so adjacent controls **align** — never a per-component hardcoded
   `height`. Shrinkable flex/grid children set `min-width: 0` (or the `.ds-min-0` utility), and grid tracks
   holding wide content use `minmax(0, 1fr)` (not the implicit `minmax(auto, 1fr)`). Long/unknown-length
   text **wraps** (`overflow-wrap: break-word`) or **truncates** (`.ds-truncate`). Pages, forms, and
   long-form text cap their width with a container/measure token (`--ds-width-prose` / `--ds-width-form`),
   never 100% full-bleed. Media defaults to `max-width: 100%` (base reset). Net result: **no element
   overflows its parent and there is no horizontal scrollbar at narrow widths.**

---

## Components

### Button

**Purpose.** Trigger an action. Variants: primary (filled), secondary (outlined), ghost (text-only),
danger (destructive).

**Tokens consumed.**

| Property | Token |
|---|---|
| Background (primary) | `--ds-action-bg` / `--ds-action-bg-hover` / `--ds-action-bg-active` / `--ds-action-bg-disabled` |
| Text (primary) | `--ds-action-text` / `--ds-action-text-disabled` |
| Background (secondary/ghost) | `transparent` → `--ds-bg-subtle` on hover |
| Border (secondary) | `--ds-border-default` → `--ds-border-strong` on hover |
| Text (secondary/ghost) | `--ds-text-primary` |
| Background (danger) | `--ds-danger-bg` → `--ds-danger-text` as text |
| Padding | `--ds-space-2` (vertical) × `--ds-space-4` (horizontal) |
| Height | `--ds-size-control-md` (shared control height; never hardcode — aligns with Input) |
| Border radius | `--ds-radius-md` |
| Font size | `--ds-text-sm` |
| Font weight | `--ds-font-weight-semibold` |
| Transition | `--ds-transition-fast` on background/border |
| Focus ring | `--ds-border-focus` + `--ds-shadow-focus` |

**States.** `default` | `hover` | `focus-visible` | `active` | `disabled` (pointer-events none,
`--ds-action-bg-disabled` + `--ds-action-text-disabled`, `aria-disabled="true"`).

**Accessibility.** `role="button"` (implicit on `<button>`). `Enter` and `Space` activate.
`aria-disabled` preferred over `disabled` so the element remains focusable. Min touch target 44×44 px.

---

### Input

**Purpose.** Single-line text entry.

**Tokens consumed.**

| Property | Token |
|---|---|
| Background | `--ds-surface-default` |
| Border | `1px solid --ds-border-default` → `--ds-border-strong` on hover |
| Border (focus) | `--ds-border-focus` |
| Text | `--ds-text-primary` |
| Placeholder | `--ds-text-disabled` |
| Padding | `--ds-space-2` × `--ds-space-3` |
| Height | `--ds-size-control-md` (matches Button height for aligned form rows; max-width from a container token) |
| Border radius | `--ds-radius-md` |
| Font size | `--ds-text-md` |
| Shadow (focus) | `--ds-shadow-focus` |
| Error border | `--ds-danger-icon` |
| Disabled background | `--ds-bg-muted` |

**States.** `default` | `hover` | `focus-visible` | `disabled` | `error` (red border +
`aria-invalid="true"` + `aria-describedby` pointing to the error message).

**Accessibility.** Always paired with a visible `<label>` (or `aria-label`). `role="textbox"`.
Error state uses `aria-invalid="true"` and `aria-describedby` linking to the inline error text.

---

### Select

**Purpose.** Choose one option from a list. Native `<select>` for simplicity; custom popover only
when richer interaction is required.

**Tokens consumed.** Same surface/border/text/focus tokens as Input (control height `--ds-size-control-md`,
like Button/Input). Custom chevron icon uses
`--ds-text-secondary`. Dropdown panel: `--ds-surface-raised`, `--ds-shadow-md`,
`--ds-z-dropdown`. Option hover: `--ds-bg-subtle`.

**States.** `default` | `hover` | `focus-visible` | `disabled` | `error`.

**Accessibility.** `role="combobox"` for custom; `<select>` for native. Keyboard: `Arrow` keys
navigate options, `Enter`/`Space` select, `Escape` closes. `aria-expanded`, `aria-haspopup="listbox"`.

---

### Checkbox / Radio

**Purpose.** Binary toggle (checkbox) or exclusive single-selection in a group (radio).

**Tokens consumed.**

| Property | Token |
|---|---|
| Control border | `--ds-border-default` → `--ds-border-strong` on hover |
| Checked background | `--ds-action-bg` |
| Checked icon (tick/dot) | `--ds-action-text` |
| Indeterminate background | `--ds-action-bg` |
| Focus ring | `--ds-border-focus` + `--ds-shadow-focus` |
| Label text | `--ds-text-primary` |
| Disabled text | `--ds-text-disabled` |
| Control size | `--ds-space-4` × `--ds-space-4` |
| Border radius (checkbox) | `--ds-radius-sm` |
| Border radius (radio) | `--ds-radius-full` |
| Gap (control↔label) | `--ds-space-2` |

**States.** `unchecked` | `checked` | `indeterminate` (checkbox only) | `focus-visible` |
`disabled` | `error` (border `--ds-danger-icon`).

**Accessibility.** `role="checkbox"` / `role="radio"`. Group wrapped in `<fieldset>` +
`<legend>`. `Space` toggles. `aria-checked`, `aria-required`, `aria-disabled`.

---

### Card

**Purpose.** Group related content in a contained surface.

**Tokens consumed.**

| Property | Token |
|---|---|
| Background | `--ds-surface-default` |
| Border | `1px solid --ds-border-default` |
| Border radius | `--ds-radius-lg` |
| Padding | `--ds-space-6` |
| Shadow | `--ds-shadow-sm` (default) → `--ds-shadow-md` (elevated) |
| Transition (interactive) | `--ds-transition-default` on box-shadow |

**States.** `default` | `hover` (interactive cards only — cursor pointer, `--ds-shadow-md`) |
`focus-visible` (interactive cards only).

**Accessibility.** Static card: no role. Interactive card: `role="button"` or `<a>`. Provide an
accessible name via heading or `aria-label`.

---

### Dialog / Modal

**Purpose.** Interrupt flow for a critical action or focused sub-task. Blocks interaction with
the page behind a scrim.

**Tokens consumed.**

| Property | Token |
|---|---|
| Panel background | `--ds-surface-raised` |
| Panel border | `1px solid --ds-border-default` |
| Panel radius | `--ds-radius-xl` |
| Panel shadow | `--ds-shadow-2xl` |
| Panel padding | `--ds-space-6` |
| Scrim background | `--ds-bg-overlay` at 60% opacity |
| Z-index (scrim) | `--ds-z-overlay` |
| Z-index (panel) | `--ds-z-modal` |
| Title font size | `--ds-text-lg` |
| Title font weight | `--ds-font-weight-semibold` |
| Transition (enter/exit) | `--ds-transition-medium` — suppress under reduced-motion |

**States.** `open` | `closed` | `loading` (action spinner inside footer).

**Accessibility.** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (title),
`aria-describedby` (body). Focus is trapped inside while open; restored to trigger on close.
`Escape` closes. Scroll locked on `<body>`.

---

### Toast

**Purpose.** Transient, non-blocking feedback (success, warning, danger, info). Auto-dismisses.

**Tokens consumed.**

| Property | Token |
|---|---|
| Container position | `--ds-z-toast` (fixed, bottom-right) |
| Background | Intent token: `--ds-success-bg` / `--ds-warning-bg` / `--ds-danger-bg` / `--ds-info-bg` |
| Border-left accent | `--ds-success-icon` / `--ds-warning-icon` / `--ds-danger-icon` / `--ds-info-icon` |
| Text | `--ds-success-text` / `--ds-warning-text` / `--ds-danger-text` / `--ds-info-text` |
| Border radius | `--ds-radius-lg` |
| Shadow | `--ds-shadow-lg` |
| Padding | `--ds-space-4` × `--ds-space-5` |
| Transition (slide-in) | `--ds-transition-medium` — omit under reduced-motion |

**States.** `entering` | `visible` | `exiting` | `dismissed`.

**Accessibility.** `role="status"` (success/info) or `role="alert"` (warning/danger) on the
live region container. Dismiss button: `aria-label="Dismiss"`. Auto-dismiss pause on hover and
on focus within.

---

### Tabs

**Purpose.** Switch between sibling views within the same context.

**Tokens consumed.**

| Property | Token |
|---|---|
| Tab list background | `--ds-bg-subtle` |
| Active tab background | `--ds-surface-default` |
| Active tab shadow | `--ds-shadow-xs` |
| Active tab text | `--ds-text-primary`, `--ds-font-weight-semibold` |
| Inactive tab text | `--ds-text-secondary` |
| Active indicator | `2px solid --ds-action-bg` (bottom border) |
| Border radius (tab) | `--ds-radius-md` |
| Padding (tab) | `--ds-space-2` × `--ds-space-4` |
| Transition | `--ds-transition-fast` on color/border |

**States.** `default` | `hover` (`--ds-text-primary`) | `active/selected` | `focus-visible` |
`disabled`.

**Accessibility.** `role="tablist"` on the list, `role="tab"` on each item, `role="tabpanel"`
on each panel. `aria-selected`, `aria-controls`, `aria-labelledby`. Keyboard: `Left`/`Right`
arrow moves focus; `Home`/`End` jump to first/last; `Enter`/`Space` activates.

---

### Table

**Purpose.** Display structured, comparable data in rows and columns.

**Tokens consumed.**

| Property | Token |
|---|---|
| Header background | `--ds-bg-subtle` |
| Header text | `--ds-text-primary`, `--ds-font-weight-semibold`, `--ds-text-sm` |
| Row border | `1px solid --ds-border-default` |
| Row hover | `--ds-bg-subtle` |
| Cell padding | `--ds-space-3` × `--ds-space-4` |
| Cell text | `--ds-text-primary`, `--ds-text-md` |
| Sort icon | `--ds-text-secondary` → `--ds-action-bg` when active |
| Transition (row hover) | `--ds-transition-fast` |

**States.** `default` | `row-hover` | `row-selected` (`--ds-info-bg` background) |
`column-sorted` | `loading` (skeleton rows with `--ds-bg-muted`).

**Accessibility.** `<table>`, `<thead>`, `<tbody>`, `<th scope="col/row">`. Sortable columns:
`aria-sort="ascending|descending|none"` on `<th>`. `caption` or `aria-label` describes the
table. For large datasets, use `role="grid"` for keyboard navigation of cells.

---

### Badge

**Purpose.** Compact label for status, count, or category. Not interactive.

**Tokens consumed.**

| Property | Token |
|---|---|
| Background | Intent token `--ds-*-bg` or `--ds-bg-muted` (neutral) |
| Text | Intent token `--ds-*-text` |
| Border | `1px solid` intent token `--ds-*-border` |
| Font size | `--ds-text-xs` |
| Font weight | `--ds-font-weight-medium` |
| Padding | `--ds-space-05` × `--ds-space-2` |
| Border radius | `--ds-radius-full` (pill) or `--ds-radius-sm` (square) |

**Accessibility.** Purely visual; if the status is meaningful, also convey it in text visible to
screen readers (visually hidden span or `aria-label` on the parent).

---

### Tooltip

**Purpose.** Reveal supplemental label or hint on hover/focus. Never the sole source of critical
information (content may be inaccessible on touch).

**Tokens consumed.**

| Property | Token |
|---|---|
| Background | `--ds-color-neutral-900` |
| Text | `--ds-text-inverse` |
| Font size | `--ds-text-xs` |
| Padding | `--ds-space-1` × `--ds-space-2` |
| Border radius | `--ds-radius-sm` |
| Shadow | `--ds-shadow-md` |
| Z-index | `--ds-z-tooltip` |
| Transition (show/hide) | `--ds-transition-fast` — suppress under reduced-motion |
| Max width | `--ds-space-48` (192 px) |

**States.** `hidden` | `visible` (pointer or focus enters trigger) | `dismissed` (Escape).

**Accessibility.** `role="tooltip"` on the panel. Trigger has `aria-describedby` pointing to
tooltip id. Tooltip shows on `:hover` AND `:focus-visible`. `Escape` hides it.

---

### Form Field

**Purpose.** Compositional wrapper for label + control + hint + error message. Ensures consistent
layout and accessible pairing.

**Tokens consumed.**

| Property | Token |
|---|---|
| Label text | `--ds-text-primary`, `--ds-text-sm`, `--ds-font-weight-medium` |
| Required marker | `--ds-danger-icon` |
| Hint text | `--ds-text-secondary`, `--ds-text-sm` |
| Error text | `--ds-danger-text`, `--ds-text-sm` |
| Error icon | `--ds-danger-icon` |
| Gap (label↔control) | `--ds-space-1` |
| Gap (control↔hint/error) | `--ds-space-1` |

**States.** Inherits from the nested control. Error state sets `aria-invalid="true"` on the
control and renders an error message with id linked via `aria-describedby`.

**Accessibility.** `<label for="...">` (or `aria-labelledby`) always present. Hint and error
elements have unique ids referenced by `aria-describedby` (space-separated if both). Required
fields: `aria-required="true"` + visible indicator (asterisk with a screen-reader text
"required" in a visually-hidden span).
