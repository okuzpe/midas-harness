---
name: midas-help
description: Interactive intent→command guide — one AskQuestion, then What/Exact command/What happens/When NOT/Next for that option only. Use on /midas-help or when the user asks which Midas command to run. Distinct from /midas-status (pipeline PC).
user-invocable: true
disable-model-invocation: false
model: inherit
harness-tier: scout
recommended-model: claude-haiku-4-5
---

# midas-help — intent → one command

> **Paths / state:** `<paths.engine>/templates/skill-state-ritual.md` (read-only) + `AGENTS.md` § Path resolution.

> **Read-only.** Never writes, never advances gates. Complements `/midas-status` (pipeline PC).
> **Canonical catalog + router:** `docs/skills.md` (install: `<paths.engine>/docs/skills.md`) — cite it;
> do not paste the full situation→command table unless the user picks "I'm not sure".
> **Flow shape (handoffs, not commands):** `docs/skill-flows.md` (install:
> `<paths.engine>/docs/skill-flows.md`) — cite when the user asks how skills connect; commands still
> come from `docs/skills.md` or `/midas-status`.

## Steps

1. **Ask once.** Use `AskQuestion` with ONE single-select. Options (copy labels exactly, this order):
   - **Start or set up a product** (`/midas-init` / `/idea-intake` / `/midas-adopt`)
   - **Resume after a break** (`/midas-status` + `/midas-recall`)
   - **Run the next phase gate** (phase skills 0–8)
   - **Start or close a sprint** (`/start-sprint` / `/close-sprint` / `/midas-autopilot`)
   - **Continuous improve loop** (`/midas-improve-loop`)
   - **Verify UI / ad-hoc QA** (`/midas-verify` / `/midas-qa`)
   - **Redesign product UI** (`/midas-design`)
   - **Security or adversarial review** (`/midas-security-audit` / `/midas-tribunal`)
   - **Capture a pattern or sweep hygiene** (`/midas-capture` / `/midas-sweep` / `/midas-lean-review`)
   - **Install / version / adapter health** (`/midas-reconcile` / `/midas-doctor` / `/midas-update`)
   - **Investigate something outside the pipeline** (`/midas-explore`)
   - **I'm not sure — show a short summary table**

2. **Answer ≤15 lines** with this fixed structure:
   1. **What** (1 sentence)
   2. **Exact command** (placeholders in `<…>`)
   3. **What happens** (2–3 bullets)
   4. **When NOT** (1 line)
   5. **Next** (usual follow-up command)

### Response map

**Start or set up a product**
- What: one-time adaptive setup, or Phase 0 idea capture, or brownfield adopt.
- Command: `/midas-init` · greenfield idea → `/idea-intake` · existing code → `/midas-adopt`
- Happens: scans maturity, pre-fills artifacts, places you at the right `stage`.
- NOT if you only need orientation → `/midas-status` or `/midas-reconcile`.
- Next: `/midas-status` then the phase skill it names.

**Resume after a break**
- What: cheap PC + optional context pack.
- Command: `/midas-status` then `/midas-recall` if mid-phase or `last_touched` > 7 days.
- Happens: status prints the single next command; recall lists ~15 paths + a 30-line brief.
- NOT if install is broken → `/midas-reconcile` first.
- Next: the command status names.

**Run the next phase gate**
- What: advance one audited phase (0–8).
- Command: `/midas-status` names it; catalog in `docs/skills.md` § Pipeline.
- Happens: skill writes its artifact, updates `paths.state`, waits for human gate confirmation.
- NOT for ad-hoc investigation outside the pipeline → `/midas-explore`.
- Next: `/midas-status` again after the gate.

**Start or close a sprint**
- What: Phase 7 kickoff, Phase 8 audit, or bounded autopilot (one task per tick).
- Command: `/start-sprint` · `/close-sprint` · `/midas-autopilot` → `node .harness/autonomy/bin/midas-autopilot.mjs setup`
- Happens: start activates sprint; close audits rules; autopilot runs setup/dry-run/tick CLI (requires `--autonomy` install).
- NOT for operator-only sprint tasks (release/merge) — ADR-009 autopilot targets code checklist items. NOT for inventing continuous improve without a checklist → `/midas-improve-loop`.
- Next: after start → implement + `/midas-progress`; autopilot ready → human runs `tick`; after close → next sprint.

