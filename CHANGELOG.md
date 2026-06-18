# Changelog

All notable changes to Midas are documented in this file.

Format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/).
Versioning follows [SemVer](https://semver.org/) as defined in [`VERSIONING.md`](./VERSIONING.md).

---

## [Unreleased]

_Nothing yet._

---

## [0.5.12] — 2026-06-18

### Added — `/midas-capture` + an always-on "capture recurring patterns" loop
When you ask for the same thing repeatedly, that preference should become part of the project's standards,
not live in chat. New behavior + skill, *recommend-don't-wall*:

- **Always-on detection (in `AGENTS.md`):** across any phase, when the user asks for the same thing ~2-3×
  (or corrects the agent the same way), the agent **pauses and proposes** codifying it — it asks first,
  never writes silently.
- **`/midas-capture`** (new skill) does the codification via a **rubric** that answers "rule or skill?":
  a **constraint/preference** → a **rule** (`harness/rules/*`, with a `**CHECK:**`, re-rendered + linter-
  enforced); a **procedure** → a **playbook** (`product/playbooks/*`); a **prose preference** →
  `product/conventions.md`. A per-project pattern is a rule/playbook/convention — **not** a new
  slash-command. It amends an existing artifact over creating a near-duplicate, and logs the capture.
- Captures land in the **visible project artifacts you review in git** — consistent with Midas's
  *no hidden memory / no runtime* rule. Gated (`disable-model-invocation`), user-typed; also invokable manually.

Wired into the never-auto-invoke list (AGENTS.md + template + orchestrator) and `docs/skills.md`.

### Engine
- Version single-sourced to `0.5.12` (`harness/VERSION` + all mirrors).

---

## [0.5.11] — 2026-06-18

### Added — Phase 5 now scaffolds the enforcement tooling (makes the CHECKs real on every commit)
The rules referenced linters in their CHECKs (`eslint max-lines-per-function`, `gitleaks`…) — but Midas
never actually set up a linter, hooks, or CI. So the CHECK assumed a mechanism the project never had; it
was only graded by hand at Phase 8 (or never). New **Step 5** in `/define-conventions` closes the loop,
*recommend-don't-wall*:

- Generates the **stack-standard linter + formatter** (ESLint+Prettier / Biome / Ruff) **wired to the
  rules** — not a generic preset; where a `harness/rules/*` item maps to a lint rule, the config is its
  machine-readable form.
- Adds **git hooks** (Husky / lefthook / pre-commit) + **lint-staged** (lint+format on the staged diff),
  **commit-msg lint** aligned with `git-commits.md`, and a **CI lint job**.
- **Generates the configs first, shows them, then asks** (`AskUserQuestion`) whether to install — on yes,
  runs the install; on no, leaves the configs and prints the exact command. Only the install is gated;
  nothing is ever a hard dependency. Each tool Context7-verified at its current version.

Turns each rule's CHECK from "someone grades it at Phase 8" into "blocked at every commit". The skill exit
gate and the `harness/pipeline/5-architecture-rules.md` guide were updated together (no skill-vs-guide drift).

### Engine
- Version single-sourced to `0.5.11` (`harness/VERSION` + all mirrors).

---

## [0.5.10] — 2026-06-18

### Added — `/midas-security-audit`: a deep, standard-grounded security audit
A dedicated security audit skill (the security analog of `/midas-tribunal`), grounded in what the market
actually treats as the standard in 2026 — not vibes:

- **OWASP ASVS 5.0** (2025) as the verification checklist, at the **L1/L2/L3** level recommended from the
  product's data sensitivity (`--level` overrides; recommend-don't-wall).
- **OWASP Top 10** risk lenses, plus the **OWASP LLM Top 10 (2025) + Agentic AI Top 10** added
  automatically when the product is AI-bearing (prompt injection, system-prompt leakage, RAG poisoning,
  excessive agency, …).
- **STRIDE** threat-models the architecture's trust boundaries.
- **Runs the tools that exist, recommends the ones that don't** (no hard dependency): Semgrep (SAST),
  `npm/pnpm/pip audit` (SCA / dependency CVEs), `gitleaks` (secrets). Current usage fetched via Context7.
- Prefers an installed specialist (`voltagent-qa-sec:security-auditor` / `penetration-tester`, Anthropic
  `/security-review`); otherwise the first-party tiers.
- Freezes a ranked, evidence-cited report to `.harness/security/security-NN.md` with a gate-parseable
  `MIDAS_SECURITY_RESULT` tally; proposes a findings→action bridge. **Non-advancing** — it informs;
  `/close-sprint` and the human decide. Gated (`disable-model-invocation`), user-typed.

Complements (does not replace) the always-on `harness/rules/security.md` floor and the `/midas-tribunal
security` debate lens. Wired into the schema (`last_security` pointer), the never-auto-invoke list, the
README Advanced track, and `docs/skills.md`.

### Engine
- Version single-sourced to `0.5.10` (`harness/VERSION` + all mirrors).

---

## [0.5.9] — 2026-06-18

### Changed — Phase 4 now recommends the industry standard and lets the user choose the stack
`/choose-architecture` already proposed 2–3 candidates per layer and documented alternatives in the ADRs —
but the agent **decided** and the human only signed off *passively* at the gate. That made the stack the one
irreversible decision Midas never actively put to the user (market-research, business-plan, and design-direction
all ask). New **Step 3** closes it, in the *recommend-don't-wall* shape:

