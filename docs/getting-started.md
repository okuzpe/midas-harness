# Getting started

For the full authoritative install guide — flags, alternatives, and uninstall steps — see
**[INSTALL.md](https://github.com/okuzpe/midas-harness/blob/main/INSTALL.md)** in the repo. This
page is a quick-reference summary.

**Requirement:** Node.js >= 16.7 (`node -v` to check).

---

## Install (one command)

Run inside the project you want to add Midas to. It only adds files — it never deletes yours.

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
```

**Any platform, no shell script**
```bash
npx  github:okuzpe/midas-harness
pnpm dlx github:okuzpe/midas-harness
bunx github:okuzpe/midas-harness
```

All three forms run the same dependency-free Node installer.

---

## Alternatives

**Claude Code plugin marketplace**
```text
/plugin marketplace add okuzpe/midas-harness
/plugin install midas@midas
/midas-init
```

**Copy only (no installer logic)**
```bash
npx giget@latest gh:okuzpe/midas-harness ./my-project
```

---

## First steps

After installing, open the project in **Claude Code** (or Cursor) and run:

```text
/midas-init
```

This adaptive intake **scans what the project already has** (code, manifests, README, docs),
classifies its maturity (E0 empty → E3 mature), pre-fills what it can infer, asks only the genuine
gaps in one batched round, and writes `harness/state.yaml` plus the tool adapters (CLAUDE.md,
.cursor/rules/, GEMINI.md, etc.) — placing you at the right phase.

```text
/midas-status
```

Reads `harness/state.yaml` and prints the current phase and the single next action. Run this
anytime to orient or resume after a break.

---

## The lifecycle

Drive phases in order — each command runs when its predecessor's exit gate passes:

```text
/idea-intake          Phase 0 — capture the raw idea
/contextualize        Phase 1 — gap loop until zero blockers
/market-research      Phase 2 — validate against the real market
/business-plan        Phase 3 — go/no-go business case with measurable metrics
/choose-architecture  Phase 4 — pin the tech stack, one ADR per decision
/define-conventions   Phase 5 — freeze rules + design system (THE keystone)
/plan-sprints         Phase 6 — decompose MVP into dependency-ordered sprints
/start-sprint         Phase 7 — execute a sprint (the signature loop)
/close-sprint         Phase 8 — audit sprint against frozen rules; advance or ship
```

Run `/midas-tribunal` at any time for a whole-project adversarial debate.

For an existing codebase, `/midas-init` classifies it as **E2/E3** and runs `/midas-adopt` for you
(no need to call it manually). See the [Skills Reference](skills.md) for every command.
