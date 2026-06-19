<!-- Phase 5 artifact, captured by /define-conventions BEFORE the design system. This is the aesthetic
     INTENT — a human input (your taste), not something the AI invents. It exists to stop generic,
     "Tailwind-default" UI: a concrete reference is the single biggest lever on design quality.
     The design system (tokens) and every UI component are built TO this direction. Placeholder: {{PROJECT_NAME}}. -->

# Design direction — {{PROJECT_NAME}}

## Brand personality

<!-- TODO: 3–5 adjectives + one sentence on the vibe. e.g. "calm, precise, fast, confident — feels like a
     pro tool that respects your attention." Be specific; "modern and clean" is not a direction. -->

- **Adjectives:** …
- **Vibe:** …

## References to emulate (2–3 real products)

<!-- TODO: name real, well-designed products and WHAT to borrow from each (density, motion, type, colour
     restraint, spacing). This is the anchor that makes the output good instead of generic. -->

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
     e.g. "not generic Bootstrap/Tailwind default, no stock gradients, no emoji-as-icons, no rounded-everything." -->

- …

## Accessibility floor

<!-- Non-negotiable regardless of style. -->

- WCAG 2.1 AA contrast on all text/controls; visible focus rings; respects reduced-motion.

---

*This direction anchors `product/design-system.md` (tokens) and every UI component. The Phase-8 audit and
`/midas-verify` check that the built UI matches it — distinctive and on-direction, not generic.*
