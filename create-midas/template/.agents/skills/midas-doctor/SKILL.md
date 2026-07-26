---
name: midas-doctor
description: "The sync engine and health check — re-derives the generated tool adapters from <paths.engine>/conventions.md + rules, diffs them against disk, reports drift, and offers to re-render. Run after editing conventions/rules or when adapters look stale."
metadata:
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-mcp-recommended: "[context7]"
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-doctor — the only sync engine

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read the state file at **`paths.state`**. No stage precondition — doctor may run at any lifecycle stage.

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

Additional judgment checks (not all printed by the script):

- **`AGENTS.md` present** and contains its managed markers.
- **`state.yaml` parses** as valid YAML and matches the schema in `<paths.engine>/state.schema.md`.
- **Context7 reachable** (optional) — probe via Context7 MCP if wired; otherwise note the web-fetch
  fallback per `<paths.engine>/rules/context7-usage.md`.
- **Specialist model tiers** — warn if a vendor agent's pinned `model` disagrees with
  `docs/agents-and-models.md` (do not edit vendor files).

## Output

A compact health table — one row per check with `ok` / `warn` / `drift` and a one-line note — followed
by the offered action (re-render drifted adapters) and any secret-setup command the user must run. Never
write a key, never hand-edit a generated adapter outside the render script, never mutate vendor agent files.
