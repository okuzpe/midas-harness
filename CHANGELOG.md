# Changelog

All notable changes to Midas are documented in this file.

Format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/).
Versioning follows [SemVer](https://semver.org/) as defined in [`VERSIONING.md`](./VERSIONING.md).

---

## [Unreleased]

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

---

## [0.1.0] — 2026-06-16

**Build-phase 1:** greenfield foundation. Establishes the harness floor that all future phases extend.

### Added

#### Harness core
- `harness/methodology.md` — 9-phase lifecycle overview with state-machine diagram and brownfield entry notes.
- `harness/conventions.md` — always-on base conventions (code quality, naming, errors, testing, deps, git, security, design system); single body inlined into generated adapters.
- `harness/state.schema.md` — schema reference for `harness/state.yaml`, the single source of truth for phase progress.
- `harness/rules/context7-usage.md` — mandatory rule: fetch live library docs via Context7 before writing any third-party code; web fallback documented.
- `harness/pipeline/00-idea-intake.md` through `harness/pipeline/08-audit-adjust.md` — per-phase playbooks covering actor, inputs, steps, exit gate, and artifacts for each of the 9 phases.

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

[Unreleased]: https://github.com/okuzpe/midas-harness/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/okuzpe/midas-harness/releases/tag/v0.1.0
