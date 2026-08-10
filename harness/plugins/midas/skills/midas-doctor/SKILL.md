---
name: midas-doctor
description: The sync engine and health check — re-derives the generated tool adapters from <paths.engine>/conventions.md + rules, diffs them against disk, reports drift, and offers to re-render. Run after editing conventions/rules or when adapters look stale.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
mcp-recommended: [context7]
---

# midas-doctor — the only sync engine

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> No stage precondition — doctor may run at any lifecycle stage.

> **Paths:** Run `node <paths.scripts>/doctor.mjs`. Adapters render from `<paths.engine>/conventions.md` + rules. Substitute `{runs}/` and `{product}/` per `AGENTS.md` § Path resolution.

Generated adapters (`.claude/CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`, `GEMINI.md`) are
**rendered** from `<paths.engine>/conventions.md`, base rules, and project rules at `<paths.rules>` — never hand-edited. `midas-doctor` is the
**single** path that keeps them in sync, plus a fast health check on the rest of the install. It diffs
first and writes only with the user's go-ahead.

## Phase 1 — Adapter drift (the core job)

1. **Re-derive** the expected adapters via `node <paths.scripts>/doctor.mjs` (which calls `computeAdapters()`
   from `render-adapters.mjs` internally) or run `node <paths.scripts>/render-adapters.mjs` to apply fixes.
2. **Diff** each rendered adapter against the on-disk file, comparing **only** the Midas-managed regions
   between `<!-- midas:begin -->` and `<!-- midas:end -->`. Content outside the markers is the user's and
   is left untouched.
3. **Report drift** per adapter: `in sync` / `drifted (N regions)` / `missing`, with a short diff
   summary of what changed.
4. **Offer to re-render.** If anything drifted, ask the user to confirm, then write the corrected
   adapters via `node <paths.scripts>/render-adapters.mjs` (the same render path — no ad-hoc editing). Only
   re-render adapters for tools listed in `state.yaml -> tools`.

## Phase 2 — Health assertions (warn, don't fix silently)

Findings are **mechanical** (adapter drift, version mismatch, MCP wiring, missing config files) or
**verdict** (frozen audit/verify tallies, gate pass claims). `--fix` may repair **mechanical** issues only.
**Verdict** findings require human review or a fix mini-sprint — never auto-approve a gate.

`node <paths.scripts>/doctor.mjs` prints the **mechanical** subset of these checks.

| Check | What it means |
|---|---|
| `version` | state `midas_version` matches `<paths.engine>/VERSION` |
| `routing` | Tier ids reconcile with `.claude/agents/midas-*.md` pins (`balanced` profile = exact match) |
| `enforcement` | Phase-5 scaffold configs exist on disk; `installed:false` surfaced |
| `layout:consistent` | v2 state declares `layout: harness` and canonical disk markers agree |
| `layout:legacy-artifacts` | No identifiable Midas files remain in legacy engine/run paths |
| `manifest:integrity` | Vendor hashes and ownership roles in `.harness/manifest.json` are valid |
| `mirror:*` | Selected-host skills/agents mirrors match canonical engine sources |
| `file:*` | `AGENTS.md`, `<paths.engine>/conventions.md`, `<paths.engine>/methodology.md` present |
| `mcp:secret-free` | `.mcp.json` uses `${ENV_VAR}` placeholders only |
| `mcp:win-npx` | Windows: MCP servers must wrap `npx` in `cmd /c` |
| `mcp:declared-vs-wired` | Every `state.yaml → mcp:` id wired in `.mcp.json` (`context7` optional) |
| `mcp:skill-required` | Every skill `mcp-required` id wired in `.mcp.json` |
| `skills:frontmatter` | Each `<paths.engine>/skills/*/SKILL.md` has valid frontmatter |
| `gate:records` | Frozen sprint `audit-*` / `verify-*` tallies match `state.yaml` sprint status |
| `gate:phase-*` / `gate:sprint-continuity` | Passed phases have assumption or on-disk artifacts; active sprints have progress when stale |
| `gitignore:midas-block` | Root `.gitignore` has the managed Midas block (secrets, deps, volatile paths) |
| `layout:root-allowlist` | No orphan Midas host paths for deselected `tools` (ADR-008) |

## Phase 3 — Apply fixes (`--fix`)

When the user confirms, run:

```bash
node <paths.scripts>/doctor.mjs --fix
```

That path **re-renders adapters** and **merges/upgrades `.gitignore`** from
`<paths.engine>/templates/gitignore-midas.snippet` (idempotent; never deletes user patterns outside
the Midas block). On product installs (`layout: harness`) with `routing_profile: claude`, it also
rewrites `paths.state → routing:` and syncs the three first-party agent `model:` pins to
`resolveCostAwareRouting(cost_profile)`. Equivalent standalone: `node <paths.scripts>/gitignore-merge.mjs`.

After `--fix`, re-run without `--fix` and confirm `gitignore:midas-block` is `ok`.

## Output

A compact health table — one row per check with `ok` / `warn` / `drift` and a one-line note — followed
by the offered action (re-render + gitignore merge via `--fix`) and any secret-setup command the user
must run. Never write a key, never hand-edit a generated adapter outside the render script, never
mutate vendor agent files.

## When NOT

- Full engine propagation matrix / VERSION bump judgment → `/midas-align` (engine maintainers).
- Install missing / wrong cwd / version behind → `/midas-reconcile` first.
- Engine content migration across versions → `/midas-init` (diagnose tips pinned `--update`).
- Pipeline orientation only → `/midas-status`.

## Tier & delegation
- **Dispatch + script runs / interpreting drift:** `build` → `midas-builder`.
- **File/status extraction only:** `scout` → `midas-scout`.
- Do **not** use orchestrate unless the user is deciding a non-trivial migration after doctor output.
- Respect `cost_profile`.

## Exit gate (doctor complete)
- [ ] Health table printed for every applicable check (`ok` / `warn` / `drift`).
- [ ] Drift findings named with path; no silent skip.
- [ ] Writes only after user go-ahead / `--fix`; re-run without `--fix` shows `ok` where fixed.
- [ ] No secrets written; no hand-edits to generated adapters.
- [ ] Next action named (`--fix`, secret setup, or “healthy”).
