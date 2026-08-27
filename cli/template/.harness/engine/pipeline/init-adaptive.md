# Adaptive intake — `/midas-init` playbook

**Stage:** setup (`setup_complete: false` → `true`) | **Tier:** scout (scan) + orchestrate (classify/adopt) + build (drafts)

> Canonical procedure for `/midas-init`. The skill cites this file — do not restate the full
> phase walk in the skill body. Schema: `<paths.engine>/state.schema.md`. Monorepo detail:
> `<paths.engine>/pipeline/monorepo-wiring.md`. Lite track: `<paths.engine>/pipeline/lite.md`.

## Purpose

One-time adaptive setup: scan the repo, classify maturity (E0–E3), pre-fill what is already
known, ask only real gaps, place the project at the right phase, optionally wire a monorepo.

## Decision tree (skill keeps a short copy)

- `setup_complete: true` + `--monorepo` → **Phase F only**; do not flip `setup_complete`.
- `setup_complete: true` without `--monorepo` → **STOP**; point at `/midas-status`.
- Otherwise → full intake; set `setup_complete: true` at the end.

**Flow:** SCAN → CLASSIFY → TRACK → PRE-FILL → SHOW + ASK → GENERATE → [MONOREPO] →
`setup_complete: true`. **Never write a secret to disk.**

## Phase A — SCAN (read-only; scout)

Dispatch **scout** to harvest signals without writing:

- **Code & config:** tree, manifests, languages/frameworks (+ pinned versions), tests, CI, `.git`
  depth, workspace markers (`pnpm-workspace.yaml`, `turbo.json`, `nx.json`, …).
- **Intent & product docs:** `README*`, `docs/`, briefs/specs, `{product}/` artifacts, manifest
  `description`.
- **Tool surfaces:** `.claude/`, `.cursor/`, `.windsurf/`, `AGENTS.md`, `.mcp.json` (for
  managed-marker merge).
- **OS:** platform for env-var print commands (`setx` / `export`).

Classify from **repo contents**, not installed toolchains. Prefer Glob/Grep/Read; shell probes run
independently with benign failures (`|| true`) — never chain with `&&`.

## Phase B — CLASSIFY maturity

When ambiguous, pick the **lower** level; user can bump in Phase D.

| Level | Signal | Pre-fill | `stage` (`mode`) | Next (**`track: full` only**) |
|---|---|---|---|---|
| **E0** | no code, no product docs | — | `idea_intake` (`greenfield`) | `/idea-intake` |
| **E1** | README/brief/notes or bare scaffold, no real source | `{product}/idea.md` | `contextualize` (`greenfield`) | `/contextualize` |
| **E2** | non-trivial `src/`/`lib`/`app`, thin tests/arch | stack hint; adopt in E | `architecture_rules` (`brownfield`) | `/define-conventions` |
| **E3** | substantial code + tests + CI | full adoption | `sprint_planning` (`brownfield`) | `/plan-sprints` |

**`track: lite` overrides this Next column** — see Phase E + Exit and `<paths.engine>/pipeline/lite.md`.
Do not print `/idea-intake` or `/contextualize` as the single next action on lite.

**`mode`:** E0/E1 → `greenfield`; E2/E3 → `brownfield`. Skipped gates carry a recorded assumption +
honest `entry_stage`. E2 lands at `architecture_rules` because `/midas-adopt` emits as-built
architecture and records Phase 4 as deliberately skipped; exact landing is set by adopt when rules +
baseline audit are in place.

## Phase B2 — TRACK

Confirm in the **Phase D** Ask batch (do not skip this question):

- **`track: full`** (default) — all 9 phases.
- **`track: lite`** — Idea+Plan → Execute → Audit; see `<paths.engine>/pipeline/lite.md`. Lite
  checklist: (1) write `{product}/idea.md` + thin `{product}/architecture.md` + lean rules + **thin
  `{product}/business-plan.md` stub** (MVP + metrics + GO-assumed); (2) skip `{product}/market.md`
  with a `market_research` assumption in `paths.state`; (3) `entry_stage: sprint_planning` after
  Idea+Plan; (4) Phase 7 ladder; (5) `/close-sprint` — no lite bypass for Phase 8.

Write `track:` to `paths.state`. Lite E0/E1 → `entry_stage: sprint_planning` after Idea+Plan.

## Phase C — PRE-FILL (draft; do not commit)

Tag every value with **source**. E1+: draft `{product}/idea.md`. E2/E3: stack hint; architecture/rules
from `/midas-adopt` in Phase E. Defaults: name, tools (found dirs or `claude-code`), `language: en`,
`cost_profile: balanced`. Conflicting README vs code → tag **DISPUTED** for Phase D.

## Phase D — SHOW + ASK (one batch; gaps only)