- For each consequential layer, name the **current industry-standard default for this kind of product** —
  what teams actually reach for today, grounded in current docs (Context7 / the library's own site), not
  memory — with a one-line *why it's the default*.
- **Ask the user via `AskUserQuestion`** which they want, recommended option marked, each with a short
  trade-off. **No preference → the recommendation stands** (never a block); an **override** is the user's
  call and is recorded in that decision's ADR as a human decision. Only the chosen options get version-pinned.
- Scoped to the **few decisions that matter** — no quizzing on every minor library.
- The Phase-4 exit gate and the `harness/pipeline/4-tech-architecture.md` guide were updated to match (no
  skill-vs-guide drift).

### Engine
- Version single-sourced to `0.5.9` (`harness/VERSION` + all mirrors).

---

## [0.5.8] — 2026-06-18

### Fixed — internal-alignment audit (6 real consistency gaps, all pre-existing)
A whole-harness alignment audit (4 parallel auditors over state-machine / rules↔audit / distribution /
docs↔reality) found six places where the harness contradicted itself. Distribution came back clean; the
rest are fixed here:

- **`product/conventions.md` was mandated everywhere but written nowhere** (the big one). The Phase-5
  pipeline guide, the exit gate, and the precedence chain in ~22 files all treat `product/conventions.md`
  as a real override layer — but the operative `/define-conventions` skill never created it. The skill now
  writes it (stack-specific prose overrides of `harness/conventions.md`) and gates on it.
- **`/midas-status` now names the real commands for Phases 2–3.** It was emitting vague phrases
  ("the market-research phase") instead of `/market-research` and `/business-plan`, contradicting its own
  "map to exactly one typeable command" contract. `/contextualize`'s hand-off was reworded to match.
- **`/midas-update` added to the never-auto-invoke list** (AGENTS.md + the template + the orchestrator
  agent). It is side-effecting and `disable-model-invocation: true` like the other nine, but was missing
  from the enumeration — exactly the omission that lets an agent try to auto-run a gated ritual.
- **`last_tribunal` / `last_verification` are now documented in `state.schema.md`.** `/midas-tribunal` and
  `/midas-verify` told the consumer to set them "per schema", but the schema only defined `last_audit`.
- **`/close-sprint` now loads the artifacts its rule CHECKs grade against** — `product/architecture.md`,
  `product/idea.md`, and `product/conventions.md` (the code-quality/testing/security/naming CHECKs cite
  module boundaries + the glossary, which weren't in the load list).
- **README Gemini row corrected** from "via extensions" to "context only (no skills)" — the
  `gemini-extension.json` manifest is repo-only (not in the installer's file set), so an installed project
  gets the `GEMINI.md` context adapter, not skills.

### Engine
- Version single-sourced to `0.5.8` (`harness/VERSION` + all mirrors).

---

## [0.5.7] — 2026-06-18

"Make design real." Design output kept coming out generic. The fix isn't a magic agent — it's a
**concrete anchor wired into the phases that build and audit the UI**, plus a **floor the audit
actually grades**. All faithful to Midas's *recommend-don't-wall* discipline.

### Added
- **`harness/rules/accessibility.md` — a frozen, CHECK-bearing accessibility & design floor** (always-on,
  replaces soft prose). The Phase-8 audit now grades WCAG 2.1 AA contrast, visible focus, reduced-motion,
  text alternatives, target size, and **design-system fidelity** (no hardcoded colour/spacing in component
  code; the UI traces to the named references) — each with a concrete portable `**CHECK:**`, like
  `testing.md`. Scoped: headless/backend-only projects mark each CHECK `N/A (no UI)`. `/close-sprint`
  already audits every `harness/rules/*`, so it's picked up automatically.

### Changed
- **The design-direction is now a real gate with a conscious default.** `/define-conventions` still asks the
  human for ≥2 real reference products first. But an AI-only founder with no design taste no longer falls back
  to bland "Tailwind-default": the agent **proposes ≥2 concrete, named, domain-appropriate references itself**,
  records them in `product/design-direction.md` marked **`assumed (confirm)`**, and surfaces them for a one-tap
  confirmation. A *concrete* anchor is mandatory; *who* supplies it is not — but a generic/empty direction is a
  **fail**. (Same required/deferrable-with-assumption shape as Phase-3 validation.)
- **The anchor is now wired to the producer and the auditor** (without this the gate was half-theater):
  `/start-sprint` loads `product/design-direction.md` for any UI sprint and instructs the build tier to build
  *to* the named references/mood/anti-references, not just to the tokens; `/close-sprint` loads it as the
  evidence the design-fidelity CHECK grades against.

### Notes
- On `--update`, an existing UI project sees the new a11y/design-fidelity CHECKs graded on its **next**
  sprint audit (not retroactively — frozen audit records are never rewritten), so this stays an additive
  patch. A previously-passing UI with inline hex or no focus ring will surface those on its next Phase 8.
- The `voltagent` design/security specialists remain **optional preference-if-installed**, never a
  dependency — Midas degrades cleanly to its own three tiers, and everything stays anchored to the
  human (or `assumed`) direction.
- Deliberately deferred (cosmetic, and it would rewrite a frozen audit record): realigning the
  `examples/taskpilot` tokens from `--color-*` to the starter's `--ds-*` namespace.

### Engine
- Version single-sourced to `0.5.7` (`harness/VERSION` + all mirrors).

---

## [0.5.6] — 2026-06-18

### Added — a real one-command update: `--update`
A plain `--force` re-install left `harness/state.yaml`'s `midas_version` stale (so `/midas-doctor` then
warned). The new flag does it properly:

```bash
npx github:okuzpe/midas-harness#v0.5.6 --update   # or omit #vX.Y.Z for the latest main
```

- Refreshes the engine to the new version, **keeps your work** (`product/`, `.harness/`, `harness/state.yaml`),
  **bumps the `midas_version` stamp** so status/doctor read it as current, and re-renders the adapters.
- Honest heads-up in the output: it overwrites engine files, so if you consciously amended a rule, review
  `git diff` and re-apply your `## Amendment`. Documented in `INSTALL.md` and `--help`.

### Engine
- Version single-sourced to `0.5.6` (`harness/VERSION` + all mirrors).

---

## [0.5.5] — 2026-06-18

### Fixed — "make the gate real" (top fixes from a 13-lens scored audit; weighted 7.5 → ~8.0)
A whole-project scored audit (13 expert lenses) put Midas at an honest **7.5/10** and flagged that the
flagship "check outside the model" was real in code but **not proven to fire**. This release closes that.
- **`/midas-doctor` can now check any project + enforce, not just warn.** It accepts a project-root arg
  (`node scripts/doctor.mjs path/to/project`) so the gate-records check runs on a real install (not only
  the engine repo), and a **`--strict`** flag promotes a `gate:*` inconsistency to a non-zero exit. It also
  catches a **self-inconsistent** record (`verdict=pass` with `unresolved>0`).
- **First behavioral tests.** `scripts/fixtures/{inconsistent,consistent}-audit` + `scripts/test.mjs`
  (section K) run the real doctor and assert the gate **fires** on a planted `done`-sprint-with-unresolved-CRITs
  record and **stays quiet** when clean — the first test that proves a guardrail *works*, not just that files parse.
- **`audit`-stage contradiction resolved.** `state.schema.md` + the `close-sprint`/`start-sprint`
  descriptions now agree: the top-level `stage` is never `audit` (Phase 8 runs in place during
  `sprint_execution`); the `phases.audit` ledger entry just *names* the phase.
- **`audit-07-NN.md` → `audit-NN.md`** in `7-sprint-execution.md` (it broke the doctor regex).
- **Stale `.mcp.json` docs fixed** (Context7 was made optional in v0.5.0): `SECURITY.md` + `INSTALL.md` now
  say one default server (`sequential-thinking`). Added a `test.mjs` check that prose `#vX.Y.Z` pins match `harness/VERSION`.

### Added
- The phase-advancing rituals are clearly marked **user-typed slash commands**: agents must **never call them
  via the Skill tool** (it errors) — surface the command for the user to type. (AGENTS.md, the orchestrator
  agent, `/midas-status`.)

### Engine
- Version single-sourced to `0.5.5` (`harness/VERSION` + all mirrors); test suite now **140 checks**.

---

## [0.5.4] — 2026-06-18

### Added — a design direction step, so the UI isn't generic
From real-project feedback: AI-generated design defaults to bland, "Tailwind-default" output because it has
no anchor — a design *system* (tokens) buys consistency, not originality. Phase 5 now sets the **aesthetic
intent first**, then builds the tokens to it.
- New `product/design-direction.md` (template + gate item): captured **from the human** (your taste is the
  input) — brand personality, **2–3 real products to emulate** (+ what to borrow), mood keywords, and
  **anti-references** (what to avoid). `/define-conventions` asks for it before generating tokens, and every
  token choice traces to it. Prefers a design specialist (`voltagent-core-dev:ui-designer`/`design-bridge`)
  if installed; otherwise the build tier, always anchored to the direction.
- **Design critique wired in:** `/midas-verify` now judges rendered UI against the direction (distinctive &
  on-direction vs generic, not just token-consistent), and `/midas-tribunal` gains a **Design Critic** lens +
  a `design` target.
- Worked example: `examples/taskpilot/product/design-direction.md` (Linear / Things references).
- **Honest limit:** this kills *generic*; *original* still needs your taste + a strong reference — the
  direction is an explicit human input, not something the AI invents.

### Engine
- Version single-sourced to `0.5.4` (`harness/VERSION` + all mirrors).

---

## [0.5.3] — 2026-06-18

### Added — `/midas-tribunal` now has recommended checkpoints in the flow
The whole-project adversarial debate was a "run it any time" tool with no anchor, so it was easy to skip
and unclear *when* it pays off. It now has a **space in the flow** — recommended, optional, **non-advancing**
(a prompt, not a gate; it stays cost-aware, since it's a multi-agent Opus debate):
- `/midas-status` surfaces a *"💡 consider `/midas-tribunal` first"* line at three high-leverage transitions:
  **pre-go/no-go** (Phase 3), **pre-rules-freeze** (Phase 4→5, before `/define-conventions`), and **pre-ship**
  (final sprint, before declaring MVP complete).
- Those checkpoints are formalized in `methodology.md` and noted in the relevant skills
  (`business-plan`, `define-conventions`, `close-sprint`, `midas-tribunal`).
- Running or skipping is always the human's call — never a block.

### Engine
- Version single-sourced to `0.5.3` (`harness/VERSION` + all mirrors).

---

## [0.5.2] — 2026-06-17

### Fixed — the adaptive-intake scan no longer surfaces benign "not found" as errors
From real-project use (a 303-file Python+Dart repo): `/midas-init`'s Phase-A scan was producing
fragile shell probes that reported `Error: Exit code N` on benign conditions — an `&&`-chain aborting
when one sub-probe missed, and `command -v go/flutter/dart` returning non-zero simply because those
toolchains weren't installed on the machine.
- `/midas-init`, `/midas-adopt`, and `0b-codebase-inventory` now instruct a **robust scan**: classify
  from the **repo's files** (manifests/source/tests/CI), not from locally-installed toolchains (a
  sandbox/CI box may lack them); prefer Glob/Grep/Read; run probes **independently** and **swallow benign
  failures** (`… || true`) so a missing dir, empty glob, or absent tool reads as data, not an error.

### Engine
- Version single-sourced to `0.5.2` (`harness/VERSION` + all mirrors).

---

## [0.5.1] — 2026-06-17

### Changed — validation is now two-tier (so an AI-only founder isn't hard-walled)
From real-project feedback: the lifecycle was letting the AI invent a hard "go interview N people +
preorders" gate that blocks a founder whose only tool is the AI. Validation is now explicitly split:
- **Desk validation (Phase 2 `/market-research`) — the AI does it, required.** Market-research now gathers
  **demand signals** (competitor traction/reviews, complaints, search/community interest, willingness-to-pay)
  and ends in a frank **demand verdict** (strong/mixed/weak), not just a competitor list. It states plainly
  what the desk can prove (a market exists) and cannot (that *these* customers pay).
- **Field validation (Phase 3 `/business-plan`) — strongest evidence, recommended, but deferrable.** Customer
  interviews / a real preorder / a paid-ad test are strongly recommended; if not feasible now they may be
  **deferred with a logged assumption** ("real-customer demand unproven"), re-surfaced before launch/scale.
  The go/no-go gains a **GO-with-field-validation-deferred** verdict — the founder's informed risk call, not a wall.
- New `## Demand signals` (`market.md`) and `## Validation status` (`business-plan.md`) template sections +
  gate items. Also fixed a stale `/midas-tech-architecture` → `/choose-architecture` pointer in the template.

### Engine
- Version single-sourced to `0.5.1` (`harness/VERSION` + all mirrors).

---

## [0.5.0] — 2026-06-17

> **Breaking (pre-1.0 minor).** Context7 is no longer a bundled/mandatory dependency. Existing installs
> keep working (your `.mcp.json` is untouched on upgrade); new installs ship without it. See **Migration**.

### Changed — Context7 is now optional; the doc-fetching rule is tool-agnostic
Midas mandates the **habit** (fetch current, version-accurate docs before third-party code; never from
memory), **not the vendor**. Wire whichever doc tool you like.
- `harness/rules/context7-usage.md` rewritten tool-agnostic: Context7 is the *recommended free* option,
  with a web-fetch MCP / your own tool / by-hand as equals; the no-tool fallback is explicit.
- **Context7 removed from the default `.mcp.json`** (demoted to a commented `RECOMMENDED (optional)` entry
  in `mcp.json.tmpl`). The bundled `CONTEXT7_API_KEY` Authorization header is gone from the default config.
- Skill frontmatter `mcp-required: [context7]` → `mcp-recommended: [context7]` (8 skills); the
  "Context7 (mandatory)" framing in `AGENTS.md`, `harness/conventions.md`, the pipeline docs, and the
  generated adapters reworded to "fetch current docs (Context7 recommended, or your tool)". README badge
  removed; the MCP / docs-site copy updated.
- **Kept intact:** the principle and the value-add — agents still must fetch current docs before
  third-party code. Only the *coupling to a specific vendor* is gone.

### Fixed
- **`AGENTS.md` honesty.** It no longer claims Cursor/Copilot/Codex "read `.claude/skills` natively too" —
  aligned to the README's honest scope (Claude Code native; other tools get methodology + rules via
  `AGENTS.md`/`GEMINI.md`/adapters where supported; parity varies).

### Migration
No action required: existing installs keep their current `.mcp.json` (Context7 stays if you had it). To
match the new default you may remove the `context7` server from `.mcp.json` and rely on the rule's
tool-agnostic guidance — or keep Context7; it is still the recommended doc tool. Any doc MCP (or none +
by-hand) satisfies the rule.

### Engine
- Version single-sourced to `0.5.0` (`harness/VERSION` + all mirrors).

---

## [0.4.2] — 2026-06-17

### Fixed — whole-project alignment audit (5-lens workflow)
A multi-agent alignment audit after the v0.3.x–v0.4.1 work caught and fixed several cross-file
inconsistencies (verdict: needs-work → all must-fix applied):

- **Dead `/close-sprint` route.** `/midas-status` routed `stage: audit → /close-sprint`, but no skill ever
  sets `stage: audit` — Phase 8 runs *in place* during `sprint_execution`. `/midas-status` now routes
  `sprint_execution → /close-sprint` once the active sprint's work has landed; the transient `audit` label
  is annotated as such in `state.schema.md` and `8-audit-adjust.md`.
- **`docs/faq.md` uninstall answer** rewritten to the shipped `--uninstall` (it told users to delete
  `.harness/` — their audit trail — and a `.midas` directory that never existed).
- **CHANGELOG compare links** added for every release (were missing/stale).
- **Playbook count** normalized to `0–4 (zero is valid)` everywhere (three sites still read `2–4`);
  `docs/methodology.md` gained the playbooks + mechanical-gate (`CHECK:` / `MIDAS_AUDIT_RESULT` / doctor)
  story; `/midas-adopt`'s exit now routes E2 → `/define-conventions`, E3 → `/plan-sprints`.
- The worked example now exercises the playbook → sprint → audit linkage (sprint-01 tags + audit-01 done-when).

### Engine
- Version single-sourced to `0.4.2` (`harness/VERSION` + all mirrors).

---

## [0.4.1] — 2026-06-17

### Added — Phase 5 emits project playbooks (not just rules)
`/define-conventions` now generates, **beyond the rules**, a small bounded set of **playbooks** — markdown
recipes for the tasks that recur in the chosen stack — so every sprint does a repeated task the same way.
(Built, then reviewed by a 3-lens adversarial pass; verdict ship-after-must-fix, all must-fix applied.)

- **Rules are constraints the audit checks; playbooks are procedures the build agent follows.** Each
  playbook in `product/playbooks/<verb-noun>.md`: use-when, steps, the rules/tokens it honors (by
  `<slug>.md` — never restated), a Context7 fetch, and a done-when check that is the procedure's *own*
  signal.
- **Anti-bloat by design:** **0–4** playbooks (zero is valid); a task earns one only if it recurs AND has a
  non-obvious project-specific "right way". CHECK: each playbook must have ≥1 step no single rule states —
  a 1:1-to-rules playbook is cut. Playbooks are markdown the agent reads, **not** new slash-commands.
- Wired into the loop: `/start-sprint` loads and follows the matching playbook; `/close-sprint` confirms a
  followed playbook's done-when. A `harness/templates/playbook.md` template + an optional `playbook: <slug>`
  task linkage in the sprint template.
- Worked example: `examples/taskpilot/product/playbooks/` ships two real recipes (`add-api-route`,
  `add-drizzle-migration`), grounded in the example's Next.js + Drizzle code.

### Engine
- Version single-sourced to `0.4.1` (`harness/VERSION` + all mirrors).

---

## [0.4.0] — 2026-06-17

### Added — `/midas-init` is now an adaptive intake
Setup no longer forces every repo through a blank `/idea-intake`. `/midas-init` now **scans what the
project already has, classifies its maturity, pre-fills what it can infer, asks only the genuine gaps,
and places the project at the right phase** — reviewed by a 4-lens adversarial pass before shipping.

- **Scans code AND intent.** Beyond manifests/source, it reads `README`, `docs/`, briefs, notes, and the
  manifest `description` — so a project that is "just an idea written down" skips the blank idea-intake.
- **Maturity spectrum (E0–E3), not binary greenfield/brownfield.** E0 empty → `/idea-intake`; E1 idea-only
  → pre-fills `product/idea.md`, enters at `/contextualize`; E2 partial code → `/midas-adopt` → enters at
  `/define-conventions` (Phase 4 recorded as a skipped gate); E3 mature → full `/midas-adopt` → `/plan-sprints`.
  E0/E1 persist `mode: greenfield`, E2/E3 `mode: brownfield`.
- **Infer → SHOW → confirm.** Every inference (the maturity level, a `product/idea.md` drafted from the
  README, an as-built architecture) is shown for the user to accept or correct — never silently baked.
  Conflicts between a stale README and the code are flagged `DISPUTED`, not silently resolved.
- **Gap-only questions.** One batched round, scaled to the project: a mature repo confirms a classification
  and a couple of operational questions; a blank repo answers the full set. Confirming a level shows the
  gates it skips so the choice is informed. Monorepos are detected and routed to `/midas-monorepo`.
- `/midas-adopt` now harvests the written intent (README/docs) to backfill product context, not just code,
  and is framed as the E2/E3 branch of the intake. `methodology.md`, `state.schema.md`, the pipeline 0b
  playbook, and the docs site are updated to the maturity model.

### Engine
- Version single-sourced to `0.4.0` (`harness/VERSION` + all mirrors).

---

## [0.3.4] — 2026-06-17

### Fixed — MCP `sequential-thinking` server (caught by real-project validation)
- **Corrected the npm package name** in `.mcp.json` and `harness/templates/mcp.json.tmpl`:
  `@modelcontextprotocol/server-sequentialthinking` → `@modelcontextprotocol/server-sequential-thinking`.
  The misspelled name 404'd on **every** platform, so the server never started on any install.
- **Windows: the installer now wraps npx-launched MCP servers in `cmd /c`.** On Windows `npx` is a
  `.cmd` shim Node can't spawn directly, so `command: "npx"` fails with `MCP error -32000: Connection
  closed`. `create-midas` rewrites those servers to `cmd /c npx …` at install time (no-op on macOS/Linux).
- **`/midas-doctor` now warns** when, on Windows, a `.mcp.json` server launches with bare `npx`, so an
  already-installed project surfaces the issue (fix: re-run the installer with `--force`).

### Engine
- Version single-sourced to `0.3.4` (`harness/VERSION` + all mirrors).

---

## [0.3.3] — 2026-06-17

A "make the gate mechanically real" pass, driven by an internal audit + landscape review. Six
markdown/tiny-script improvements that close the self-grading gap **without adding any runtime**.

### Added — gates that something other than the model can read
- **Floor rules now ship with `CHECK:` lines.** Every item in `harness/rules/{code-quality,security,
  git-commits,naming,testing,docs}.md` carries a concrete pass/fail condition (a grep/command, or a
  `manual:` observable). This resolves a real self-contradiction: `/define-conventions` mandates that
  *generated* rules be checkable while the *shipped* floor rules had no checks at all.
- **`MIDAS_AUDIT_RESULT` tally line** on the per-sprint audit (`MIDAS_AUDIT_RESULT: rules_failed=X
  unresolved=Y amended=Z verdict=pass|blocked`), mirroring the existing verify/tribunal tally lines.
  Specified in `8-audit-adjust.md` + `/close-sprint`.
- **`/midas-doctor` now parses those frozen tally lines** — the first check *outside the model* that
  validates a verdict. It warns when an `audit-NN.md`/`verify-NN.md` record shows unresolved CRITs (or
  `verdict=blocked`) while `state.yaml` marks that sprint `done`. Per-sprint records only; the tribunal
  stays advisory by design.
- **"Human sign-off points"** subsection in `methodology.md` — the canonical list of decisions the
  harness never makes for you (go/no-go, rule amendments, scope-drift acceptance, applying the
  tribunal, ship, commit/push), each with where it is recorded.
- **EARS acceptance-criteria convention** (`WHEN <trigger>, the system SHALL <response>`) in
  `harness/conventions.md`, `/plan-sprints`, and the sprint template — so Phase-8 can map each
  criterion to a passing test.

### Changed — worked example now closes the 7 ⇄ 8 loop
- **`examples/taskpilot` completes one full sprint close.** Sprint 1 is driven to `done` with the full
  vertical slice (auth register/login/logout + sessions, task CRUD incl. `/api/tasks/[id]`, middleware,
  a `/board` stub, unit + integration tests), a **closing `audit-01.md`** (verdict PASS + tally line),
  and `state.yaml` advanced to point at Sprint 2. The signature loop is now demonstrated, not just
  described. (Also fixes a latent gap: `route.ts` imported `@/lib/auth/session`, which did not exist.)

### Added — uninstaller (same one command, `--uninstall`)
- **`--uninstall` on the installer**, following the caveman pattern (no separate `uninstall.sh`):
  `curl … | bash -s -- --uninstall`, `npx github:okuzpe/midas-harness --uninstall`, or the PowerShell
  scriptblock form. It is **surgical** — removes only pristine engine files + the marker-tagged
  generated adapters, prunes the empty engine directories, and **keeps your work** (`product/`,
  `.harness/`, `harness/state.yaml`) and any file you edited or that Midas didn't author. Flags:
  `--dry-run` (preview, delete nothing) and `--purge` (also remove your artifacts + state). Idempotent.
  Documented in `INSTALL.md` and both installer shims.

### Engine
- Version single-sourced to `0.3.3` (`harness/VERSION` + all mirrors).

---

## [0.3.2] — 2026-06-17

### Fixed — onboarding (from real-project validation)
- **The installed `AGENTS.md` now describes YOUR project, not Midas.** The initializer used to render the
  engine's own `AGENTS.md` (which read "Midas is a portable harness…") into every project; it now renders
  the project template (`harness/templates/AGENTS.md.tmpl`) and fills in the project name.
- **`/midas-init` is now a true one-time setup that retires itself.** It asks config in one batched round,
  sets `setup_complete: true`, and on re-run just points at `/midas-status`. On a **brownfield** repo it
  now **continues straight into `/midas-adopt` in the same run** — no more two separate commands.
  `/midas-status` directs you to `/midas-init` until setup is complete.
- `harness/state.yaml` gains a `setup_complete` flag (written `false` by the installer).

### Added
- `docs/context-hierarchy.md` — a single map of every file Midas writes (role, who edits it, which tools
  read it) and the rule-precedence order, consolidating guidance scattered across `AGENTS.md`,
  `harness/conventions.md`, the README, and `state.schema.md`. Added to the docs-site nav.

---

## [0.3.1] — 2026-06-17

### Changed — install flow
- **The installer now writes a default `harness/state.yaml`** (auto-detecting greenfield vs brownfield),
  so a project is **usable immediately in any tool** — `/midas-status` works right after `npx`. `/midas-init`
  becomes **optional refinement** (cost profile, tools, Context7 key) instead of a required step; brownfield
  installs are pointed at `/midas-adopt`. This removes the previous mandatory two-step onboarding.

### Changed (positioning / honesty pass)
- README restructured: clearer one-line pitch, a **When to use / when not to** section, a **Core vs
  advanced** table, and a slimmer quickstart (advanced commands moved out of the core loop).
- **More honest tools matrix** — replaced the blanket "native" claims with per-tool skill/routing
  support and a recommended level (Full/Good/Basic); Claude Code is stated as the primary target.
- `state.schema.md`: added a **minimalism rule** — `state.yaml` holds only operational state; long
  detail lives in `product/*` / `.harness/*`.
- Published formal GitHub Releases for v0.2.0 and v0.3.0.

### Fixed (ship-audit pass)
- **Broken references that shipped into every install.** Pipeline playbook links were zero-padded
  (`pipeline/00-…`) but the files are single-digit (`pipeline/0-…`) — fixed across `methodology.md` and
  the phase skills. Dead `/midas-business-case` "next" pointer in the market template → `/business-plan`.
- `docs/skills.md` now lists `/midas-update`, `/midas-verify`, `/midas-monorepo`; the `docs/skills.md`
  intro and `docs/faq.md` no longer overclaim non-Claude "native" support.
- `CONTRIBUTING.md` release step points at `harness/VERSION`, not a non-existent script constant.
- `SECURITY.md` now documents the `curl|bash` / `irm|iex` pipe-to-shell trust model (+ SEC-005).
- `scripts/test.mjs` now asserts the schema/example version stamps and that every referenced pipeline
  playbook resolves on disk (regression guard for the broken-link class).

---

## [0.3.0] — 2026-06-17

### Added
- `/midas-monorepo` — set Midas up across a monorepo/polyglot repo: nested `AGENTS.md` per package
  (nearest-file-wins), per-package rules/stack (Context7-verified), with dry-run + diff-confirm.
- `/midas-verify` — Playwright-gated end-to-end / UI verification (hard-gated to UI sprints); per-claim
  pass/fail with screenshot evidence frozen to `.harness/verifications/verify-NN.md`.
- `/midas-update` — migrate an install to the current engine: compares `state.yaml` `midas_version`
  against `harness/VERSION`, applies the minimal migration with dry-run + diff-confirm, bumps the stamp.
- Design-system **components** (`harness/design-system/components.md`) — a token-driven base set
  (Button, Input, Card, Dialog, …) with states + WCAG AA accessibility.
- **Docs site** — MkDocs-Material (`mkdocs.yml` + `docs/`) with a GitHub Pages deploy workflow.
- OSS polish — `NOTICE`, `CODE_OF_CONDUCT.md`, PR + issue templates.

### Changed / Fixed (external-audit pass)
- **Version is single-sourced** at `harness/VERSION` (`0.3.0`); `package.json`,
  `create-midas/package.json`, `gemini-extension.json`, `state.schema.md`, and the example all match,
  and `scripts/test.mjs` asserts it. (Was inconsistently `0.1.0`/`0.2.0`.)
- **`/midas-doctor` now runs real health checks** (version stamp vs engine, required `state.yaml` keys,
  secret-free `.mcp.json`, skills frontmatter, critical files) — not just adapter drift.
- **`market-research`** no longer hard-requires the `fetch` MCP (uses built-in `WebSearch` + Context7);
  `mcp-required: [context7]`.
- **README compatibility claims softened** — "native" = read-without-conversion, not feature parity;
  non-Claude model routing is advisory. Added a CI badge and a pinned-install recommendation.
- **CI** runs a real installer smoke test (install into a temp dir, then `doctor`).
- Tribunal "grounded in research" now cites sources in `harness/research/debate-method.md`.

---

## [0.2.0] — 2026-06-17

### Added
- `/midas-tribunal` — standing whole-project **adversarial debate** skill. Convenes a tribunal (steelman
  Defense vs red-team Prosecution + a dissent-forcing Catfish) across 11 decision-science lenses
  (Premortem, ATAM, FMEA, STRIDE, YAGNI, Economist, Competitor, Inverter, …). Debaters run on
  build/scout tiers; `midas-orchestrator` (Opus) judges **per claim**; every claim cites on-disk evidence
  or is struck. Scope modes (`whole|architecture|scope|idea|market|unit-economics|security|rules`) and a
  cost-clamped depth dial (`quick|standard|tribunal`). Freezes a ranked findings report to
  `.harness/debates/debate-NN.md` with a findings→action bridge. Complements `/close-sprint` (sprint
  conformance) by arguing *whether the decisions themselves are right*. Example:
  `examples/taskpilot/.harness/debates/debate-01.md`.
- `/market-research` — Phase 2 skill: fans out research (reuses `/deep-research`), verifies claims with
  citations, and writes `product/market.md`.
- `/business-plan` — Phase 3 skill: value proposition, MVP scope vs non-goals, measurable success
  metrics, and a go/no-go with **human sign-off** → `product/business-plan.md`.
- **Plugin marketplace rail** — `.claude-plugin/marketplace.json` + a generated `plugins/midas/` tree
  (rendered from `.claude/` by `scripts/build-plugin.mjs`), so Claude Code users can install with
  `/plugin marketplace add okuzpe/midas-harness` → `/plugin install midas@midas`. Plugins do not
  auto-install rules/`CLAUDE.md`, so run `/midas-init` once after install.
- **Test suite + CI** — `scripts/test.mjs` (dependency-free, 84 checks) validates JSON, skill/agent
  frontmatter, ritual-guard presence, adapter sync, plugin-tree sync, the example state shape, and the
  absence of stale brand tokens. A GitHub Actions workflow (`.github/workflows/ci.yml`) runs it plus
  `doctor` and a plugin-sync check on every push/PR.
- **One-command install from GitHub** — `npx github:okuzpe/midas-harness` (also `pnpm dlx` / `bunx`)
  installs Midas into any project, no npm account needed: a root `package.json` `bin` runs the
  dependency-free initializer (`create-midas/index.mjs`), which copies the harness non-destructively
  and generates the tool adapters, then points the user at `/midas-init`. The same initializer is also
  packaged as `create-midas` for a future `npm create midas`; `scripts/build-create.mjs` bundles its
  template from source and CI fails on drift.
- **Shell one-liners + `INSTALL.md`** — `install.sh` (`curl … | bash`) and `install.ps1` (`irm … | iex`)
  thin shims that bootstrap the same Node installer (no parallel logic to drift), plus a full
  `INSTALL.md` covering every method, flags, and uninstall.
- **`GEMINI.md` adapter** — a fourth generated tool adapter so Gemini CLI honors the harness too; the
  installer now prints a per-tool coverage summary on completion.
- **Brownfield adoption** — `/midas-adopt` brings Midas to an existing project: inventories the codebase
  (`harness/pipeline/0b-codebase-inventory.md`), reverse-engineers architecture + rules from the real
  code (codify reality; violations logged as debt), and wires the harness with **dry-run + diff-confirm**
  — it never overwrites a pre-existing `AGENTS.md`/`CLAUDE.md`/source without a confirmed diff.
  `/midas-init` now branches to it on brownfield repos.
- **Gemini CLI extension** — `gemini-extension.json` registers Midas as a Gemini CLI extension (context
  file `GEMINI.md`). Codex is covered by `AGENTS.md`, which it reads natively.

---

## [0.1.0] — 2026-06-16

**Build-phase 1:** greenfield foundation. Establishes the harness floor that all future phases extend.

### Added

#### Harness core
- `harness/methodology.md` — 9-phase lifecycle overview with state-machine diagram and brownfield entry notes.
- `harness/conventions.md` — always-on base conventions (code quality, naming, errors, testing, deps, git, security, design system); single body inlined into generated adapters.
- `harness/state.schema.md` — schema reference for `harness/state.yaml`, the single source of truth for phase progress.
- `harness/rules/context7-usage.md` — mandatory rule: fetch live library docs via Context7 before writing any third-party code; web fallback documented.
- `harness/pipeline/0-idea-intake.md` through `harness/pipeline/8-audit-adjust.md` — per-phase playbooks covering actor, inputs, steps, exit gate, and artifacts for each of the 9 phases.

#### Agent Skills (`.claude/skills/`)
- `/midas-init` — interactive installer; writes `harness/state.yaml` and generates adapters; guarded ritual.
- `/midas-status` — reads state and prints the single next action; scout-tier, read-only.
- `/midas-doctor` — detects adapter drift and re-renders `CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md` from source; guarded ritual.
- `/idea-intake` — Phase 0 skill; captures raw idea, 1-line pitch, and mode into `product/idea.md` + `harness/state.yaml`.
- `/contextualize` — Phase 1 skill; gap-audit loop, resolves BLOCKING open questions, writes `product/open-questions.md`.
- `/choose-architecture` — Phase 4 skill; Context7-verified stack selection, writes `product/architecture.md` and first ADR.
- `/define-conventions` — Phase 5 skill; generates stack-specific rules + design-system scaffolding; guarded ritual.
- `/plan-sprints` — Phase 6 skill; writes `product/roadmap.md` and `product/sprints/NN-*.md`.
- `/start-sprint` — Phase 7 skill; activates a sprint, gates on gate: passed; guarded ritual.
- `/close-sprint` — Phase 7→8 handoff; triggers audit; guarded ritual.

#### Agents (`.claude/agents/`)
- `midas-orchestrator` (`claude-opus-4-8`) — think/plan/audit; used for ~6 irreversible phase decisions.
- `midas-builder` (`claude-sonnet-4-6`) — implement/write artifacts; default execution model.
- `midas-scout` (`claude-haiku-4-5`) — search/extract/status; cheapest tier for mechanical tasks.

#### Tool adapters (generated; do not hand-edit)
- `CLAUDE.md` — Claude Code project law, inlined from `AGENTS.md` + `harness/conventions.md`.
- `.cursor/rules/00-midas.mdc` — Cursor adapter.
- `.windsurf/rules/00-midas.md` — Windsurf adapter.

#### MCP wiring
- `.mcp.json` — secret-free config wiring Context7 (HTTP) and sequential-thinking (npx); `${ENV_VAR}` pattern documented for optional servers.

#### Scripts
- `scripts/render-adapters.mjs` — re-renders all three tool adapters from source; no external deps.
- `scripts/doctor.mjs` — detects adapter drift, reports mismatches, optionally re-renders; called by `/midas-doctor`.

#### Docs & governance
- `AGENTS.md` — project law for all AI agents; source of truth for generated adapters.
- `README.md` — quickstart, phase overview, supported-tools matrix, MCP section, status.
- `docs/agents-and-models.md` — single bump point for model IDs and cost profiles.
- `CHANGELOG.md`, `VERSIONING.md`, `CONTRIBUTING.md`, `SECURITY.md` — governance floor.
- `LICENSE` — Apache-2.0.
- `.gitignore` — ignores caches, hashes, and volatile state; commits `harness/state.yaml`.

#### Example
- `examples/taskpilot/` — fully-populated greenfield product showing every phase artifact (idea, open questions, market, business plan, architecture, ADR, rules, design system, roadmap, sprint, audit) and a runnable code slice.

### Known limitations (v0.1)
- Brownfield entry at Phase 4/5 prints a safe manual path; full dry-run + diff-confirm support is deferred.
- Market-research (`/market-research`) and business-case (`/business-case`) skills are scaffolded but not yet interactive; they delegate to `/deep-research` with manual prompting.
- Cursor and Windsurf adapters do not yet auto-reload on `/midas-doctor`; re-open the editor after re-rendering.
- Plugin marketplace is not yet implemented; enrichment agents are consumed ad-hoc if present.

[Unreleased]: https://github.com/okuzpe/midas-harness/compare/v0.5.12...HEAD
[0.5.12]: https://github.com/okuzpe/midas-harness/compare/v0.5.11...v0.5.12
[0.5.11]: https://github.com/okuzpe/midas-harness/compare/v0.5.10...v0.5.11
[0.5.10]: https://github.com/okuzpe/midas-harness/compare/v0.5.9...v0.5.10
[0.5.9]: https://github.com/okuzpe/midas-harness/compare/v0.5.8...v0.5.9
[0.5.8]: https://github.com/okuzpe/midas-harness/compare/v0.5.7...v0.5.8
[0.5.7]: https://github.com/okuzpe/midas-harness/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/okuzpe/midas-harness/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/okuzpe/midas-harness/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/okuzpe/midas-harness/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/okuzpe/midas-harness/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/okuzpe/midas-harness/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/okuzpe/midas-harness/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/okuzpe/midas-harness/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/okuzpe/midas-harness/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/okuzpe/midas-harness/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/okuzpe/midas-harness/compare/v0.3.4...v0.4.0
[0.3.4]: https://github.com/okuzpe/midas-harness/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/okuzpe/midas-harness/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/okuzpe/midas-harness/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/okuzpe/midas-harness/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/okuzpe/midas-harness/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/okuzpe/midas-harness/releases/tag/v0.2.0
[0.1.0]: https://github.com/okuzpe/midas-harness/commit/f7868fd
