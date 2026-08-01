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

> **Read-only.** Never writes, never advances gates. Complements `/midas-status` (pipeline PC) and
> `docs/skills.md` (static catalog) — this skill is **AskQuestion → one answer**, not a pasted table.

## Steps

1. **Ask once.** Use `AskQuestion` with ONE single-select. Options (copy labels exactly, this order):
   - **Start or set up a product** (`/midas-init` / `/idea-intake` / `/midas-adopt`)
   - **Resume after a break** (`/midas-status` + `/midas-recall`)
   - **Run the next phase gate** (phase skills 0–8)
   - **Start or close a sprint** (`/start-sprint` / `/close-sprint`)
   - **Verify UI / ad-hoc QA** (`/midas-verify` / `/midas-qa`)
   - **Security or adversarial review** (`/midas-security-audit` / `/midas-tribunal`)
   - **Capture a pattern or sweep hygiene** (`/midas-capture` / `/midas-sweep`)
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
- Command: `/midas-status` names it; or `/idea-intake` … `/close-sprint` from `docs/skills.md`.
- Happens: skill writes its artifact, updates `paths.state`, waits for human gate confirmation.
- NOT for ad-hoc investigation outside the pipeline → `/midas-explore`.
- Next: `/midas-status` again after the gate.

**Start or close a sprint**
- What: Phase 7 kickoff or Phase 8 conformance audit.
- Command: `/start-sprint` · `/close-sprint`
- Happens: start activates the sprint + progress log; close audits rules, freezes `{runs}/audits/audit-NN.md`.
- NOT for UI proof alone → `/midas-verify` before close.
- Next: after start → implement + `/midas-progress`; after close → next sprint or ship.

**Verify UI / ad-hoc QA**
- What: gate evidence vs inner-loop smoke.
- Command: `/midas-verify` (before close) · `/midas-qa` (branch/PR, non-gate)
- Happens: drives flows, freezes `{runs}/verifications/verify-NN.md` or optional `{runs}/qa/`.
- NOT for non-UI sprints (verify hard-skips).
- Next: `/close-sprint` when verify is green.

**Security or adversarial review**
- What: deep security scan or whole-project debate — neither advances gates.
- Command: `/midas-security-audit` · `/midas-tribunal`
- Happens: freezes `{runs}/security/` or `{runs}/debates/debate-NN.md`.
- NOT a substitute for `/close-sprint` sprint conformance.
- Next: fix findings; then `/close-sprint` when ready.

**Capture a pattern or sweep hygiene**
- What: crystallize a rule/playbook, or find dead flows.
- Command: `/midas-capture` · `/midas-sweep` [`--fix` only after confirm]
- Happens: capture proposes an artifact (asks first); sweep freezes `{runs}/sweeps/sweep-NN.md`.
- NOT for one-off preferences with no CHECK → say so and skip.
- Next: `/midas-doctor` if a rule changed.

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

| Need | Command |
|---|---|
| Where am I? | `/midas-status` |
| Resume context | `/midas-recall` |
| Setup / adopt | `/midas-init` · `/midas-adopt` |
| Install confusion | `/midas-reconcile` |
| Ad-hoc investigate | `/midas-explore` |
| This guide | `/midas-help` |

Full catalog: `docs/skills.md`. Pipeline PC: `/midas-status`.

## Rules

- One `AskQuestion` only — do not chain.
- Do not paste the full midas-status router table unless the user picked "I'm not sure".
- If the chosen option needs a prerequisite (e.g. verify needs a UI sprint), say so in When NOT.
