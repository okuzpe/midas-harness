---
name: start-sprint
description: Phase 7 kickoff — THE SIGNATURE LOOP that "applies the harness". Audit the living code against the frozen rules and scope, decide sprint adjustments (fix code OR consciously amend a rule, logged), select agents cost-aware, emit the working plan, and set the sprint active. Use to begin a planned sprint (stage sprint_planning/audit → sprint_execution).
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
---

# start-sprint (Phase 7 — Sprint Execution kickoff)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; if the precondition stage is wrong, report and stop.

This is **"applying the harness"** — the signature loop. Before any code is written for a sprint, the
orchestrator re-audits the **living code** against the **rules frozen in Phase 5** and the **scope in
the business case**, reconciles drift, picks the agents, and emits a working plan. Then implementation
proceeds on the **build** tier with Context7. (`/close-sprint` runs the same loop after.)

> **Precondition.** A sprint must be `planned` (or `active` being resumed) in `state.yaml.sprints[]`,
> and Phase 6's gate must be passed. If no sprint is selectable, stop and report.

## Procedure

### 1. Read state + rules
Load `harness/state.yaml` (sprints, routing, mode), the target `product/sprints/NN-*.md`, all
`harness/rules/*`, `product/design-system.md`, `product/playbooks/*`, and `product/business-plan.md`.
The rules are **frozen** — treat them as law for this audit.

### 2. Audit current code vs frozen rules + scope
Diff the existing code against each checkable rule (folder-structure/boundaries, conventions, testing,
design-system tokens, Context7 usage) and against the MVP scope. Note every drift with **evidence**
(file:line). On the first sprint of a greenfield repo this is mostly a clean baseline; on later
sprints it catches accumulated drift before it compounds.

### 3. Decide sprint adjustments (logged)
For each drift or scope mismatch, choose **one** and **log it**:
- **Fix the code** — add a task to this sprint to bring it back into conformance, or
- **Consciously amend a rule** — if the rule is wrong, update the rule in `harness/rules/`, record a
  one-line rationale (and an ADR if architectural), and re-render adapters via
  `node scripts/render-adapters.mjs` / `/midas-doctor`.

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
to satisfy. Update `harness/state.yaml`: set the sprint `status: active`, `stage: sprint_execution`,
`stage_status: in_progress`, refresh `last_touched`. Record any logged amendments in the sprint's
`audit_notes`.

### 6. Hand off to implementation
Implementation runs on the **build** tier. Before writing any third-party code, follow
`harness/rules/context7-usage.md` (`resolve-library-id` → `get-library-docs` at the pinned version).
**If a task matches a `product/playbooks/*` recipe** (one of the project's repeated procedures), the
build agent follows that playbook — its steps and done-when check. Tasks complete only when acceptance
criteria are met and tests pass; **conformance to rules is verified in Phase 8** (`/close-sprint`).

## Exit (kickoff complete)
The active sprint has a clear working plan, drift is either queued as fix-tasks or resolved via a
logged rule amendment, agents are assigned, and `state.yaml` shows the sprint `active`. The next ritual
after the work lands is `/close-sprint`.

## Tier & cost
Audit + adjustment decisions + agent selection → **orchestrate** (Opus). Implementation → **build**
(Sonnet, or a specialist). Context7 retrieval → **scout** (Haiku).
