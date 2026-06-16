# ADR-001 — Stack selection for TaskPilot v1

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-06-16 |
| Deciders | Product owner + keel-orchestrator |
| Context7 verified | Yes (Drizzle 0.40.x, Next.js 15.3.x) |

---

## Context

TaskPilot is a greenfield SaaS product targeting teams of 2–10. The solo v1 developer needs a
full-stack JavaScript framework that minimises deployment complexity, has a mature ecosystem, and
allows type-safe database access without the overhead of a separate backend process.

Constraints from the business case:
- Single developer in v1.
- Must reach pilot launch within 3 two-week sprints.
- Hosted SaaS (no self-hosted option).
- Postgres required for row-level tenant isolation.

---

## Decision

**Use Next.js 15 (App Router) + TypeScript + Drizzle ORM + Neon Postgres, deployed on Vercel.**

---

## Alternatives considered

| Alternative | Reason rejected |
|---|---|
| **Remix + Prisma** | Prisma's migration story on Neon (serverless) has known edge-case latency on cold starts with the native driver; Drizzle is lighter and equally type-safe |
| **SvelteKit + Drizzle** | Smaller ecosystem; shadcn/ui and the wider React component library surface is valuable for speed; team has stronger React background |
| **Express + React (separate processes)** | Two deployed services increases ops burden for a v1 solo project; Next.js App Router Route Handlers eliminate the split with no meaningful trade-off at this scale |
| **Supabase Auth** | Adds a dependency on Supabase's hosted auth service; custom sessions are 60 lines of code for v1 scope and avoid the lock-in |

---

## Consequences

**Positive:**
- Single deployment target (Vercel) with zero-config preview environments.
- Drizzle schema is the single source of truth for all table shapes; TypeScript types are inferred
  directly — no code-generation step to forget.
- Neon Postgres provides serverless auto-scaling; free tier sufficient for pilot.
- Next.js RSC allows server-rendered pages with no client JS overhead for the list view.

**Negative / accepted trade-offs:**
- App Router has a steeper learning curve than Pages Router; mitigated by the Context7-verified docs.
- Drizzle is younger than Prisma; community is smaller. Risk accepted because API surface needed is
  small (CRUD + joins) and the library is stable at 0.40.x.
- Custom auth means we own session security; mitigated by bcrypt + HTTP-only cookies and a planned
  Phase 8 security audit.

---

## References

- Next.js App Router docs (fetched via Context7 `resolve-library-id` → `get-library-docs`, v15.3):
  https://nextjs.org/docs/app
- Drizzle ORM docs (fetched via Context7, v0.40.x):
  https://orm.drizzle.team/docs/overview
- Neon + Drizzle integration guide:
  https://neon.tech/docs/guides/drizzle
