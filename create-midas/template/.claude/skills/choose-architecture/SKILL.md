---
name: choose-architecture
description: Phase 4 — pin the tech stack and architecture from the business case, Context7-verify every version, and write product/architecture.md plus one ADR per decision. Use after the business case is signed off (stage business_case → tech_architecture) and before any rules or code exist.
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
---

# choose-architecture (Phase 4 — Tech & Architecture)

Turn the signed-off business case into a **pinned, verifiable architecture**: a chosen stack with
exact versions, a system diagram, and an ADR per irreversible decision. This is an **orchestrate-tier**
decision phase — Opus reasons about trade-offs; scout (Haiku) does the Context7 retrieval.

> **Precondition.** Read `harness/state.yaml` first. This skill runs when `stage: business_case` is
> `passed` (or `stage: tech_architecture` is in progress / being resumed). If the business case gate
> has not passed, stop and report which Phase-3 item is missing — do not invent architecture for an
> unscoped product.

## Inputs (read first, write last)
- `harness/state.yaml` — current stage, `routing`, `mcp`.
- `product/business-plan.md` — MVP scope, non-goals, success metrics, model.
- `product/idea.md`, `product/market.md` — product/user/problem context.
- `harness/rules/context7-usage.md` — the version-verification rule you MUST honor here.

## Procedure

### 1. Enumerate technical requirements — and the macro-pattern forks
Derive from the business case (not from preference): functional needs, the success metrics that
imply non-functional requirements (latency, scale, cost ceiling), data shape and persistence,
integrations, auth, deployment target, team/skill constraints, and licensing limits. Write them as a
checklist so the gate can confirm **every requirement is covered** by the chosen stack.

**Then name the 3–5 hardest-to-reverse *macro-pattern* forks** — the shape-of-the-system decisions a
non-technical founder must own, framed as **business/control trade-offs, not tech containers**. The canonical set:
- **App shape** — one full-stack codebase (Next.js/Remix/SvelteKit, server actions + route handlers) **vs**
  a decoupled frontend + a standalone backend API. *(speed-now vs split-later / more control)*
- **Auth strategy** — framework-native or SDK auth (you own the code, tightly coupled, fast) **vs** a
  dedicated provider / auth-API (Auth0/Clerk/WorkOS — they own it, portable, SSO/SCIM-ready) **vs** a **BFF**
  that keeps session tokens server-side (a security pattern, combinable with either).
- **Vendor lock-in / portability** — how coupled to one platform/BaaS/IDaaS (Vercel-only features, Supabase,
  Auth0), and what migrating away would cost.

These are **more consequential than any per-layer library pick** — reversing one is a rewrite — so they are
asked **first** in Step 3. The 2026 default is **monolith-first + built-in auth** for ~90% of products (small
team, no second client yet); decoupling and a dedicated auth provider are **evidence-driven graduations**
(multiple clients on one API, separate teams, enterprise SSO/SAML/SCIM, a backend-language mismatch) —
recommend the default, but **surface the fork** instead of deciding it silently.

### 2. Propose candidate stacks
For each major layer (frontend, backend, data, infra, key libraries) list **2–3 candidates** with a
one-line trade-off (fit to requirement, maturity, cost, team familiarity, lock-in). Prefer boring,
well-supported technology. Each candidate that survives becomes a decision needing an ADR.

### 3. Recommend the industry standard, then let the user choose (recommend-don't-wall)
**Ask the macro-pattern forks (Step 1) FIRST** — they are harder to reverse than any library pick — then the
per-layer framework choices. Recommend the industry-standard default for each and **ask via `AskUserQuestion`**,
the recommended option marked *(Recommended)*.

**Macro forks — ask in PLAIN, founder-facing language tied to a business trade-off** (no jargon; lead with
speed/cost/control/switching-cost). This is the step that prevents a silent "login-inside-the-framework" default:
- **App shape:** *"Ship faster now with one combined system, or invest up front so it's easier to scale and
  split later? Will anything besides the website need the same data soon — a phone app, partners, other
  teams?"* → no ▸ one codebase (monolith — **Recommended** for most); yes/soon ▸ decoupled frontend + API.
- **Auth:** *"Login handled inside our own app (we own the code, fastest, harder to share across services),
  or run by a dedicated provider (simpler enterprise SSO, but a vendor dependency)? Who must log in, and will
  we sell to big companies?"* Plus the safety question: *"Should user tokens ever live in the browser?"* →
  no ▸ keep them server-side (BFF) when security matters.
