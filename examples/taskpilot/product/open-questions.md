# TaskPilot — Open Questions

> Gate requirement: **0 BLOCKING questions** before advancing to Phase 2.
> All questions below were raised in Phase 1 and are now resolved.

---

## Resolved questions

| # | Question | Blocking? | Resolution | Resolved at |
|---|---|---|---|---|
| OQ-01 | What is the maximum team size supported at launch? | YES | Hard cap of 10 members per workspace in v1. Larger teams are a v2 concern. | Phase 1 |
| OQ-02 | Is authentication in-scope for the MVP? | YES | Yes — email + password auth with sessions (no OAuth or SSO in v1). | Phase 1 |
| OQ-03 | Does the MVP need a kanban board UI or just a list view? | YES | Both: a kanban board is the primary view; a flat list view is secondary. | Phase 1 |
| OQ-04 | What is the data persistence model — multi-tenant SaaS or self-hosted? | YES | Hosted SaaS, single Postgres database with row-level tenant isolation. | Phase 1 |
| OQ-05 | Do tasks need file attachments? | NO (deferred) | Not in MVP. Deferred to v2; accepted assumption logged below. | Phase 1 |
| OQ-06 | What is the pricing model? | NO (deferred) | Free during pilot; paid tiers are a v2 decision. Noted in business plan. | Phase 1 |
| OQ-07 | Who owns the workspace? Can members be removed? | YES | Workspace has one owner (creator). Owner can invite and remove members. | Phase 1 |
| OQ-08 | Do comments support markdown or rich text? | NO (deferred) | Plain text only in v1. Rich text deferred to v2. | Phase 1 |

---

## Accepted assumptions (deferred, non-blocking)

- File attachments are out of scope for v1; tasks may reference external links in the description field.
- Pricing/billing infrastructure will be evaluated after pilot metrics are collected.
- Comments are plain text; no mention-notifications via email in v1 (in-app only).

---

## Gate verdict

All BLOCKING questions resolved. **0 BLOCKING questions remain.** Phase 1 exit gate: **PASSED**.

Audited by: midas-orchestrator (claude-opus-4-8) on 2026-06-16.
