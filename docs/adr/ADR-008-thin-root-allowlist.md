# ADR-008 — Thin root allowlist (host discovery outside `.harness/`)

- **Status:** accepted
- **Date:** 2026-07-29
- **Extends:** ADR-007
- **Related:** ADR-001 (rejected symlinks/junctions for engine relocate)

## Context

ADR-007 put the engine, scripts, product, rules, and runs under `.harness/`. Installs still
dropped multiple host discovery trees at the repo root (`.claude/`, `.agents/`, `.cursor/`,
`.windsurf/`, `GEMINI.md`) because each editor only scans fixed paths.

Users want “almost everything in `.harness/`”. Putting skills only under `.harness/.../skills`
fails discovery: Cursor scopes *nested* `.cursor/skills` / `.agents/skills` folders to that
subtree, so methodology skills would not apply to `apps/` or product code. Symlinks/junctions
from root → `.harness/` were rejected in ADR-001 (Windows fragility, git pollution).

Default install also selected four adapter tools, which maximized root noise.

## Decision

1. **Canonical truth** stays under `.harness/engine/` (skills, agents, conventions, rules).
2. **Root allowlist** — only these Midas-managed surfaces may appear outside `.harness/`:
   - Always: `AGENTS.md`, `.mcp.json` (user-owned seed), managed `.gitignore` block
   - Per `state.tools`: adapters and **one** portable skills mirror (anti-double matrix below)
3. **Anti-double skills matrix**

   | `state.tools` | Skills mirror at root |
   |---|---|
   | only `cursor` | `.cursor/skills/` |
   | `cursor` + portable peer (`windsurf`/`gemini`/`codex`/`copilot`) | `.agents/skills/` only |
   | portable peer(s) without `cursor` | `.agents/skills/` |
   | `claude-code` (± others) | `.claude/skills` + `.claude/agents`, plus the portable row above |

4. **Default install tools** = `[cursor]` (not all adapters).
5. **`--update --tools=…`** rewrites `state.tools` and prunes orphan Midas mirrors/adapters.
   Without `--tools`, update preserves existing tools (prior behavior).
6. **No symlinks/junctions** for discovery paths.

## Consequences

- Cursor-only installs: root noise is `AGENTS.md` + `.cursor/` + `.mcp.json` + gitignore.
- Doctor gains `layout:root-allowlist` and mirrors the active skills path only.
- Existing multi-tool installs stay noisy until the user runs
  `npx … --update --tools=cursor` (or the subset they actually use).
- Template may ship both `.agents/skills` and `.cursor/skills`; install/update prune leaves one.
