---
name: midas-init
description: "One-time adaptive setup — scan repo, classify maturity, pre-fill artifacts, ask gap-only questions, place at the right phase; optional --monorepo. Use when the user explicitly runs /midas-init on a fresh or incomplete install."
metadata:
  midas-argument-hint: "[--monorepo] [--dry-run]"
  midas-disable-model-invocation: true
  midas-harness-tier: orchestrate
  midas-mcp-recommended: "[context7]"
  midas-model: inherit
  midas-recommended-model: claude-opus-4-8
  midas-user-invocable: true
---
# midas-init — adaptive intake (one-time setup)

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> Read **`paths.state`** first. Wrong precondition → report and stop.

## Does / Does not

| Does | Does not |
|---|---|
| Scan, classify, pre-fill, place at correct phase | Run when `setup_complete: true` (except `--monorepo`) |
| One batched `AskUserQuestion` for genuine gaps | Silently bake inferred values — always infer → SHOW → confirm |
| Set `setup_complete: true` on full intake | Overwrite content outside `<!-- midas:begin -->` … `<!-- midas:end -->` |

**Decision tree:**
- `setup_complete: true` + `--monorepo` → **Phase F only**; do not flip `setup_complete`; point at `/midas-status`.
- `setup_complete: true` without `--monorepo` → **STOP**; point at `/midas-status`.
- Otherwise → full intake below; set `setup_complete: true`; tell user verbatim: *"Setup complete — from here, just use `/midas-status`; you won't need `/midas-init` again (except `--monorepo` wiring)."*

**Flow:** SCAN → CLASSIFY → TRACK → PRE-FILL → SHOW + ASK → GENERATE → [MONOREPO] → `setup_complete: true`. **Never write a secret to disk.**

---

## Phase A — SCAN (read-only; scout)

Dispatch **scout** to harvest signals without writing:

- **Code & config:** tree, manifests, languages/frameworks (+ pinned versions), tests, CI, `.git` depth, workspace markers (`pnpm-workspace.yaml`, `turbo.json`, `nx.json`, …).
- **Intent & product docs:** `README*`, `docs/`, briefs/specs, `{product}/` artifacts, manifest `description`.
- **Tool surfaces:** `.claude/`, `.cursor/`, `.windsurf/`, `AGENTS.md`, `.mcp.json` (for managed-marker merge).
- **OS:** platform for env-var print commands (`setx` / `export`).

Classify from **repo contents**, not installed toolchains. Prefer Glob/Grep/Read; shell probes run independently with benign failures (`|| true`) — never chain with `&&`.

## Phase B — CLASSIFY maturity

When ambiguous, pick the **lower** level; user can bump in Phase D.

| Level | Signal | Pre-fill | `stage` (`mode`) | Next |
|---|---|---|---|---|
| **E0** | no code, no product docs | — | `idea_intake` (`greenfield`) | `/idea-intake` |
| **E1** | README/brief/notes or bare scaffold, no real source | `{product}/idea.md` | `contextualize` (`greenfield`) | `/contextualize` |
| **E2** | non-trivial `src/`/`lib`/`app`, thin tests/arch | stack hint; adopt in E | `architecture_rules` (`brownfield`) | `/define-conventions` |
| **E3** | substantial code + tests + CI | full adoption | `sprint_planning` (`brownfield`) | `/plan-sprints` |

**`mode`:** E0/E1 → `greenfield`; E2/E3 → `brownfield`. Skipped gates carry a recorded assumption + honest `entry_stage`. E2 lands at `architecture_rules` because `/midas-adopt` emits as-built architecture and records Phase 4 as deliberately skipped; exact landing (`architecture_rules` vs `sprint_planning`) is set by adopt when rules + baseline audit are in place.

## Phase B2 — TRACK

