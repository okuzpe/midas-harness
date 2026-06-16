# TaskPilot — MVP Roadmap

> Phase 6 artifact. Covers MVP scope only (3 sprints). Each sprint references the business-plan
> requirements and architecture decisions; every sprint file has a DoD referencing the Phase 5 rules.

---

## Scope boundary

This roadmap covers only the features defined as in-scope in `product/business-plan.md`. No feature
outside that list appears here. Any addition during execution must be proposed as a scope amendment
with a recorded rationale.

---

## Sprint overview

| Sprint | ID | Goal | Duration | Status |
|---|---|---|---|---|
| 1 | `01` | Auth + task CRUD (foundation) | 2026-06-16 → 2026-06-27 | active |
| 2 | `02` | Kanban board + list view | 2026-06-30 → 2026-07-11 | planned |
| 3 | `03` | Comments + invite flow + pilot launch | 2026-07-14 → 2026-07-25 | planned |

---

## Sprint 1 — Auth + task CRUD (foundation)

**Goal:** A user can register, log in, create a workspace, and perform full CRUD on tasks. No UI
polish required; all behaviour tested and all Drizzle schema migrations applied.

**Key deliverables:** DB schema, session auth, task CRUD API routes, minimal HTML form UI.

**Dependencies:** none (first sprint).

**Sprint file:** `product/sprints/01-auth-and-task-crud.md`

---

## Sprint 2 — Kanban board + list view

**Goal:** Tasks are visible in a drag-and-drop kanban board and a flat sortable list. Status changes
are persisted immediately. Authenticated users can assign tasks to workspace members.

**Key deliverables:** `kanban-board.tsx`, `task-card.tsx`, `/app/(app)/board/page.tsx`,
`/app/(app)/tasks/page.tsx`, list sort/filter params, assignment API patch.

**Dependencies:** Sprint 1 (auth + task schema must be done and migrated).

**Sprint file:** `product/sprints/02-kanban-and-list.md` _(to be created at sprint-planning time)_

---

## Sprint 3 — Comments + invite flow + pilot launch

**Goal:** Members can comment on tasks; workspace owner can invite members by email; invite link
flow complete. All MVP features operational; pilot launch checklist satisfied.

**Key deliverables:** `comments` table + API, invite email (Resend / nodemailer), member management
page, pilot-launch checklist audit.

**Dependencies:** Sprint 2 (board must exist for pilot users to experience the full flow).

**Sprint file:** `product/sprints/03-comments-invites-launch.md` _(to be created at sprint-planning time)_

---

## MVP exit criteria

All three sprints passed their Phase 8 audit AND:
- [ ] Primary metric baseline data collection running (task-completion rate query deployed)
- [ ] ≥ 3 pilot workspaces onboarded
- [ ] No P0 bugs open

State advances to `shipped` when exit criteria are met and recorded in the final audit.
