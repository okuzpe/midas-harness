---
name: choose-architecture
user-surface: primary
description: Phase 4 — pin stack and architecture from the business case, Context7-verify versions, write {product}/architecture.md and one ADR per decision. Use after business case gate passes (stage business_case → tech_architecture), before rules or code.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
---

# choose-architecture (Phase 4 — Tech & Architecture)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Prompt tool:** `AskQuestion`. On Claude Code, fall back to `AskUserQuestion` if AskQuestion is not wired.
> Read **`paths.state`** first. Precondition: `stage: business_case` `passed`, or `tech_architecture` in progress. If business case gate has not passed, stop and report missing Phase-3 items.

Turn the signed-off business case into a **pinned, verifiable architecture**: exact versions, system diagram, ADR per irreversible decision. **Orchestrate-tier** — Opus reasons; scout does Context7 retrieval.

## Does / Does not

| Does | Does not |
|---|---|
| Surface macro forks in plain language; pin + verify versions | Self-advance `stage` or grade its own gate |
| Write `{product}/architecture.md` + `{product}/adr/ADR-NNN-*.md` | Invent architecture for an unscoped product |
| Record `phases.tech_architecture.artifacts`, `stage_status: gate_pending` | Bundle macro forks into one stack ADR |

## When NOT
- Business case / go/no-go not signed → `/business-plan`.
- Architecture already frozen and you need rules → `/define-conventions`.
- Stack tweak mid-sprint without a new ADR → stop; open an ADR or defer to tribunal.

**Anti-rationalization:** pinning versions from memory is a **fail** — Context7 (or documented web fallback) required before every third-party pin.

## Inputs (read first, write last)

- **`paths.state`** — stage, `routing`, `mcp`
- `{product}/business-plan.md`, `{product}/idea.md`; `{product}/market.md` **optional when `track: lite`**
- `<paths.engine>/rules/context7-usage.md`

## Procedure

### 1. Enumerate requirements + macro-pattern forks
Derive from the business case: functional needs, NFRs implied by success metrics, data/auth/integrations/deployment constraints. Write a checklist so the gate confirms **every requirement is covered**.

Name **3–5 hardest-to-reverse macro forks** (business trade-offs, not jargon):

- **App shape** — one full-stack codebase vs decoupled frontend + API (speed-now vs split-later)
- **Auth** — framework-native vs dedicated provider vs BFF (server-side tokens)
- **Lock-in / portability** — platform coupling and migration cost

Default: **monolith-first + built-in auth** for ~90% of products; decouple/auth-provider are evidence-driven graduations (multiple clients, enterprise SSO/SAML/SCIM). Surface the fork; never decide silently.

### 2. Propose candidate stacks
Per layer (frontend, backend, data, infra, key libs): **2–3 candidates** with one-line trade-off. Prefer boring, well-supported tech. Survivors need ADRs.

### 3. Recommend, then let the user choose (recommend-don't-wall)
**Ask macro forks FIRST**, then per-layer picks. Recommend industry-standard default; ask via `AskUserQuestion`, recommended option marked *(Recommended)*.

**Macro forks — plain, founder-facing language:**

- **App shape:** *"Ship faster with one system, or invest up front to split later? Will anything besides the website need the same data soon?"* → no ▸ monolith *(Recommended)*; yes/soon ▸ decoupled.
- **Auth:** *"Login inside our app vs dedicated provider? Who logs in — enterprise buyers?"* Plus: *"Should tokens live in the browser?"* → no ▸ BFF when security matters.
- **Lock-in:** *"How hard to switch providers later?"* — record in ADR.

**Per-layer:** name current industry default for this product type, grounded in **current docs** (Context7), not memory. `AskUserQuestion` with *(Recommended)*. No preference → default stands. Override → honor; ADR records human decision. Ask only **consequential** layers; trivial picks go straight to ADR.

### 4. PIN versions (mandatory; Context7 recommended)
Per `<paths.engine>/rules/context7-usage.md`: `resolve-library-id` → `get-library-docs` at intended pin. Route fetches to **scout**. Record exact version + verification. Context7 unreachable → web fallback + visible note — never pin from memory.

### 5. Write `{product}/architecture.md`
- Requirements coverage (Step-1 checklist → components)
- Stack table: layer · choice · **pinned version** · verified (✓/web-fallback) · why
- Mermaid system diagram (components, stores, external services, request flow)
- Key flows (2–3 critical paths)
- Boundaries (Phase 5 import rules)
- Risks & deferrals (MVP non-goals)

### 6. Write one ADR per decision
`{product}/adr/ADR-NNN-<slug>.md`: **Status** (Accepted), **Context**, **Decision** (+ pinned version), **Alternatives considered**, **Consequences**. One decision per ADR. **Each macro fork gets its own ADR** — never collapsed into alternatives.

### 7. Record state
Update **`paths.state`**: `phases.tech_architecture.artifacts`, `stage_status: gate_pending`. Do **not** self-advance — orchestrator runs the gate.

## Exit gate (orchestrate audits before Phase 5)

Full checklist: **`<paths.engine>/pipeline/4-tech-architecture.md` § Exit gate checklist**. Key gates:

- Macro forks **surfaced in plain language**; each has an ADR with choice/default + trade-off.
- Consequential stack choices **put to the human**; selection or explicit "use the recommendation" recorded; overrides noted as human decisions.
- Stack **pinned**; every third-party version **Context7-verified** (or web-fallback noted).
- System **diagram** present; **one ADR per decision** under `{product}/adr/`.
- **Every Step-1 requirement covered**; scope matches business-case MVP.
- If the client includes **native or hybrid mobile**, `{product}/architecture.md` § Client names the verify tool (Maestro MCP / agent-browser) and emulator/simulator prerequisites.

On pass: freeze `{runs}/audits/gate-04.md`, set `phases.tech_architecture.gate: passed`, next → `/define-conventions`. On fail: report unmet item.

## Tier & delegation

Reasoning/trade-offs/ADRs → **orchestrate**. Context7 fetches → **scout**. Prefer installed `code-architect` / `architect-reviewer` if present; else `midas-orchestrator`.
Under `cost_profile: max_savings`, **escalate this Phase-4 gate to Opus** even if the default orchestrate pin is Sonnet.
