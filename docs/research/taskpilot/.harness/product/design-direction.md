# Design direction — TaskPilot

> Phase 5 artifact, captured **before** the design system. It is the aesthetic intent (the human's taste)
> that anchors `product/design-system.md` and every UI component, so the product looks intentional — not
> generic. `/midas-verify`, `/midas-design`, and the Phase-8 audit check the built UI against this.

## Brand personality

- **Adjectives:** calm, precise, fast, content-first, unobtrusive.
- **Vibe:** a pro tool that respects your attention — the tasks are the hero; the chrome disappears.

## How it should feel (metaphor)

- **Metaphor:** clearing a desk before deep work — quiet surfaces, one thing in focus.
- **In one sentence:** the interface should feel like a focused task list that stays out of the way.

## First viewport — product evidence

- **Must show:** the actual task list (or empty state that invites the first task), not a marketing mock.
- **Primary action:** add / complete the next task.
- **Must not lead with:** generic SaaS hero stack (centered headline + gradient + floating dashboard mockup
  + three benefit icons).

## References to emulate (2–3 real products)

| Product | What to borrow | Source |
|---|---|---|
| **Linear** | dense-but-calm layout, restrained near-monochrome palette + one accent, fast keyboard-first micro-interactions | human |
| **Things 3** | generous whitespace, quiet typographic hierarchy, a feeling of focus and lightness | human |
| **Height / Notion** | flat, content-first surfaces; subtle borders over heavy shadows | human |

## Mood / keywords

- Near-monochrome + a single restrained accent · tight 4px grid · quiet borders, not big shadows ·
  subtle motion (no bounce) · keyboard-first · typography does the work, colour used only for status.

## Anti-references (what to avoid)

- Not the default SaaS landing: centered hero, purple/blue gradient, floating dashboard mockup,
  three equal benefit cards, Lucide decoration row, final CTA band.
- **Not** generic Bootstrap/Tailwind default. No stock gradients. No drop-shadow everywhere. No
  rounded-everything. No decorative colour — colour means *status*, never ornament. No emoji-as-icons.

## Accessibility floor

- WCAG 2.1 AA contrast on all text/controls; visible focus-visible ring; respects `prefers-reduced-motion`.

---

*This direction anchors `product/design-system.md` (the `--ds-*` tokens trace back here: the restrained
palette, the 4px grid, the status-only colour). `/midas-verify` checks the rendered UI is on-direction —
distinctive and calm, not generic. Logo-swap test: `visual-design.md` § Product authenticity.*
