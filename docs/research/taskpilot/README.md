# TaskPilot — Midas worked example

> **Layout:** v2 **`.harness/`** (migrated from legacy hub `.midas/`). Fresh installs from
> `create-midas` use the same layout. CI gates this fixture via
> `node scripts/doctor.mjs --strict --gates-only docs/research/taskpilot`.

TaskPilot is a **minimal team task manager** used as a complete, fictional greenfield example to
show every Midas phase artifact populated with real, consistent content.

## What this example demonstrates

| Phase | Artifact(s) |
|---|---|
| 0 Idea Intake | `.harness/product/idea.md` |
| 1 Contextualize | `.harness/product/idea.md` (v2 embedded), `.harness/product/open-questions.md` |
| 2 Market Research | `.harness/product/market.md` |
| 3 Business Case | `.harness/product/business-plan.md` |
| 4 Tech Architecture | `.harness/product/architecture.md`, `.harness/product/adr/ADR-001-stack.md` |
| 5 Architecture Rules & Design System | `.harness/rules/*` (stack overlays), `.harness/product/conventions.md`, `.harness/product/design-direction.md`, `.harness/product/design-system.md`, `.harness/product/playbooks/*`, enforcement scaffolding under `.harness/product/` |
| 6 Sprint Planning | `.harness/product/roadmap.md`, `.harness/product/sprints/01-auth-and-task-crud.md`, `.harness/product/features.json` |
| 7 Sprint Execution | `.harness/product/src/` (Sprint-1 slice), `.harness/runs/sprints/01-progress.md` (STM demo, ADR-003) |
| 8 Per-sprint Audit | `.harness/runs/audits/audit-01.md` — closed 7 → 8 loop |
| State | `.harness/state.yaml` (`layout: harness`; sprint `01` done) |

## How to read it

1. Start with `.harness/state.yaml` — harness layout; sprint `"01"` is `done` and the **7 ⇄ 8 loop has turned once**.
2. Read phase artifacts in order (0 → 8) to trace how a raw idea becomes running code.
3. Look at `.harness/runs/audits/audit-01.md` to see a real **closing** conformance audit.
4. The code slice under `.harness/product/src/` is the **full Sprint-1 vertical slice**.

## What this is NOT

- Not a mirror of the **engine repository** plugin layout. This fixture's bundled
  `.harness/scripts/doctor.mjs` is a CI snapshot; its plugin-marketplace CHECK paths (`plugins/midas`,
  root `.claude-plugin/`) reflect a **legacy engine layout**, not the current `harness/plugins/midas` +
  `harness/.claude-plugin/` tree. CI runs `doctor --strict --gates-only` here — plugin drift checks are
  skipped when those paths are absent on disk.
- Not a production-ready codebase. Files are illustrative; imports reference packages declared in
  `product/package.json` that a real project would `npm install`.
- Not a re-copy of the base rule floor. The example ships Phase-5 stack overlays under
  `.harness/rules/` and project docs under `.harness/product/` — so the
  "chose Next.js + Drizzle + Postgres → enforced stack rules" path is shown end-to-end.
- Not a tutorial for TaskPilot-the-product. It is a tutorial for **Midas** and how its artifacts
  connect phase-to-phase.
