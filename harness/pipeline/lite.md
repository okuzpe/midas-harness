# Midas Lite track — 3-phase fast path

**Track:** `lite` in `paths.state` (alternative to `full`). Not a new `stage` enum — the 9-row
stage table stays; Lite is a status/init overlay.

Use Lite for prototypes, hackathons, and small MVPs where the full 0–8 market/business/tribunal
ceremony is overhead. Full track remains the default for production products.

## Lite phases (mapped to full phases)

| Lite step | Full phases merged | Skill / command |
|-----------|-------------------|-----------------|
| **Idea + Plan** | 0–6 (idea, contextualize, market*, architecture, rules, sprint plan) | `/midas-init` (lite) then one pass: capture idea, thin architecture, lean rules, **thin `{product}/business-plan.md` stub**, then `/plan-sprints` |
| **Execute** | 7 | `/start-sprint` |
| **Audit** | 8 | `/close-sprint` |

\* `{product}/market.md` is **optional** on Lite. Skip `market_research` with a recorded assumption
in `paths.state`. **Do not skip `{product}/business-plan.md`** — write a thin stub (MVP + metrics +
GO-assumed, sourced from the idea) so `/plan-sprints`, `/start-sprint`, and `/close-sprint` still
have a business case to read. Tribunal is optional, not default.

## Entry

During `/midas-init`, when the user selects `track: lite` (Phase D Ask):

1. Set `track: lite` in `paths.state`.
2. Idea+Plan writes: `{product}/idea.md`, thin `{product}/architecture.md`, lean
   `<paths.rules>/` (or engine-base only), and thin `{product}/business-plan.md`. Do **not** require
   `{product}/market.md`.
3. Record skipped gates with assumptions (`market_research`, and any other phase not produced).
   `business_case` is **not** skipped if the stub exists — list the stub path in
   `phases.business_case.artifacts`.
4. After that pass, set `stage: sprint_planning` (`entry_stage: sprint_planning` when E0/E1 lite).
5. `/midas-status` and `/midas-recall` print `Track: lite` and **never** recommend `/market-research`
   or `/business-plan` as Next (testable SoT: `resolveStatusNext` in
   `<paths.scripts>/stage-command-table.mjs`). While `stage` is still `idea_intake` …
   `architecture_rules`, Next is finish Idea+Plan (`/midas-init` if `setup_complete` is not true) or
   `/plan-sprints` once the stubs exist. At `sprint_planning` / `sprint_execution` / `shipped`, use
   the normal stage-table row.

## Leftover front stages (must not recover via market)

If `track: lite` but `stage` is still a front-loaded row (`idea_intake` … `architecture_rules`):

- **Init Exit** must not use the E0/E1 maturity-table Next (`/idea-intake` / `/contextualize`).
- `/idea-intake`, `/contextualize`, `/market-research`, and `/business-plan` must **not** send the
  user to `/market-research` or `/contextualize`. Point at `/midas-status` or remaining stubs then
  `/plan-sprints`.
- `/choose-architecture` treats `{product}/market.md` as optional. `/plan-sprints` treats lean rules
  or engine-base as frozen; `{product}/design-system.md` is optional (do not ping-pong to
  `/define-conventions` solely for a missing design system).

## Exit

Same as full track: final `/close-sprint` may set `stage: shipped` when MVP metrics are met.
Phase 8 is **not** skipped.

## When not to use Lite

- Regulated domains, multi-team products, or repos needing adversarial market validation.
- Brownfield E3 repos with existing CI/rules — use full track or `/midas-adopt` instead.
