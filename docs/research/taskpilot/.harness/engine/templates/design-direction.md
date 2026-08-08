<!-- Phase 5 artifact, captured by /define-conventions BEFORE the design system. This is the aesthetic
     INTENT — a human input (your taste), not something the AI invents. It exists to stop generic,
     "Tailwind-default" / interchangeable SaaS UI: a concrete reference + product metaphor is the
     single biggest lever on design quality. The design system (tokens) and every UI component are
     built TO this direction. Placeholder: {{PROJECT_NAME}}.
     Mid-project redesigns: run /midas-design (do not invent a new direction silently in JSX). -->

# Design direction — {{PROJECT_NAME}}

## Brand personality

<!-- TODO: 3–5 adjectives + one sentence on the vibe. e.g. "calm, precise, fast, confident — feels like a
     pro tool that respects your attention." Be specific; "modern and clean" is not a direction. -->

- **Adjectives:** …
- **Vibe:** …

## How it should feel (metaphor)

<!-- TODO: one concrete product metaphor — not a trend label. Examples: "opening a door onto a
     neighbourhood", "standing at a bodega counter during a rush", "a trading desk at 9:01".
     Every major visual decision should serve this feeling. -->

- **Metaphor:** …
- **In one sentence:** the interface should feel like …

## First viewport — product evidence

<!-- TODO: what of the *real product* must be visible above the fold (workflow demo, domain imagery,
     live data shape, primary search/action). Ban: headline + two buttons + stock dashboard mockup
     unless you explicitly justify it here. -->

- **Must show:** …
- **Primary action:** …
- **Must not lead with:** generic SaaS hero stack (centered headline + gradient + floating mockup card
  + three benefit icons) unless justified below.

## References to emulate (2–3 real products)

<!-- TODO: name real, well-designed products and WHAT to borrow from each (density, motion, type, colour
     restraint, spacing). Extract principles — never copy a whole page. -->

> **Source** — mark each row `human` (your taste) or `assumed` (the agent proposed it because no
> reference was given — **confirm or replace before the rules freeze**). At least 2 rows; never left
> blank or "modern & clean". A *concrete* anchor is required; *who* supplies it is not.

| Product | What to borrow | Source |
|---|---|---|
| e.g. Linear | dense-but-calm layout, restrained palette, fast micro-interactions | human |
| e.g. Stripe | typographic hierarchy, generous spacing, trustworthy tone | human |
| … | … | human / assumed |

## Mood / keywords

<!-- TODO: 4–8 keywords that guide colour, type, and motion choices. e.g. monochrome + one accent,
     tight grid, no gradients, subtle motion. -->

- …

<!-- TODO (layout density + responsive intent): gaps, container width, and what stacks / goes full-width on
     mobile — e.g. "8px gaps desktop / 12px mobile; forms max-width ~400px desktop, full-width under 640px;
     cards reflow to 1 column under 640px". This anchors composition so nothing overflows. -->

## Anti-references (what to avoid)

<!-- TODO: name what this must NOT look like — the fastest way to dodge generic slop.
     Always include the interchangeable AI-SaaS landing if it does not fit this product. -->

- Not the default SaaS landing: centered hero, purple/blue gradient, floating dashboard mockup,
  three equal benefit cards, Lucide decoration row, final CTA band — unless this product truly is
  that archetype and you say why.
- Not generic Bootstrap/Tailwind default; no stock-photo skyscrapers; no emoji-as-icons;
  no rounded-everything / glow / blur-orb filler.
- …

## Accessibility floor

<!-- Non-negotiable regardless of style. -->

- WCAG 2.1 AA contrast on all text/controls; visible focus rings; respects reduced-motion.

---

*This direction anchors `{product}/design-system.md` (tokens) and every UI component. The Phase-8 audit,
`/midas-verify` (product-authenticity section), and `/midas-design` check that built UI matches it —
distinctive and on-direction, not generic. Logo-swap test: see `<paths.engine>/rules/visual-design.md`.*
