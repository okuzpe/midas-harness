---
name: start-sprint
description: Phase 7 kickoff — pre-sprint drift audit vs frozen rules, working plan, set sprint active. Use to begin a planned sprint (stage sprint_planning → sprint_execution). Do NOT use to close a sprint or grade conformance — that is /close-sprint after tasks, tests, and /midas-verify.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
---

# start-sprint (Phase 7 — Sprint Execution kickoff)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).

This is **"applying the harness"** — the signature loop. Before any code is written for a sprint, the
orchestrator re-audits the **living code** against the **rules frozen in Phase 5** and the **scope in
the business case**, reconciles drift, picks the agents, and emits a working plan. Then implementation
proceeds on the **build** tier with Context7.

> **vs `/close-sprint`:** `start-sprint` = **pre-sprint** drift audit + working plan + set sprint `active`.
> `close-sprint` = **formal Phase-8 gate** after tasks are done, tests green, and UI journeys verified.
> Do not substitute one for the other — run start at kickoff, close at the gate.

> **Precondition.** A sprint must be `planned` (or `active` being resumed) in `paths.state → sprints[]`,
> and Phase 6's gate must be passed. If no sprint is selectable, stop and report.

## Does / Does not

| Does | Does not |
|---|---|
| Pre-sprint audit of living code vs frozen rules + MVP scope | Render the Phase-8 conformance verdict (`/close-sprint`) |
| Queue fix-tasks or log conscious rule amendments | Silently ignore drift |
| Emit working plan; set sprint `active` after confirm | Implement the sprint tasks here (that is build / Phase 7 body) |
| Cost-aware agent/tier selection + Context7 library list | Replace `/plan-sprints` (no plan yet → plan first) |

## When NOT

- No sprint planned / Phase 6 not passed → `/plan-sprints` (or `/midas-status`).
- Tasks already done and ready to grade → `/close-sprint` (after `/midas-verify` when UI).
- Ad-hoc investigation outside the sprint → `/midas-explore`.
- Only need orientation → `/midas-status` / `/midas-recall`.

## Procedure

### 1. Read state + rules
Load **`paths.state`** (sprints, routing, mode), the target `{product}/sprints/NN-*.md`, all
the effective rules from `<paths.engine>/rules/*` plus `<paths.rules>/*`, `{product}/design-system.md`,
**`{product}/design-direction.md` whenever the sprint
touches UI** (the named references + mood + anti-references — the anchor that keeps UI off generic
defaults), `{product}/playbooks/*`, and `{product}/business-plan.md`. The rules are **frozen** — treat
them as law for this audit.

### 2. Audit current code vs frozen rules + scope
Diff the existing code against each checkable rule (folder-structure/boundaries, conventions, testing,
design-system tokens, Context7 usage) and against the MVP scope. Note every drift with **evidence**
(file:line). On the first sprint of a greenfield repo this is mostly a clean baseline; on later
sprints it catches accumulated drift before it compounds.

### 3. Decide sprint adjustments (logged)
For each drift or scope mismatch, choose **one** and **log it**:
- **Fix the code** — add a task to this sprint to bring it back into conformance, or
- **Consciously amend a rule** — if the rule is wrong, create or update its `<paths.rules>/` overlay, record a
  one-line rationale (and an ADR if architectural), and re-render adapters via
  `node <paths.scripts>/render-adapters.mjs` / `/midas-doctor`.

**Never** let code silently diverge from a rule. Every amendment is a deliberate, recorded decision —
this is the only legitimate way a rule changes after Phase 5.

### 4. Select agents (cost-aware)
Route work by tier (`docs/agents-and-models.md`): **orchestrate** for this audit/planning, **build**
for implementation, **scout** for Context7 fetches and extraction. **Prefer an installed specialist**
matching the sprint's work (e.g. `voltagent-core-dev:backend-developer`/`frontend-developer`,
`ui-designer`) if present; otherwise fall back to the first-party `midas-builder` / `midas-scout`.
Never depend on or mutate vendor packs.

### 5. Emit the working plan and set the sprint active
Write the ordered working plan: the sprint's tasks (incorporating any fix-the-code tasks from Step 3),
which agent/tier owns each, the Context7 libraries to fetch first, and the acceptance criteria + DoD
to satisfy. Summarize the plan for the user, then update **`paths.state`** (read-modify-write) only after
they confirm kickoff (or the slash-command itself is the confirmation): set the sprint `status: active`,
`stage: sprint_execution`, `stage_status: in_progress`, refresh `last_touched`. Record any logged
amendments in the sprint's `audit_notes`.

### 6. Hand off to implementation
Implementation runs on the **build** tier. Print: *"👉 Optional: `/midas-recall sprint` for a context pack
before coding (scout tier; read-only)."* — do **not** re-load the full rule set here; recall delegates to scout.
During long sprints, remind: *"👉 `/midas-progress` after significant tasks (STM in `{runs}/sprints/NN-progress.md`)."*
**Optional bounded autopilot:** if the user wants one code task per scheduled tick (ADR-009), point to
`/midas-autopilot` after kickoff — requires `npx … --autonomy` install; the skill guides `setup` /
`dry-run`; only the human or CI runs `midas-autopilot tick` (never auto-invoked from chat).
Before writing any third-party code, follow
`<paths.engine>/rules/context7-usage.md` (`resolve-library-id` → `get-library-docs` at the pinned version).
**If a task matches a `{product}/playbooks/*` recipe** (one of the project's repeated procedures), the
build agent follows that playbook — its steps and done-when check. **For any UI work, build *to*
`{product}/design-direction.md` — its named references, mood, metaphor, first-viewport evidence, and
anti-references — not just to the
tokens; the tokens are the materials, the direction is the look.** Honor the always-on
`<paths.engine>/rules/accessibility.md` floor and **Product authenticity** in
`<paths.engine>/rules/visual-design.md`. If the sprint (or user) asks to **redesign / improve /
refactor** visuals or a landing, surface **`/midas-design`** first (three directions → pick → spec →
one slice) — do not jump straight to full-page JSX. Tasks complete only when acceptance criteria are met and tests
pass; **conformance to rules is verified in Phase 8** (`/close-sprint`).

## Exit gate (kickoff complete)
- [ ] Working plan lists tasks, owners/tiers, Context7 libs, acceptance + DoD.
- [ ] Pre-sprint drift is queued as fix-tasks **or** logged as a conscious rule amendment (evidence cited).
- [ ] `paths.state` shows the sprint `status: active` and `stage: sprint_execution` (write last).
- [ ] User knows next close ritual is `/close-sprint` (after tests + `/midas-verify` when UI).
- [ ] No Phase-8 `MIDAS_AUDIT_RESULT` claimed here — kickoff only.

## Tier & delegation
Audit + adjustment decisions + agent selection → **orchestrate** (`midas-orchestrator`). Implementation →
**build** (`midas-builder`, or a specialist). Context7 retrieval → **scout** (`midas-scout`).
Respect `cost_profile`. Under `max_savings`, keep this kickoff audit on the orchestrate pin (escalate to
Opus if drift judgment is high-stakes).
