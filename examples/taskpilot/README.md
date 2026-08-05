# TaskPilot — Midas worked example

> **Layout note:** this example still uses the legacy **hub** tree (`.midas/`). Fresh installs from
> `create-midas` use v2 **`.harness/`**. Full map: [V2-PATH-MAP.md](./V2-PATH-MAP.md).
> CI still gates this fixture via `node scripts/doctor.mjs --strict --gates-only examples/taskpilot`.

TaskPilot is a **minimal team task manager** used as a complete, fictional greenfield example to
show every Midas phase artifact populated with real, consistent content.

## What this example demonstrates

| Phase | Artifact(s) |
|---|---|
| 0 Idea Intake | `.midas/product/idea.md` |
| 1 Contextualize | `.midas/product/idea.md` (v2 embedded), `.midas/product/open-questions.md` |
| 2 Market Research | `.midas/product/market.md` |
| 3 Business Case | `.midas/product/business-plan.md` |
| 4 Tech Architecture | `.midas/product/architecture.md`, `.midas/product/adr/ADR-001-stack.md` |
| 5 Architecture Rules & Design System | `.midas/engine/rules/*` (generated stack rules), `.midas/product/conventions.md`, `.midas/product/design-direction.md`, `.midas/product/design-system.md`, `.midas/product/playbooks/*`, enforcement scaffolding under `.midas/product/` |
| 6 Sprint Planning | `.midas/product/roadmap.md`, `.midas/product/sprints/01-auth-and-task-crud.md`, `.midas/product/features.json` |
| 7 Sprint Execution | `.midas/product/src/` (Sprint-1 slice), `.midas/sprints/01-progress.md` (STM demo, ADR-003) |
| 8 Per-sprint Audit | `.midas/audits/audit-01.md` — closed 7 → 8 loop |
| State | `.midas/state.yaml` (`layout: hub`; sprint `01` done) |

## How to read it

1. Start with `.midas/state.yaml` — hub layout; sprint `"01"` is `done` and the **7 ⇄ 8 loop has turned once**.
2. Read phase artifacts in order (0 → 8) to trace how a raw idea becomes running code.
3. Look at `.midas/audits/audit-01.md` to see a real **closing** conformance audit.
4. The code slice under `.midas/product/src/` is the **full Sprint-1 vertical slice**.

## What this is NOT

- Not a production-ready codebase. Files are illustrative; imports reference packages declared in
  `product/package.json` that a real project would `npm install`.
- Not a re-copy of the base rule floor. The example ships Phase-5 artifacts under `.midas/engine/rules/`
  and `.midas/product/` — stack rules, conventions override, enforcement scaffolding — so the
  "chose Next.js + Drizzle + Postgres → enforced stack rules" path is shown end-to-end.
- Not a tutorial for TaskPilot-the-product. It is a tutorial for **Midas** and how its artifacts
  connect phase-to-phase.
