# ADR-011 — Harness Trace on product installs

- **Status:** accepted
- **Date:** 2026-08-08
- **Extends:** [ADR-010](./ADR-010-harness-trace-observe.md) (observe-only core)
- **Related:** [ADR-008](./ADR-008-thin-root-allowlist.md) (root surfaces); [ADR-003](./ADR-003-project-memory-model.md) (cache ≠ LTM)

## Context

ADR-010 shipped Trace V1 as **engine dogfood only** (`scripts/trace-*.mjs` + root
`.cursor/hooks.json`). Product installs (e.g. BodegaSuite) received Midas 2.7.0 skills but
could not run `trace:inspect` — scripts were absent from `.harness/scripts/`. Users expected
to observe agent tool flows in the same repo where they run the methodology.

## Decision

1. **Ship scripts to installs.** Bundle `trace-write`, `trace-inspect`, `trace-hook`, and
   `lib/trace-{models,store}.mjs` into `.harness/scripts/` via `build-create` `FILES` (vendor).
2. **Project root via `resolveProjectRootFromScript`.** Install layout
   (`.harness/scripts/`) resolves to the project root (grandparent); engine `scripts/` stays
   parent. Traces remain under `.harness/cache/traces/` (gitignored).
3. **Cursor hooks — seed + merge, not copyTree.** When `tools` includes `cursor`, the
   installer calls `mergeTraceHooks`:
   - Missing `.cursor/hooks.json` → seed with
     `node .harness/scripts/trace-hook.mjs <event>` for
     `sessionStart` / `postToolUse` / `subagentStop` / `stop`.
   - Existing file → upsert entries whose `command` contains `trace-hook.mjs`; leave all
     other hooks untouched.
   - Never ship a template `.cursor/hooks.json` through blind `copyTree` (would clobber on
     `--update`).
4. **Ownership.** `.cursor/hooks.json` stays **user**-owned (not hashed as vendor/generated).
   The installer merges it but does **not** list it among vendor "managed files refreshed".
   Uninstall runs `stripTraceHooks` to remove only Midas-marked entries (delete file if empty).
5. **Still observe-only.** No MCP, breakpoints, skill instrumentation, or Langfuse in V2.
6. **Disable.** Remove Midas entries from `.cursor/hooks.json` or delete the file; CLI still
   works without hooks.

## Consequences

- After `--update` to ≥2.8.0, installs can run
  `node .harness/scripts/trace-inspect.mjs list`.
- Engine dogfood keeps `node scripts/trace-hook.mjs` in its own `.cursor/hooks.json`.
- Hosts without `cursor` still get the CLI scripts; automatic capture requires Cursor hooks.
- ADR-008 allowlist: `.cursor/hooks.json` is an expected root surface when `tools` includes
  `cursor`.