Show maturity + entry phase + pre-fills (flag **DISPUTED**). One `AskQuestion` batch (fallback:
`AskUserQuestion` if that is the only host tool):

1. **Track** — `full` (9 phases) or `lite` (Idea+Plan → Execute → Audit; see
   `<paths.engine>/pipeline/lite.md`). Default `full`.
2. **Maturity** — confirm E-level and **gates it skips**.
3. **Gaps** — E0/E1: operational only (product gaps → `/contextualize` on full; lite folds them into
   Idea+Plan); E2/E3: capture product gaps here. Skip answered questions.
4. **Operational:** tools · `cost_profile` · approved MCPs (none by default) · language. Prefer
   Runlayer-managed integrations; Context7 remains an optional free docs source — never ask for a key.
5. Monorepo detected → wire now (Phase F) or defer to `/midas-init --monorepo` before `/plan-sprints`.

## Phase E — GENERATE (write last)

Wrap Midas regions in `<!-- midas:begin -->` … `<!-- midas:end -->`. Pre-existing `AGENTS.md` /
`.mcp.json` → show diff + confirm before write.

1. **Artifacts** — accepted pre-fills; scaffold `{product}/adr/`, `{product}/sprints/`.
   **`track: lite` Idea+Plan (same run):** write `{product}/idea.md` (if missing), thin
   `{product}/architecture.md`, lean `<paths.rules>/` (or engine-base only), and thin
   `{product}/business-plan.md` stub (MVP + metrics + GO-assumed). Do **not** require
   `{product}/market.md`. Cite `<paths.engine>/pipeline/lite.md`.
2. **E2/E3** — run `<paths.engine>/skills/midas-adopt/SKILL.md` in same run (inventory → arch + rules
   → baseline audit → dry-run + diff-confirm). Resumable on interrupt (`setup_complete: false`).
   **Lite + E2/E3:** still write the business-plan stub; skip market; after adopt, land at
   `sprint_planning` (do not leave Next at `/define-conventions` unless rules are absent).
3. **`AGENTS.md`** — from `<paths.engine>/templates/AGENTS.md.tmpl`; summarize conventions + Context7
   rule (don't restate `<paths.engine>/conventions.md`).
4. **Adapters** — `/midas-doctor` or `node <paths.scripts>/render-adapters.mjs` (selected tools only).
5. **`.mcp.json`** — secret-free `${ENV_VAR}`; `context7` + optional servers. UI MVP → recommend
   agent-browser + optional Playwright/Chrome DevTools from template. Native/hybrid → offer Maestro
   MCP (user approves). API-only → skip browser/mobile MCPs.
6. **`paths.state`** — per `<paths.engine>/state.schema.md`: `midas_version`, `name`, `mode`,
   `language`, dates, `stage_status: not_started`, `entry_stage` + assumptions for skipped gates,
   `cost_profile`, `routing`, `tools`, `mcp`, `phases`, **`setup_complete: true`**, `layout: harness`,
   canonical `paths:` block, **`track:`**.
   - **`track: full`:** `stage` from the Phase B maturity table.
   - **`track: lite`:** after Idea+Plan stubs exist, set `stage: sprint_planning` and
     `entry_stage: sprint_planning`. Skip `market_research` with a recorded assumption. Record
     `business_case` **passed** with the stub artifact. Do **not** leave `stage` at `idea_intake`,
     `contextualize`, or `market_research`.
7. **`.gitignore`** — `node <paths.scripts>/gitignore-merge.mjs` (merges engine snippet; never remove
   user patterns).

### Secrets (print, never write)

Optional tokens (e.g. `GITHUB_TOKEN`): print OS command (`setx` Windows / `export` POSIX);
`.mcp.json` uses `${ENV_VAR}` only.

## Phase F — MONOREPO (optional)

When: `--monorepo`, Phase D confirmed, or detected markers + user opted in. Follow
`<paths.engine>/pipeline/monorepo-wiring.md` (DETECT → INDEX → WRITE); respect `--dry-run`.
Populates `packages[]` + nested `AGENTS.md`. Re-run on `setup_complete: true` projects
without repeating intake (`/midas-init --monorepo`).

## Exit

Confirm files written, secret command if any, maturity chosen, **track**, then **one** next action:

- **`track: lite`:** Next is **not** the Phase B E-level table. After Idea+Plan stubs:
  **`/plan-sprints`**. If stubs are incomplete: **`/midas-init`**. **Never** `/idea-intake`,
  `/contextualize`, `/market-research`, or `/business-plan`.
- **`track: full`:** single next action from the maturity table.

Add: *"👉 Optional: `/midas-recall phase` to orient."* Then `/midas-status` from here on.

## Recommended tier + agents

- Scan → **scout** (`midas-scout`)
- Classification + adoption decisions → **orchestrate** (`midas-orchestrator`)
- Pre-fill drafts → **build** (`midas-builder`)
