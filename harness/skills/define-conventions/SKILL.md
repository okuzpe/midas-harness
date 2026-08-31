---
name: define-conventions
user-surface: primary
description: Phase 5 keystone — freeze architecture into checkable rules, design system, playbooks, and enforcement tooling; re-render adapters. Use once after tech_architecture passes, before sprint work.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
---

# define-conventions (Phase 5 — architecture-as-rules + design system)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Prompt tool:** `AskQuestion`. On Claude Code, fall back to `AskUserQuestion` if AskQuestion is not wired.
> Read **`paths.state`**. Precondition: `stage: tech_architecture` passed (or `architecture_rules` resuming). Missing `{product}/architecture.md` or ADRs → stop.

## Does / Does not

| Does | Does not |
|---|---|
| Encode arch into CHECKABLE `<paths.rules>/*` + design system | Self-advance `stage` (orchestrator audits gate) |
| Scaffold enforcement + re-render adapters | Hand-edit generated `.cursor/rules/*`, `.windsurf/rules/*` |
| Freeze gate verdict to `{runs}/audits/gate-05.md` on pass (seed: `<paths.engine>/templates/gate-record.md`) | Block on `/midas-tribunal` (optional pre-rules-freeze checkpoint) |

**Keystone:** vague rules weaken every Phase-8 audit. Orchestrate decides; **build** writes files. Full pipeline steps + artifact table: **`<paths.engine>/pipeline/5-architecture-rules.md`**.

## When NOT
- Architecture / ADRs missing → `/choose-architecture`.
- Rules already frozen and you need a sprint plan → `/plan-sprints` (amend overlays via capture/ADR, not a silent re-freeze).
- Adapter drift only → `/midas-doctor` (does not replace this keystone).

**Anti-rationalization:** “we’ll add CHECKs later” is a **fail** — every new rule ships with a CHECK line in this phase.

**Inputs:** `paths.state`, `{product}/architecture.md`, `{product}/adr/ADR-*.md`, `<paths.engine>/conventions.md`, `<paths.engine>/rules/`, `<paths.rules>/`, token files.

## Procedure (summary — detail in pipeline doc)

### 1. CHECKABLE rules → `<paths.rules>/`
- **`folder-structure.md`** (mandatory): canonical tree + import/boundary rules. Feature/module
  layouts encode **Scope Rule** (1 consumer = local, 2+ = shared) and screaming folder names
  (user jobs, not technical-layer top-level). Layered/hexagonal ADRs win on conflict — cite the
  ADR. Seed: `<paths.engine>/templates/folder-structure.md`.
- **Stack rules** — Context7-verified at pinned version per `<paths.engine>/rules/context7-usage.md`; shape from `<paths.engine>/templates/stack-rule.md`. Cover canonical idiom + lint set (not naming-only). Each carries `docs: <lib>@<version> via <tool>`. Each has a **CHECK** line. Name lint plugins that mechanize them.
- **`{product}/conventions.md`** — prose overrides only; never restate base.

### 2. Design direction → design system
**Direction first** (`{product}/design-direction.md` from `<paths.engine>/templates/design-direction.md` — keep those headings). Brand, **metaphor / how it should feel**, **first-viewport product evidence**, **2–3 real references**, anti-references (include the default SaaS landing stack unless this product is that archetype). **Ask human via `AskQuestion`** — do not invent taste. If human defers → propose ≥2 domain-appropriate references marked **`assumed (confirm)`**; concrete anchor mandatory. Mid-project redesigns later use `/midas-design` — do not skip direction here.

**Then `{product}/design-system.md`** from `<paths.engine>/templates/design-system.md` (keep those headings). References `<paths.engine>/design-system/tokens.{json,css}`; token choices trace to direction. UI framework docs-verified. All UI uses tokens — never hardcoded values. Accessibility floor: `<paths.engine>/rules/accessibility.md` (starter `tokens.css` ships AA-verified pairs). Populate stale/missing token files from direction + arch.

### 3. Playbooks (0–4)
`{product}/playbooks/<verb-noun>.md` from `<paths.engine>/templates/playbook.md` — recurring tasks with a non-obvious right way. Each: use-when, **Trigger** (diff predicate), steps, rules/tokens by reference, Context7 fetch, done-when. **Anti-bloat:** ≥1 step no single rule states; 1:1-to-rules → cut. Not slash-commands.

### 4. Precedence (single taxonomy)
```
project rule overlay (<paths.rules>/)  >  stack-specific rules  >  {product}/conventions.md  >  {product}/design-system.md  >  base conventions
```

### 5. Enforcement scaffolding (recommend-don't-wall)
Generate linter+formatter, git hooks + lint-staged, commit-msg lint, CI job — Context7-verify configs. Show configs → `AskQuestion` install yes/no. Record in **`paths.state` → `enforcement:`** per `<paths.engine>/rules/enforcement-state.md`. `node <paths.scripts>/doctor.mjs` warns on missing configs.

### 6. Re-render adapters
`node <paths.scripts>/render-adapters.mjs` or `/midas-doctor`. **Never** hand-edit generated adapters. Confirm no drift.

### 7. Record state
Update `paths.state`: list new rules + design-system + playbooks + tooling in `phases.architecture_rules.artifacts`; `stage_status: gate_pending`; record rendered `tools`. Do not self-advance.

## Exit gate (orchestrate audits)

Full checklist: **`<paths.engine>/pipeline/5-architecture-rules.md` § Exit gate checklist**. Local required:

- [ ] `folder-structure.md` present with Scope Rule or ADR exception; every arch decision has a CHECKABLE rule file.
- [ ] Stack rules Context7-verified; each has `docs: <lib>@<version> via <tool>` + a **CHECK** line.
- [ ] Enforcement scaffolded; decision recorded in `paths.state → enforcement:`.
- [ ] Design direction + design system present; 0–4 playbooks (anti-bloat honored).
- [ ] Adapters rendered (`node <paths.scripts>/doctor.mjs` / `/midas-doctor` reports no drift).
- [ ] Gate verdict written to `{runs}/audits/gate-05.md`.

On pass: freeze `{runs}/audits/gate-05.md` from `<paths.engine>/templates/gate-record.md`, set gate passed; next → `/plan-sprints`. On fail: report uncheckable rule or unrendered adapter.

## Tier & delegation
Rule set + playbook selection → **orchestrate**. File writes → **build**. Context7 fetches → **scout**. UI: design specialist if installed; else `midas-builder`.
