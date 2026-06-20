# TaskPilot — Midas worked example

TaskPilot is a **minimal team task manager** used as a complete, fictional greenfield example to
show every Midas phase artifact populated with real, consistent content.

## What this example demonstrates

| Phase | Artifact(s) |
|---|---|
| 0 Idea Intake | `product/idea.md` |
| 1 Contextualize | `product/idea.md` (v2 embedded), `product/open-questions.md` |
| 2 Market Research | `product/market.md` |
| 3 Business Case | `product/business-plan.md` |
| 4 Tech Architecture | `product/architecture.md`, `product/adr/ADR-001-stack.md` |
| 5 Architecture Rules & Design System | `harness/rules/*` (generated stack rules: `folder-structure`, `tenant-isolation`, `session-cookies`), `product/conventions.md` (override layer), `product/design-direction.md`, `product/design-system.md`, `product/playbooks/*`, and the enforcement scaffolding (`product/biome.json`, `lefthook.yml`, `commitlint.config.js`, `.github/workflows/ci.yml` — recorded in `state.yaml`'s `enforcement:` block) |
| 6 Sprint Planning | `product/roadmap.md`, `product/sprints/01-auth-and-task-crud.md` |
| 7 Sprint Execution | `product/src/` (the full Sprint-1 vertical slice: auth, task CRUD, middleware, board stub + tests) |
| 8 Per-sprint Audit | `.harness/audits/audit-01.md` — a **closed** 7 → 8 loop: verdict **PASS** + gate-parseable tally line |
| State | `harness/state.yaml` (sprint `01` `done`; loop pointing at Sprint 2) |

## How to read it

1. Start with `harness/state.yaml` — it records where in the lifecycle TaskPilot sits: sprint `"01"`
   is `done` and the **7 ⇄ 8 loop has turned once**, so `stage` points back at `sprint_execution`
   ready to `/start-sprint` for Sprint 2.
2. Read phase artifacts in order (0 → 8) to trace how a raw idea becomes running code.
3. Look at `.harness/audits/audit-01.md` to see a real **closing** conformance audit: the
   gate-parseable `MIDAS_AUDIT_RESULT` tally line, rule-by-rule pass/fail with evidence, one
   consciously-amended rule (A-01) carried forward, and the next-sprint decision.
4. The code slice under `product/src/` is the **full Sprint-1 vertical slice** — auth
   (register/login/logout + sessions), task CRUD (`/api/tasks` + `/api/tasks/[id]`), middleware, a
   `/board` stub, and the unit + integration tests the audit checks. It is still illustrative, not a
   deployable app (imports reference packages a real project would `npm install`).

## What this is NOT

- Not a production-ready codebase. Files are illustrative; imports reference packages declared in
  `product/package.json` that a real project would `npm install`.
- Not a re-copy of the base rule floor. The example **does** ship the project-specific Phase-5 artifacts —
  the generated stack rules (`harness/rules/folder-structure.md`, `tenant-isolation.md`,
  `session-cookies.md`), the `product/conventions.md` override layer, and the enforcement scaffolding
  (`product/biome.json`, `lefthook.yml`, `commitlint.config.js`, `.github/workflows/ci.yml`, recorded in
  `state.yaml`'s `enforcement:` block) — so the "chose Next.js + Drizzle + Postgres → here are the
  enforced stack rules" path is shown end-to-end. The eight **base** always-on rules
  (`harness/rules/{code-quality,security,naming,testing,git-commits,docs,context7-usage,accessibility}.md`)
  are inherited from the engine install and are not re-copied here; `harness/design-system/tokens.{json,css}`
  remain elided. The three playbooks are genuine — `/api/*` routes, schema changes, and dependency bumps
  each recur across the three sprints, and each carries a `Trigger` so Phase 8 can flag a matching change
  that bypassed it — not a count to hit (zero playbooks is a valid outcome).
- Not a tutorial for TaskPilot-the-product. It is a tutorial for **Midas** and how its artifacts
  connect phase-to-phase.
