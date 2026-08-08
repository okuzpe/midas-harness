# Design record design-NN — <surface> — <YYYY-MM-DD>

> Frozen by `/midas-design`. Immutable once written; a new run gets `design-(NN+1).md`.
> Does **not** advance `stage` or replace `{product}/design-direction.md` unless the human approved
> an amendment in the same session.

**Scope:** `<page / flow / component set>`
**Mode:** `<audit-only | directions | spec | implement-slice>`
**Tier:** orchestrate (direction) → build (spec/implement)
**Direction file:** `{product}/design-direction.md` (amended: yes/no)

## Product brief (from disk)

- Archetype / users / primary job:
- Differentiators (must remain visible):
- Metaphor / feel (from direction or proposed):

## UX audit (current)

| Finding | Severity | Evidence |
|---|---|---|
| | CRIT/HIGH/MED/LOW | route / screenshot / file:line |

## Art directions (exactly 3, substantially different)

| # | Name | Personality | Composition | Type / colour / imagery | Motion | Fit | Risks |
|---|---|---|---|---|---|---|---|
| A | | | | | | | |
| B | | | | | | | |
| C | | | | | | | |

**Recommendation:** `<A|B|C>` — rationale (3–6 lines). **Human choice:** `<A|B|C|deferred>`.

## Spec (after human picks a direction)

- Wireframe (desktop / mobile) — textual:
- Hero / first viewport:
- Section list (one job each):
- Tokens to add/change (trace to direction):
- States (empty / loading / error / hover / focus):
- Authenticity criteria (logo-swap must fail closed):

## Implement slice (only if mode includes implement)

- Slice shipped: `<header|hero|block-N>` (not whole page on first pass)
- Files touched:
- Deferred:

## Authenticity self-check

| Question | Pass? | Note |
|---|---|---|
| Logo-swap → still generic SaaS? | | Must be **No** to pass |
| Real product visible above the fold? | | |
| Product-specific actions > abstract claims? | | |
| Default SaaS stack avoided or justified? | | |
| Every section has one distinct job? | | |

```
MIDAS_DESIGN_RESULT: directions=3 chosen=<A|B|C|none> authenticity=pass|fail|n/a slice=<none|shipped>
```
