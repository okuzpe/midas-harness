# TaskPilot — Design System

> Phase 5 artifact. Defines visual language and references the design tokens.

---

## Principles

1. **Calm, not cluttered.** White space is the primary design element. Colour is used sparingly for
   status and emphasis, never decoration.
2. **Content-first.** Task titles are the most important thing on the board; chrome is minimal.
3. **Accessible by default.** All colour combinations meet WCAG 2.1 AA contrast ratios. Interactive
   elements have visible focus rings.

---

## Token sources

Design tokens are defined in two canonical files — **do not hardcode any value that has a token**:

| File | Purpose |
|---|---|
| `harness/design-system/tokens.json` | Machine-readable token definitions (used by build tools / Storybook) |
| `harness/design-system/tokens.css` | CSS custom properties rendered from `tokens.json` by `/keel-doctor` |

In code, always reference the CSS variable:

```css
/* correct */
background-color: var(--color-surface-default);

/* wrong — hardcoded hex */
background-color: #ffffff;
```

In Tailwind, extend the config to alias tokens:

```js
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      surface: 'var(--color-surface-default)',
      'surface-raised': 'var(--color-surface-raised)',
      primary: 'var(--color-primary)',
      destructive: 'var(--color-destructive)',
    },
    borderRadius: {
      card: 'var(--radius-card)',
    },
  },
}
```

---

## Colour palette (tokens)

| Token | Light value | Dark value | Usage |
|---|---|---|---|
| `--color-surface-default` | `#FFFFFF` | `#0F1117` | Page/panel background |
| `--color-surface-raised` | `#F5F5F5` | `#1A1D27` | Cards, dropdowns |
| `--color-border` | `#E2E2E2` | `#2A2D3A` | Card borders, dividers |
| `--color-text-primary` | `#111111` | `#F0F0F0` | Body text, task titles |
| `--color-text-secondary` | `#6B7280` | `#9CA3AF` | Metadata, timestamps |
| `--color-primary` | `#3B6EF4` | `#5B8EFF` | Primary action buttons, links |
| `--color-primary-hover` | `#2A5DE3` | `#7AAEFF` | Button hover state |
| `--color-destructive` | `#DC2626` | `#EF4444` | Delete actions, error states |
| `--color-status-todo` | `#9CA3AF` | `#6B7280` | Status badge: todo |
| `--color-status-in-progress` | `#F59E0B` | `#FBBF24` | Status badge: in-progress |
| `--color-status-done` | `#22C55E` | `#4ADE80` | Status badge: done |

---

## Typography

| Token | Value | Usage |
|---|---|---|
| `--font-sans` | `Inter, ui-sans-serif, system-ui` | Body and UI text |
| `--font-mono` | `JetBrains Mono, ui-monospace` | Code snippets (if any) |
| `--text-xs` | `0.75rem / 1rem` | Timestamps, labels |
| `--text-sm` | `0.875rem / 1.25rem` | Task metadata, secondary |
| `--text-base` | `1rem / 1.5rem` | Body, comments |
| `--text-lg` | `1.125rem / 1.75rem` | Task titles |
| `--text-xl` | `1.25rem / 1.75rem` | Page headings |

---

## Spacing

Uses a 4 px base grid. Tokens: `--space-1` (4 px) through `--space-16` (64 px).

---

## Border radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Badges, tags |
| `--radius-card` | `8px` | Task cards |
| `--radius-modal` | `12px` | Modals, drawers |

---

## Component conventions

### Task card

- Background: `--color-surface-raised`
- Border: `1px solid var(--color-border)`
- Border radius: `--radius-card`
- Padding: `--space-4` (16 px)
- Task title: `--text-lg`, `--color-text-primary`, font-weight 500
- Metadata row (assignee, date): `--text-xs`, `--color-text-secondary`
- Status badge: pill shape, `--radius-sm`, coloured background per status token

### Kanban column

- Column header: `--text-sm`, uppercase, `--color-text-secondary`, letter-spacing 0.05em
- Column count badge: inline pill, `--color-surface-raised`, `--color-text-secondary`

### Buttons

- Primary: `--color-primary` background, white text, `--radius-sm`, height 36 px
- Destructive: `--color-destructive` background, white text
- Ghost: transparent background, `--color-text-primary` text, hover `--color-surface-raised`

---

## Framework

**shadcn/ui** components are used as the primitive layer. All shadcn components are copied into
`src/components/ui/` and then styled via Tailwind + the token aliases above. Do not override
shadcn components directly; wrap them in a `src/components/` sibling instead.
