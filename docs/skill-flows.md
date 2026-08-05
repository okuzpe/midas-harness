# Skill flows

This guide explains the shape of each Midas skill without repeating its step-by-step procedure.
Use it to understand where a command starts, what decision it owns, what it leaves on disk, and
where control normally goes next.

The canonical procedure remains each `harness/skills/<name>/SKILL.md`. Lifecycle routing comes from
`harness/stage-command-table.yaml`; state semantics come from `harness/state.schema.md`.

## How to read the flows

Every skill reads `paths.state` first. A skill that writes state does so last, after its artifacts
exist. State has four useful layers:

- **Lifecycle:** `stage` + `stage_status` are the program counter.
- **Gate ledger:** `phases.*` records artifacts and pass/pending status.
- **Sprint loop:** `sprints[]` records planned, active, blocked, and done work.
- **Pointers:** `last_verification`, `last_security`, and similar fields point to frozen records;
  they do not advance the lifecycle.

There are three kinds of flow:

- **Advancing:** completes a phase gate or moves a sprint toward `shipped`.
- **In-place:** creates evidence or changes project files but leaves `stage` unchanged.
- **Read-only:** explains or diagnoses state without writing project files.

## Whole-system flow

```mermaid
flowchart LR
  Init["/midas-init<br/>scan and classify"] --> Entry{"Maturity"}
  Entry -->|E0| P0["/idea-intake"]
  Entry -->|E1| P1["/contextualize"]
  Entry -->|E2 or E3| Adopt["/midas-adopt"]
  P0 --> P1
  P1 --> P2["/market-research"]
  P2 --> P3["/business-plan<br/>human go/no-go"]
  P3 --> P4["/choose-architecture"]
  P4 --> P5["/define-conventions"]
  Adopt --> P5
  P5 --> P6["/plan-sprints"]
  Adopt --> P6
  P6 --> P7["/start-sprint<br/>build and prove"]
  P7 --> P8["/close-sprint<br/>independent audit"]
  P8 -->|next sprint| P7
  P8 -->|MVP complete| Ship["shipped"]
```

Phase 8 runs **in place** while the top-level stage remains `sprint_execution`; `audit` is a ledger
phase, not a top-level runtime stage.

## Pipeline skills

These are the advancing path. The producer writes artifacts; the orchestrate-tier gate checks
on-disk evidence before the lifecycle advances.

| Skill | Starts from | Core flow | Leaves behind | On success |
|---|---|---|---|---|
| `/idea-intake` | Initialized E0 project | Preserve raw idea, clarify it, normalize the pitch | `{product}/idea.md` | `idea_intake` → `contextualize` |
| `/contextualize` | Idea captured | Find gaps, ask only blockers, repeat until none remain | Revised `idea.md` + `open-questions.md` | `contextualize` → `market_research` |
| `/market-research` | Zero blocking product questions | Fan out cited research, challenge claims, synthesize demand | `{product}/market.md` | `market_research` → `business_case` |
| `/business-plan` | Market gate passed | Define MVP, non-goals, metrics, economics, then ask go/no-go | `{product}/business-plan.md` + human sign-off | GO → `tech_architecture`; NO-GO → stop |
| `/choose-architecture` | Signed GO business case | Surface hard-to-reverse forks, verify versions, record decisions | `architecture.md` + one ADR per decision | Gate pass → `architecture_rules` |
| `/define-conventions` | Architecture and ADRs accepted | Turn architecture into checkable rules, design system, and enforcement | Rules, design docs, playbooks, rendered adapters | Gate pass → `sprint_planning` |
| `/plan-sprints` | Rules frozen | Decompose only the MVP into dependency-ordered, shippable slices | Roadmap, sprint files, `features.json`, planned `sprints[]` | Gate pending; next `/start-sprint` |
| `/start-sprint` | Planned sprint | Audit pre-existing drift, form working plan, activate the sprint | Drift decisions + active sprint | `sprint_planning` → `sprint_execution` |
| `/close-sprint` | Active sprint with work proven | Independently audit rules and scope, resolve drift, freeze verdict | `{runs}/audits/audit-NN.md` + done sprint | Next sprint, or `shipped` |

The front-loaded lifecycle is linear; the recurring product-development loop is:

```mermaid
flowchart LR
  Start["/start-sprint"] --> Build["Implement tasks"]
  Build --> Prove["Static checks → tests → runtime → /midas-verify"]
  Prove --> Close["/close-sprint"]
  Close -->|unresolved drift| Fix["Fix or consciously amend"]
  Fix --> Close
  Close -->|more planned work| Start
  Close -->|metrics met| Ship["shipped"]
```

## Orientation and continuity

These skills are read-only. They can be used without disturbing the current phase.

| Skill | Starts from | Core flow | Output | Typical handoff |
|---|---|---|---|---|
| `/midas-status` | Any valid state | Read program counter and gate status | About six lines with one next command | Run the printed command |
| `/midas-help` | An intent, optionally current state | Ask one routing question | What, exact command, effect, when not, next | Run the selected command |
| `/midas-recall` | A resumed phase or sprint | Select the smallest useful context pack | Priority paths + a short current-state brief | Continue current work or use status |
| `/midas-reconcile` | Missing/confusing install, cwd, or version | Diagnose install orientation | One CLI or slash-command next step | Init, adopt, update, or status |

