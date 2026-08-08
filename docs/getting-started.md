# Getting started

For the full authoritative install guide — flags, alternatives, and uninstall steps — see
**[INSTALL.md](https://github.com/okuzpe/midas-harness/blob/main/INSTALL.md)** in the repo. This
page is a quick-reference summary.

**Requirement:** Node.js >= 22 (`node -v` to check).

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

To **pin a release**, copy the exact `#v…` command from [INSTALL.md](../INSTALL.md)
(matches `harness/VERSION` — do not invent the tag).

**Not sure which command to run?** (install vs update vs init)

```bash
npx github:okuzpe/midas-harness --diagnose
```

Read-only — prints install state and the single next CLI or slash command. After install, use `/midas-reconcile` in your editor for the same check.

**Cursor-only** (skills + rules + MCP):
```bash
npx github:okuzpe/midas-harness --tools=cursor
```

**Cursor + Gemini + Codex** (multi-tool stack — installer prints per-tool onboarding):
```bash
npx github:okuzpe/midas-harness --tools=cursor,gemini,codex
```

On a TTY the installer shows a **compatibility matrix** and accepts presets (`c` = cursor, `s` = cursor,gemini,codex, `a` = all adapters). Piped installs default to all adapter tools.

---

## Alternatives

**Claude Code plugin marketplace** (clone the repo first)
```text
/plugin marketplace add ./harness
/plugin install midas@midas
/midas-init
```

**Copy only (no installer logic)**
```bash
npx giget@latest gh:okuzpe/midas-harness ./my-project
```

---

## First steps

After installing, open the project in **Claude Code**, **Cursor**, or your chosen tool and run:

```text
/midas-init
```

This adaptive intake **scans what the project already has** (code, manifests, README, docs),
classifies its maturity (E0 empty → E3 mature), pre-fills what it can infer, asks only the genuine
gaps in one batched round, and writes the state file (`.harness/state.yaml`) plus the selected host adapters (`.claude/CLAUDE.md`,
.cursor/rules/, GEMINI.md, etc.) — placing you at the right phase.

```text
/midas-status
```

Reads `paths.state` and prints the current phase and the single next action. Run this
anytime to orient or resume after a break.

**After editing rules, skills, or conventions**, re-sync tool adapters:

```text
/midas-doctor
```

**After substantive harness or installer edits** (VERSION bump, new skills, bundle sources), run the
full propagation pass so generated trees, version pins, and docs stay aligned:

```text
/midas-align
```

Engine repo contributors can use `npm run align` instead. See `harness/rules/change-propagation.md`.

**Observe a Cursor Agent turn** (installs ≥2.8.0 with `tools: [cursor]`): after the agent uses tools,
run `node .harness/scripts/trace-inspect.mjs list` then `… <run-id>` (ADR-011). Engine contributors:
`npm run trace:inspect -- list`.

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

After a sprint lands, optional non-advancing commands: `/midas-retro` (freeze learnings),
`/midas-sweep` (hygiene), `/midas-auto-pilot` (continuous evolve; arms Cursor `/loop`),
`/midas-auto-sprints` (ADR-009 sprint checklist ticks; needs `--autonomy`).
Do not confuse `/midas-auto-pilot` (product evolve) with `/midas-auto-sprints` (checklist ticks)
or the CLI `midas-autopilot.mjs` (same ADR-009 controller). See [skills.md](skills.md)
§ Autonomy commands (anti-typo table).

For an existing codebase, `/midas-init` classifies it as **E2/E3** and runs `/midas-adopt` for you
(no need to call it manually). Run `/midas-adopt --preflight` first for a read-only fit report.
See the [Skills Reference](skills.md) for every command.

### Brownfield step-by-step

1. Install Midas into the repo root (not a subfolder).
2. Run `/midas-adopt --preflight` — review what will change.
3. Run `/midas-adopt` — inventory, as-built architecture, rules from real code, baseline audit file.
4. Run `/define-conventions` — **freeze** rules + design system (adopt = draft; define = freeze + CHECKs).
5. `/plan-sprints` → `/start-sprint` → `/close-sprint` loop.

**Incremental adoption:** adopt one rule pack at a time (start with `folder-structure.md`) if a full
adopt feels heavy; record deferred packs as assumptions in `paths.state`.

### Lite track

For hackathons/prototypes, choose `track: lite` during `/midas-init` — see `harness/pipeline/lite.md`.

---

## UI verification (web and mobile)

Phase 7 uses `/midas-verify` to prove acceptance criteria in a running app (verification ladder rung 4 in
`harness/rules/verification.md`). **UI journeys do not require** an `e2e/` folder in the product — evidence
freezes to `{runs}/verifications/verify-NN.md`.

### Web (preferred: agent-browser CLI)

1. Install [agent-browser](https://github.com/vercel-labs/agent-browser) (`npm i -g agent-browser` or per project docs).
2. Optionally uncomment **Playwright** and **Chrome DevTools** in `.mcp.json` for MCP fallback and runtime health.
3. Run `/midas-verify` (or `/midas-verify --scope web`) before `/close-sprint`. Use device profiles
   (`iPhone 14`, `Pixel 7`) in the verify record's **Device profiles** section.

### Native / hybrid mobile

When `architecture.md` declares React Native, Flutter, or Capacitor:

1. Install [Maestro CLI](https://maestro.dev) and approve wiring **Maestro MCP** in `.mcp.json` (`maestro` + `args: ["mcp"]`).
2. Run `/midas-verify --scope mobile` or `--scope all`. Native flows use **inline YAML** via Maestro MCP — no test files in `{product}/` by default.
3. Windows: Android emulator + Maestro. iOS Simulator / real Safari: macOS only (`agent-browser -p ios` or Maestro iOS).

### Ad-hoc QA during the sprint

`/midas-qa` exercises changed routes on the current branch (agent-browser / Maestro). Optional evidence:
`{runs}/qa/qa-adhoc-*.md` — does **not** replace `/midas-verify` at sprint close.

`node <paths.scripts>/doctor.mjs` warns if `state.yaml → mcp:` declares servers not present in `.mcp.json`.
API-only projects: use the test runner; skip browser/mobile tooling.
