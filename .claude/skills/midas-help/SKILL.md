---
name: midas-help
user-surface: primary
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
> **Surface filter (ADR-013):** AskQuestion options and Exact commands are **`user-surface: primary`
> only**. Do not offer `internal` (`progress`, `qa`, `diff-gates`, `lean-review`, `sweep`) or
> `deprecated` aliases (`update`, auto-pilot aliases) as menu choices — parents path-pass those;
> power-users may type them.

> **Response map (L3):** `./response-map.md` — after AskQuestion, load **only** the chosen option.

## Steps

1. **Ask once.** Use `AskQuestion` with ONE single-select. Options (copy labels exactly, this order):
   - **Set up or update Midas** (`/midas-init`)
   - **Start a product idea or adopt brownfield** (`/idea-intake` / `/midas-adopt`)
   - **Resume after a break** (`/midas-status` + `/midas-recall`)
   - **Run the next phase gate** (phase skills 0–8)
   - **Start or close a sprint** (`/start-sprint` / `/close-sprint` / `/midas-auto-pilot` / `/midas-retro`)
   - **Debug a failing fix** (`/midas-investigate`)
   - **Autonomy / auto-pilot** (`/midas-auto-pilot`)
   - **Verify UI before close** (`/midas-verify`)
   - **Clean dead flows / lean the repo** (`/midas-hygiene`)
   - **Redesign product UI** (`/midas-design`)
   - **Security or adversarial review** (`/midas-security-audit` / `/midas-tribunal`)
   - **Capture a recurring pattern** (`/midas-capture`)
   - **Export or import project knowledge** (`/midas-bundle`)
   - **Install confusion / adapter health** (`/midas-reconcile` / `/midas-doctor`)
   - **Investigate something outside the pipeline** (`/midas-explore`)
   - **I'm not sure — show a short summary table**

2. **Answer ≤15 lines** with this fixed structure:
   1. **What** (1 sentence)
   2. **Exact command** (placeholders in `<…>` — primary slash only)
   3. **What happens** (2–3 bullets)
   4. **When NOT** (1 line)
   5. **Next** (usual follow-up command)
   Load the matching heading from `./response-map.md` and copy **only that option**.

## Rules

- One `AskQuestion` only — do not chain.
- Do not paste the full midas-status stage table unless the user needs a phase gate name.
- If the chosen option needs a prerequisite (e.g. verify needs a UI sprint), say so in When NOT.
- Never list deprecated aliases (`/midas-improve-loop`, `/midas-autopilot`, `/midas-auto-sprints`, `/midas-update`) as Exact command.

## Tier & delegation
- **Dispatch (read-only):** `scout` → `midas-scout` (or fastest session model).
- Never writes state or artifacts; never renders a gate verdict.
- Respect `cost_profile` as intent on non-Claude hosts.
