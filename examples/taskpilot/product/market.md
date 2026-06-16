# TaskPilot — Market Research

> Phase 2 artifact. Gate requires: ≥ 3 competitors, differentiation thesis, cited claims, top-3 risks.

---

## Market overview

The team task-management SaaS market is large and mature, dominated by tools that have grown beyond
their original scope. The addressable wedge for TaskPilot is the **small-team segment (2–10 people)**
that finds mainstream tools over-engineered and spreadsheets under-powered.

Industry analyst estimates place the broader project-management software market at roughly $7B in 2025,
growing at ~13% CAGR through 2030 [1]. The small-business / SMB sub-segment is underserved by the
dominant tools, which are priced and designed for enterprises.

---

## Competitor analysis

### 1. Linear

- **Summary:** Opinionated, fast issue tracker favored by software teams. Keyboard-first, minimal UI.
- **Strengths:** Excellent performance, clean design, strong developer adoption, native roadmaps and
  cycles, Git integration.
- **Weaknesses:** Still requires understanding of Teams/Projects/Cycles hierarchy; pricing starts at
  $8/user/month which can feel steep for a 2-person startup; overkill for non-engineering teams.
- **Source:** Linear pricing and feature overview [2].

### 2. Trello

- **Summary:** Kanban-board pioneer owned by Atlassian. Cards with lists, simple drag-and-drop.
- **Strengths:** Universally familiar, generous free tier, extremely low onboarding friction.
- **Weaknesses:** No first-class task assignment accountability (cards can be "orphaned"), limited
  list/filter views, power-ups (integrations) required for anything beyond basic boards, increasingly
  cluttered UI after Atlassian acquisition.
- **Source:** Trello product page and G2 reviews [3].

### 3. Asana

- **Summary:** Full-featured work-management platform targeting teams of all sizes.
- **Strengths:** Rich feature set (timelines, goals, workload), strong integrations, established brand.
- **Weaknesses:** Feature bloat actively alienates small teams; free tier limited to 10 users with
  restricted features; UI requires significant onboarding time; pricing jumps sharply to $10.99/user/month
  for the next tier.
- **Source:** Asana pricing page and independent SMB review [4].

---

## Differentiation thesis

TaskPilot wins on **radical simplicity + zero configuration tax**.

| Dimension | Linear | Trello | Asana | TaskPilot |
|---|---|---|---|---|
| Hierarchy required? | Yes (Team/Project/Cycle) | No | Yes (Org/Team/Project) | No — one workspace, flat |
| Onboarding time (est.) | 30–60 min | 10–20 min | 60–90 min | < 5 min |
| Kanban + list view? | Yes | Kanban only (lists via plugin) | Yes | Yes (v1) |
| Price for 5 users | $40/mo | Free / $5/mo | $55/mo | Free (pilot) |
| Native mobile | Yes | Yes | Yes | No (v1) |
| Target team size | 10–500 | 1–50 | 10–5000 | 2–10 |

TaskPilot's hypothesis: a meaningfully better experience for **teams that are too small to justify
Linear or Asana** and frustrated by Trello's shallow accountability model.

---

## Top-3 risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Trello / Linear release a "simple mode" that closes the simplicity gap | Medium | High | Differentiate on speed-to-first-task and 0-config multi-member invite; build loyalty before they respond |
| R-02 | The target segment (2–10 person teams) churns quickly as teams grow out of TaskPilot | High | Medium | Design the data model so migrating tasks to Linear/Jira is a one-click export; use churn as proof-of-success, not failure |
| R-03 | Free-pilot teams never convert to paid; unit economics don't work | Medium | High | Gate pilot size to 10 teams; define conversion event and pricing before pilot ends |

---

## Citations

[1] Grand View Research — "Project Management Software Market Size Report, 2025–2030"
    https://www.grandviewresearch.com/industry-analysis/project-management-software-market (retrieved 2026-06-16)

[2] Linear — Pricing and Features
    https://linear.app/pricing (retrieved 2026-06-16)

[3] Trello — Product overview + G2 category page
    https://trello.com/en/tour and https://www.g2.com/products/trello/reviews (retrieved 2026-06-16)

[4] Asana — Pricing page + SMB review on Capterra
    https://asana.com/pricing and https://www.capterra.com/p/66903/Asana/ (retrieved 2026-06-16)

---

## Gate verdict

- [x] ≥ 3 competitors documented with strengths and weaknesses
- [x] Differentiation thesis stated and supported by comparison table
- [x] All cited claims link to external sources
- [x] Top-3 risks identified with likelihood, impact, and mitigation

Phase 2 exit gate: **PASSED**. Audited by: keel-orchestrator on 2026-06-16.