```mermaid
flowchart LR
  Confused["What is installed?"] --> Reconcile["/midas-reconcile"]
  Located["Where am I?"] --> Status["/midas-status"]
  Intent["Which command fits?"] --> Help["/midas-help"]
  Resume["What context matters?"] --> Recall["/midas-recall"]
  Reconcile --> Status
  Recall --> Status
```

## Sprint-day and investigation skills

These operate inside or beside the Phase-7 loop. They create evidence or improve work, but they do
not pass a phase gate.

| Skill | Starts from | Core flow | Leaves behind | State effect / handoff |
|---|---|---|---|---|
| `/midas-progress` | Long active sprint | Capture done work, proof, tools, observations, and next task | `{runs}/sprints/NN-progress.md` | Refreshes `last_touched`; continue |
| `/midas-verify` | Landed UI/API acceptance journeys | Drive the running product and inspect runtime health | `verify-NN.md` + screenshots | Sets `last_verification`; then close |
| `/midas-qa` | Branch or PR needing a quick smoke | Map the diff to affected screens and exercise them | Optional ad-hoc QA record | Fix or continue; never replaces verify |
| `/midas-explore` | Question outside the lifecycle path | Open an append-only investigation, gather notes, close it | `{runs}/explore/<slug>/` | May propose capture; stage unchanged |
| `/midas-capture` | A recurring, user-approved pattern | Classify as rule, playbook, or convention; amend or create | Project-owned durable guidance | Doctor after rule changes |
| `/midas-lean-review` | Diff or named paths | Rank delete, stdlib, native, YAGNI, and shrink findings | Optional `lean-NN.md` | Apply only after approval |
| `/midas-design` | UI that needs a stronger product identity | Audit, present three directions, obtain a choice, specify one | `design-NN.md`; optional one-slice implementation | Implement or verify; stage unchanged |
| `/midas-autopilot` | Optional `--autonomy` install + Phase 7 code tasks | Guide `setup` / `dry-run`; human runs `tick` CLI only | Journal + audit records under `{runs}/autonomy/` | One task per tick; never auto-invoked from chat |

Optional bounded loop (ADR-009) beside the manual sprint cycle:

```mermaid
flowchart LR
  Setup["midas-autopilot setup"] --> Dry["dry-run ready"]
  Dry --> Tick["tick --runner=fake|cursor-cloud"]
  Tick --> Dry
```

Requires `.harness/autonomy/` (`npx … --autonomy`). See `/midas-autopilot` and `.harness/autonomy/README.md`.

## Maintenance, setup, and standing audits

These skills either establish Midas, keep generated surfaces aligned, or produce optional evidence.
Except for intake/adoption placement, they do not advance lifecycle gates.

| Skill | Starts from | Core flow | Leaves behind | State effect / handoff |
|---|---|---|---|---|
| `/midas-init` | Installed but not initialized project | Scan → classify E0–E3 → prefill → confirm → generate | Writable `.harness/` layout and initial state | Sets `setup_complete`; routes by maturity |
| `/midas-adopt` | E2/E3 codebase | Inventory reality, infer architecture/rules, baseline audit, confirm wiring | Inventory, as-built architecture, debt, rules, baseline audit | Places E2 at rules; E3 at sprint planning |
| `/midas-update` | Installed engine version behind | Compare versions, preview migration, confirm, refresh engine | Updated engine/adapters and version stamp | Then doctor or status |
| `/midas-doctor` | Any installation | Check layout, routing, enforcement, gates, and adapter drift | Health report; optional regenerated managed files | Stage unchanged |
| `/midas-align` | Substantive engine/product change | Map diff to propagation surfaces, run the alignment ladder | Alignment or gap report; regenerated mirrors as needed | Stage unchanged |
| `/midas-sweep` | Any project, especially brownfield | Find dead flows, orphans, stale docs, and ledger drift | `sweep-NN.md`; optional approved safe fixes | Stage unchanged |
| `/midas-bundle` | Portable knowledge needed | Select profile, export/import, verify checksums, preview conflicts | Knowledge JSON or confirmed imported files | Stage unchanged by default |
| `/midas-tribunal` | A decision needs adversarial challenge | Argue opposing cases across evidence; independent judge rules | `debate-NN.md` | Informational; bridge actions back to work |
| `/midas-security-audit` | Code and architecture available | Threat-model, scan, rank, and route security findings | `security-NN.md` | Sets optional pointer; never passes a gate |
| `/midas-monorepo` | Legacy command | Redirect to the supported monorepo intake path | Same wiring as init when followed | Deprecated: use `/midas-init --monorepo` |

## Design seams worth reviewing

The flow map exposes a few deliberate seams that are useful when evolving the design:

1. **Production and judgment are separate.** Phase artifacts can be drafted cheaply; binding gates
   remain independent orchestrate-tier decisions.
2. **Only pipeline skills advance.** Verification, security, design, tribunal, sweep, and lean review
   inform a gate but never impersonate one.
3. **State stays small.** Long-form evidence lives under `{product}/` and `{runs}/`; state stores the
   program counter, ledgers, and pointers.
4. **Human choices are explicit.** Go/no-go, irreversible architecture, visual direction, rule
   amendments, deletions, and ship decisions have visible approval boundaries.
5. **The main complexity sits at handoffs.** The highest-value redesign questions are whether each
   skill has one unambiguous entry condition, one durable output, and one next-command contract.

When a skill changes, update this map only if its entry condition, state effect, durable output, or
handoff changes. Procedure-only edits belong in the skill itself and its pipeline playbook.
