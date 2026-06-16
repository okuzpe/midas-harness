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
| 5 Architecture Rules & Design System | `product/design-system.md` |
| 6 Sprint Planning | `product/roadmap.md`, `product/sprints/01-auth-and-task-crud.md` |
| 7 Sprint Execution | `product/src/` (code slice + test) |
| 8 Per-sprint Audit | `.harness/audits/audit-01.md` |
| State | `harness/state.yaml` |

## How to read it

1. Start with `harness/state.yaml` — it records where in the lifecycle TaskPilot currently sits
   (`sprint_execution`, sprint `"01"` active).
2. Read phase artifacts in order (0 → 8) to trace how a raw idea becomes running code.
3. Look at `.harness/audits/audit-01.md` to see a real conformance audit: pass/fail rows, one
   consciously-amended rule, and a recorded assumption.
4. The code slice under `product/src/` is intentionally tiny — just enough to show the stack
   (Next.js + TypeScript + Postgres/Drizzle) and to give the audit something to check.

## What this is NOT

- Not a production-ready codebase. Files are illustrative; imports reference packages that would be
  installed via `npm install` in a real project.
- Not a tutorial for TaskPilot-the-product. It is a tutorial for **Midas** and how its artifacts
  connect phase-to-phase.
