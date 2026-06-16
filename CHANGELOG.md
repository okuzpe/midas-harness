# Changelog

All notable changes to Midas are documented in this file.

Format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/).
Versioning follows [SemVer](https://semver.org/) as defined in [`VERSIONING.md`](./VERSIONING.md).

---

## [Unreleased]

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

[Unreleased]: https://github.com/okuzpe/midas-harness/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/okuzpe/midas-harness/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/okuzpe/midas-harness/releases/tag/v0.2.0
[0.1.0]: https://github.com/okuzpe/midas-harness/commit/f7868fd