One question in the batched round:
- **`track: full`** (default) — all 9 phases.
- **`track: lite`** — Idea+Plan → Execute → Audit; see `<paths.engine>/pipeline/lite.md`. Lite checklist: (1) pre-fill `{product}/idea.md` + skipped gates in `paths.state`; (2) compressed MVP + sprint outline; (3) `entry_stage: sprint_planning`; (4) Phase 7 ladder; (5) `/close-sprint` — no lite bypass for Phase 8.

Write `track:` to `paths.state`. Lite E0/E1 → `entry_stage: sprint_planning` after Idea+Plan.

## Phase C — PRE-FILL (draft; do not commit)

Tag every value with **source**. E1+: draft `{product}/idea.md`. E2/E3: stack hint; architecture/rules from `/midas-adopt` in Phase E. Defaults: name, tools (found dirs or `claude-code`), `language: en`, `cost_profile: balanced`. Conflicting README vs code → tag **DISPUTED** for Phase D.

## Phase D — SHOW + ASK (one batch; gaps only)

Show maturity + entry phase + pre-fills (flag **DISPUTED**). One `AskUserQuestion` batch:
1. **Maturity** — confirm E-level and **gates it skips**.
2. **Gaps** — E0/E1: operational only (product gaps → `/contextualize`); E2/E3: capture product gaps here. Skip answered questions.
3. **Operational:** tools · `cost_profile` · MCP (`context7` always; `sequential-thinking` default) · language. Context7 = free tier — never ask for a key.
4. Monorepo detected → wire now (Phase F) or defer to `/midas-init --monorepo` before `/plan-sprints`.

## Phase E — GENERATE (write last)

Wrap Midas regions in `<!-- midas:begin -->` … `<!-- midas:end -->`. Pre-existing `AGENTS.md`/`.mcp.json` → show diff + confirm before write.

1. **Artifacts** — accepted pre-fills; scaffold `{product}/adr/`, `{product}/sprints/`.
2. **E2/E3** — run `<paths.engine>/skills/midas-adopt/SKILL.md` in same run (inventory → arch + rules → baseline audit → dry-run + diff-confirm). Resumable on interrupt (`setup_complete: false`).
3. **`AGENTS.md`** — from `<paths.engine>/templates/AGENTS.md.tmpl`; summarize conventions + Context7 rule (don't restate `<paths.engine>/conventions.md`).
4. **Adapters** — `/midas-doctor` or `node <paths.scripts>/render-adapters.mjs` (selected tools only).
5. **`.mcp.json`** — secret-free `${ENV_VAR}`; `context7` + optional servers. UI MVP → recommend agent-browser + optional Playwright/Chrome DevTools from template. Native/hybrid → offer Maestro MCP (user approves). API-only → skip browser/mobile MCPs.
6. **`paths.state`** — per `<paths.engine>/state.schema.md`: `midas_version`, `name`, `mode`, `language`, dates, `stage` from table, `stage_status: not_started`, `entry_stage` + assumptions for skipped gates, `cost_profile`, `routing`, `tools`, `mcp`, `phases`, **`setup_complete: true`**, `layout: harness`, canonical `paths:` block.
7. **`.gitignore`** — `node <paths.scripts>/gitignore-merge.mjs` (merges engine snippet; never remove user patterns).

### Secrets (print, never write)
Optional tokens (e.g. `GITHUB_TOKEN`): print OS command (`setx` Windows / `export` POSIX); `.mcp.json` uses `${ENV_VAR}` only.

## Phase F — MONOREPO (optional)

When: `--monorepo`, Phase D confirmed, or detected markers + user opted in. Follow `<paths.engine>/pipeline/monorepo-wiring.md` (DETECT → INDEX → WRITE); respect `--dry-run`. Populates `packages[]` + nested `AGENTS.md`. `/midas-monorepo` redirects here; re-run on `setup_complete: true` projects without repeating intake.

## Exit
Confirm files written, secret command if any, maturity chosen, **single next action** from table. Add: *"👉 Optional: `/midas-recall phase` to orient."* Then `/midas-status` from here on.

## Tier & cost
Scan → **scout**. Classification + adoption → **orchestrate**. Pre-fill drafts → **build**.