**Continuous improve loop**
- What: one slash starts continuous product-aligned improve (discover → one fix → verify → PR) via local Cursor `/loop`.
- Command: `/midas-improve-loop` (default local) · `/midas-improve-loop cloud` for Cursor Automations · `/midas-improve-loop stop` to halt.
- Happens: validates context; writes `{runs}/improve-loop/runbook.md`; runs tick #1; arms `/loop` (default 30m).
- NOT the ADR-009 policy plane (`/midas-autopilot`); NOT Phase-8 (`/close-sprint`). Laptop sleep → use `cloud` mode.
- Next: leave Cursor open; review PRs; `/close-sprint` when a sprint’s worth lands. Command map: `docs/skills.md` § Autonomy commands.

**Verify UI / ad-hoc QA**
- What: gate evidence vs inner-loop smoke.
- Command: `/midas-verify` (before close) · `/midas-qa` (branch/PR, non-gate)
- Happens: drives flows, freezes `{runs}/verifications/verify-NN.md` or optional `{runs}/qa/`.
- NOT for non-UI sprints (verify hard-skips).
- Next: `/close-sprint` when verify is green.

**Redesign product UI**
- What: authentic redesign with directions + human pick before implementation.
- Command: `/midas-design` [`--mode audit|directions|spec|implement`]
- Happens: audits current UI, proposes art directions, freezes a design record; optional one-slice implement.
- NOT Phase 5 freeze → `/define-conventions`; NOT gate proof → `/midas-verify`.
- Next: `/midas-verify` on the touched surface when implementing.

**Security or adversarial review**
- What: deep security scan or whole-project debate — neither advances gates.
- Command: `/midas-security-audit` · `/midas-tribunal`
- Happens: freezes `{runs}/security/` or `{runs}/debates/debate-NN.md`.
- NOT a substitute for `/close-sprint` sprint conformance.
- Next: fix findings; then `/close-sprint` when ready.

**Capture a pattern or sweep hygiene**
- What: crystallize a rule/playbook, find dead flows, or cut over-engineering.
- Command: `/midas-capture` · `/midas-sweep` [`--fix` only after confirm] · `/midas-lean-review` [`--freeze`]
- Happens: capture proposes an artifact (asks first); sweep freezes `{runs}/sweeps/sweep-NN.md`; lean-review prints a delete-list (optional `{runs}/lean/lean-NN.md`).
- NOT for one-off preferences with no CHECK → say so and skip. Lean-review is not a security audit.
- Next: `/midas-doctor` if a rule changed; apply lean cuts only after user OK.

**Install / version / adapter health**
- What: orientation, adapter drift, or engine upgrade.
- Command: `/midas-reconcile` · `/midas-doctor` · `/midas-update` · `/midas-align` (engine edits)
- Happens: prints next CLI/slash command, re-renders adapters, or migrates version.
- NOT for product work mid-sprint → `/midas-status`.
- Next: the command reconcile/doctor names.

**Investigate outside the pipeline**
- What: multi-turn notes session that does not advance phases.
- Command: `/midas-explore <topic>` · `/midas-explore --end`
- Happens: writes `{runs}/explore/<slug>/notes.md`; end may propose `/midas-capture`.
- NOT when a sprint is `active` and you should implement → finish or pause sprint first.
- Next: `/midas-capture` or a phase skill if findings justify it.

**I'm not sure — short summary**

Print the **canonical router** from `docs/skills.md` § Which command when (install:
`<paths.engine>/docs/skills.md`) — do not invent rows. End with: Pipeline PC = `/midas-status`.

## Rules

- One `AskQuestion` only — do not chain.
- Do not paste the full midas-status stage table unless the user needs a phase gate name.
- If the chosen option needs a prerequisite (e.g. verify needs a UI sprint), say so in When NOT.

## Tier & delegation
- **Dispatch (read-only):** `scout` → `midas-scout` (or fastest session model).
- Never writes state or artifacts; never renders a gate verdict.
- Respect `cost_profile` as intent on non-Claude hosts.
