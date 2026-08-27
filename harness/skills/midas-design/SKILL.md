---
name: midas-design
user-surface: primary
description: Product-authentic UI redesign — audit, three art directions, human pick, spec, then optional one-slice implement. Use when the user asks to improve, redesign, or refactor visuals/landing/UI; never jump straight to JSX. Distinct from /define-conventions (Phase 5 freeze) and /midas-verify (proof).
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [playwright, chrome-devtools]
argument-hint: "[surface] [--mode audit|directions|spec|implement] [--slice hero|header|block]"
---

# midas-design — authentic redesign (think before JSX)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Prompt tool:** `AskQuestion`. On Claude Code, fall back to `AskUserQuestion` if AskQuestion is not wired.
> Read **`paths.state`**. No UI / no `{product}/` → report and stop.
> Record shape: `<paths.engine>/templates/design-record.md`. Authenticity CHECKs:
> `<paths.engine>/rules/visual-design.md` § Product authenticity.

Stops interchangeable AI-SaaS landings. **Does not** freeze Phase 5 rules; **does not** advance `stage`.

## Does / Does not

| Does | Does not |
|---|---|
| Audit current UI vs product jobs + direction | Invent taste when direction is empty — ask or mark `assumed (confirm)` |
| Propose **exactly 3** substantially different art directions | Copy one reference wholesale |
| Spec + optional **one** implement slice after human pick | Redesign the whole site in one shot |
| Freeze `{runs}/design/design-NN.md`; amend direction only on human OK | Replace `/define-conventions` or `/midas-verify` |

## When to run

User asks to improve / redesign / refactor design, landing, hero, brand feel, or "make it less generic".
Also when `/midas-verify` or tribunal Design Critic flags generic UI.

**When NOT:** Phase 5 first freeze → `/define-conventions`. Token-only tweak with frozen direction → implement under `/start-sprint`. Proof only → `/midas-verify`.

## Modes (`--mode`, default progressive)

| Mode | Stops after | Writes |
|---|---|---|
| `audit` | UX audit | record (directions empty) |
| `directions` | 3 directions + recommendation | record; **wait for human pick** |
| `spec` | page/hero spec + wireframe | record (requires chosen direction) |
| `implement` | one approved slice in code | record + code (requires spec) |

Default path when user says "redesign X": run through `directions`, **stop for pick**, then on confirm continue `spec` → optional `implement --slice …`.

## Procedure

### 1. Load context (scout)
Read `paths.state`, `{product}/idea.md`, `{product}/design-direction.md`, `{product}/design-system.md` (+ tokens), architecture, and the target surface (routes/components). If direction lacks **Metaphor** or **First viewport**, treat as incomplete — fill proposals marked `assumed (confirm)` before inventing UI.

### 2. UX audit
Against the live or coded surface, list findings: hierarchy, SaaS-template smell, missing product evidence, IA vs primary user job, empty/marketing lies. Severity + evidence. Prefer screenshots at 390 / 768 / 1440 when a server is up.

### 3. Three art directions (orchestrate)
Produce **A / B / C** that a reviewer would not confuse with each other (e.g. editorial vs functional vs experimental-but-usable — adapted to the product, not those labels as costume).

Each direction **must** include: name, metaphor/feel, personality, composition (first viewport), type, colour, imagery, motion, product fit, risks. **No JSX.**

Recommend one. **Ask the human to pick** (`AskUserQuestion` when available). Do not implement before pick unless `--mode implement` and the user already named the direction in the same message.

### 4. Spec (after pick)
Convert the chosen direction into concrete decisions: wireframe (desktop + mobile), hero, section list (one job each), tokens, components, states, responsive notes, authenticity pass criteria. Align with `<paths.engine>/rules/visual-design.md` + `accessibility.md`.

If the pick changes brand intent, **propose** an amendment to `{product}/design-direction.md` (show diff) — write only on explicit OK.

### 5. Implement one slice only (build, optional)
Default slice: `header` + `hero` / first viewport (`--slice`). Desktop + mobile. Reuse tokens; no new generic card grid. Stop and re-audit authenticity before expanding to the rest of the page.

Specialist: installed `ui-designer` / `design-bridge` if present; else `midas-builder`. Doc-fetch third-party UI libs per `context7-usage.md`.

### 6. Freeze
Write **`{runs}/design/design-NN.md`** from the template (NN monotonic under `{runs}/design/`). Required machine line:

```
MIDAS_DESIGN_RESULT: directions=3 chosen=<A|B|C|none> authenticity=pass|fail|n/a slice=<none|shipped>
```

MAY set `last_design: { n, at }` in `paths.state`. **Never** set `gate: passed` or advance `stage`.

## Hard rules (fail closed)

1. **No code** before human-chosen direction (unless user pasted an approved prior `design-NN` / direction and asked only to implement a slice).
2. **No default SaaS stack** (centered hero + gradient + mockup card + three benefits + Lucide row) unless direction justifies it.
3. **Logo-swap test** must be documented; fail → revise concept, do not ship the slice as done.
4. **Do not invent product features** the codebase / idea docs do not support.
5. **Recombine** references; never clone a single site.

## Exit gate

- [ ] Audit evidence on disk or in the record.
- [ ] Exactly three directions when mode ≥ `directions`; human choice recorded (or `none` if stopped early).
- [ ] Spec present when mode ≥ `spec`; implement only one slice when mode = `implement`.
- [ ] `design-NN.md` frozen with `MIDAS_DESIGN_RESULT`.
- [ ] `stage` unchanged.

## Tier & cost

Direction + recommendation → **orchestrate**. Spec/implement writes → **build**. File/screenshot extract → **scout**. Respect `cost_profile`.

## Next

- Direction amended → `/midas-doctor` if adapters must reflect new rules; else continue slices via `/start-sprint` tasks.
- After UI lands → `/midas-verify` (authenticity section) before `/close-sprint`.
