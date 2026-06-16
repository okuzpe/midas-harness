# TaskPilot — Business Case

> Phase 3 artifact. Gate requires: MVP scope + non-goals, measurable metrics, model, go/no-go + human sign-off.

---

## MVP scope

The MVP covers the minimum surface area required to validate the core hypothesis (teams of 2–10 adopt
and complete tasks in a zero-configuration environment).

### In scope

| Feature | Description |
|---|---|
| Workspace creation | User signs up, names a workspace, becomes the owner |
| Member invite | Owner invites up to 9 members via email; members accept and join |
| Task CRUD | Create/read/update/delete tasks with title, description, assignee, status |
| Statuses | Three statuses: `todo`, `in-progress`, `done` |
| Kanban board | Drag-and-drop columns per status; tasks rendered as cards |
| List view | Flat sortable/filterable list of tasks |
| Task comments | Plain-text comments on tasks; timestamped, attributed to author |
| Basic auth | Email + password registration, login, logout; hashed passwords (bcrypt) |
| Session management | Secure HTTP-only cookie sessions |

### Non-goals (explicit for MVP)

- File attachments on tasks
- OAuth / SSO (Google, GitHub login)
- Email notifications for comments or assignments
- Native iOS / Android apps
- Rich-text (markdown) comments
- Task subtasks or dependencies
- Time tracking
- Custom statuses or labels
- Reporting or analytics dashboards
- API access / webhooks
- Audit logs
- Multiple workspaces per account

---

## Measurable success metrics

| Metric | Target | Measurement method | Window |
|---|---|---|---|
| **Task-completion rate** (primary) | ≥ 70% of created tasks reach `done` | DB query: `done` tasks / total tasks per team | 60 days post-launch |
| **Week-2 retention** | ≥ 60% of onboarded teams create ≥ 1 task in week 2 | Cohort query on `tasks.created_at` | 60 days post-launch |
| **Onboarding time** | ≤ 5 minutes from signup to first task created | Event log: `user.registered` → `task.created` delta | First 30 days |
| **Invite conversion** | ≥ 50% of invited members accept within 48 h | `invites.accepted_at - invites.sent_at` | Continuous |

---

## Revenue / business model

- **Pilot phase (v1):** Free for up to 10 pilot workspaces. Goal is to validate metrics above.
- **v2 model (proposed, not in scope):** Freemium — free up to 3 members, paid tier at
  $6/user/month for 4–10 members. Break-even at ~50 paying workspaces (5 members avg).
- Pricing will not be built into v1; no billing infrastructure in scope.

---

## Assumptions

1. A single hosted Postgres instance is sufficient for pilot load (< 10 workspaces, < 100 users).
2. Pilot teams will be recruited manually (founder outreach, no paid acquisition).
3. Churn during pilot is acceptable data, not a failure signal.

---

## Go / no-go decision

**Decision: GO.**

Rationale:
- Problem is real and validated by competitive gap analysis (Phase 2).
- MVP is tightly scoped; all features are buildable in ≤ 3 two-week sprints by a solo developer.
- Success metrics are concrete, measurable, and achievable within a 60-day pilot window.
- Risk R-03 (no paid conversion) is mitigated by keeping pilot scope small and defining conversion
  criteria before launch.

**Human sign-off:** Approved by product owner on 2026-06-16.

---

## Phase 3 gate verdict

- [x] MVP scope defined; non-goals explicit
- [x] ≥ 2 measurable metrics with targets and measurement methods
- [x] Business model described (even if v1 is free)
- [x] Go/no-go decision made with rationale
- [x] Human sign-off recorded

Phase 3 exit gate: **PASSED**. Audited by: midas-orchestrator on 2026-06-16.
