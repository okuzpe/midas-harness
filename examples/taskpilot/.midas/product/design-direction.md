# Design direction — TaskPilot

> Phase 5 artifact, captured **before** the design system. It is the aesthetic intent (the human's taste)
> that anchors `product/design-system.md` and every UI component, so the product looks intentional — not
> generic. `/midas-verify` and the Phase-8 audit check the built UI against this.

## Brand personality

- **Adjectives:** calm, precise, fast, content-first, unobtrusive.
- **Vibe:** a pro tool that respects your attention — the tasks are the hero; the chrome disappears.

## References to emulate (2–3 real products)

| Product | What to borrow |
|---|---|
| **Linear** | dense-but-calm layout, restrained near-monochrome palette + one accent, fast keyboard-first micro-interactions |
| **Things 3** | generous whitespace, quiet typographic hierarchy, a feeling of focus and lightness |
| **Height / Notion** | flat, content-first surfaces; subtle borders over heavy shadows |

## Mood / keywords

- Near-monochrome + a single restrained accent · tight 4px grid · quiet borders, not big shadows ·
  subtle motion (no bounce) · keyboard-first · typography does the work (Inter), colour used only for status.

## Anti-references (what to avoid)

- **Not** generic Bootstrap/Tailwind default. No stock gradients. No drop-shadow everywhere. No
  rounded-everything. No decorative colour — colour means *status*, never ornament. No emoji-as-icons.

## Accessibility floor

- WCAG 2.1 AA contrast on all text/controls; visible focus-visible ring; respects `prefers-reduced-motion`.

---

*This direction anchors `product/design-system.md` (the `--ds-*` tokens trace back here: the restrained
palette, the 4px grid, the status-only colour). `/midas-verify` checks the rendered UI is on-direction —
distinctive and calm, not generic.*