- **Lock-in:** *"How hard should it be to switch providers later — are we OK trading some future freedom for
  speed today?"* Decide it on purpose, recorded in its ADR.

**Per-layer frameworks — then** name the current industry-standard default for this kind of product (e.g.
"for a transactional SaaS web app: Next.js + Postgres + an ORM"), with a one-line *why it's the default*,
grounded in **current docs** (Context7 / the library's own site), not memory or hype. Ask via
`AskUserQuestion`, the recommended default marked *(Recommended)*, each with a short trade-off:
- **No preference** → the recommended default stands. Surface the choice; never block on it.
- **User overrides** → honor it; the ADR (Step 6) records that the decision was the human's, with their reason.
- Ask only about the **few decisions that actually matter** (consequential, hard-to-reverse layers) — don't
  quiz the user on every minor library; trivial/obvious picks go straight to the ADR.
The user's selections (or an explicit "use the recommendation") are the **Decision** each ADR records, and
only the chosen options get version-pinned in the next step.

### 4. PIN versions — verified against current docs (mandatory; Context7 recommended)
For every third-party framework/library you select, follow `harness/rules/context7-usage.md`
**before** committing to it: `resolve-library-id` → `get-library-docs` at the version you intend to
pin. Confirm the version is current/supported and the APIs you depend on exist. Route these fetches
to the **scout** tier. Record the exact pinned version (e.g. `next@15.x`, `drizzle-orm@0.36.x`) and
the Context7 verification next to each choice. If Context7 is unreachable, use the documented web
fallback and add the visible note — never pin from memory.

### 5. Write `product/architecture.md`
One document, containing:
- **Requirements coverage** — the Step-1 checklist mapped to the chosen components.
- **Stack table** — layer · choice · **pinned version** · Context7-verified (✓/web-fallback) · why.
- **System diagram** — a Mermaid `graph`/`flowchart` of components, data stores, and external
  services and how requests flow.
- **Key flows** — the 2–3 critical paths (e.g. auth, the core user action) in prose or sequence.
- **Boundaries** — the module/layer boundaries that Phase 5 will turn into checkable import rules.
- **Risks & deferrals** — what is explicitly out of MVP scope (mirrors business-case non-goals).

### 6. Write one ADR per decision
For each surviving decision, write `product/adr/ADR-NNN-<slug>.md` (zero-padded, sequential) using
the standard shape: **Status** (Accepted), **Context** (requirement + constraints), **Decision**
(the choice + pinned version), **Alternatives considered** (the candidates from Step 2 and why
rejected), **Consequences** (what this commits us to, what it costs). One decision per ADR; never
bundle. **Each macro-pattern fork (app shape, auth strategy, lock-in) gets its OWN ADR** recording the fork,
the human's choice (or explicit default), and the coupling-vs-control trade-off — never collapsed into a
single stack ADR's "Alternatives considered".

### 7. Record state
Update `harness/state.yaml`: set `phases.tech_architecture.artifacts` to the architecture + ADR
files, `stage_status: gate_pending`. Do **not** self-advance the stage — the orchestrator runs the
gate and writes the verdict (the producer never grades its own homework).

## Exit gate (orchestrate audits before advancing to Phase 5)
- The **macro-pattern forks** (app shape monolith-vs-decoupled, auth native-vs-delegated-vs-BFF, vendor lock-in)
  were **surfaced to the human in plain language** (not only rejected in an ADR's alternatives); each has an
  ADR recording the fork, the choice or explicit default, and the trade-off.
- The **consequential stack choices were put to the human** (industry-standard recommendation +
  alternatives); the selection — or an explicit "use the recommendation" — is recorded, and any override
  is noted in its ADR as a human decision.
- Stack is **pinned** and every third-party version is **Context7-verified** (or web-fallback noted).
- A system **diagram** is present.
- **One ADR per decision** exists under `product/adr/`.
- **Every Step-1 requirement is covered** by a named component.
- Architecture scope matches the business-case MVP (no gold-plating, no missing must-haves).

On pass: write the verdict to `.harness/audits/`, set `phases.tech_architecture.gate: passed`, and
the next action is `/define-conventions` (Phase 5). On fail: report the specific unmet gate item.

## Tier & cost
Reasoning/trade-offs/ADRs → **orchestrate** (Opus). Context7 doc fetches and version lookups →
**scout** (Haiku). Prefer an installed architecture-review specialist
(`feature-dev:code-architect`, `voltagent-qa-sec:architect-reviewer`) if present; otherwise
`midas-orchestrator`.
