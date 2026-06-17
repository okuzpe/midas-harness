---
name: midas-doctor
description: The sync engine and health check — re-derives the generated tool adapters from harness/conventions.md + rules, diffs them against disk, reports drift, and offers to re-render. Run after editing conventions/rules or when adapters look stale.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
mcp-recommended: [context7]
---

# midas-doctor — the only sync engine

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; if the precondition stage is wrong, report and stop.

Generated adapters (`CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`) are
**rendered** from `harness/conventions.md` + `harness/rules/*` — never hand-edited. `midas-doctor` is the
**single** path that keeps them in sync, plus a fast health check on the rest of the install. It diffs
first and writes only with the user's go-ahead.

## Phase 1 — Adapter drift (the core job)

1. **Re-derive** the expected adapters by running `node scripts/render-adapters.mjs` in dry-run/diff
   mode (no external dependencies; it reads conventions + rules and emits the canonical adapter text).
2. **Diff** each rendered adapter against the on-disk file, comparing **only** the Midas-managed regions
   between `<!-- midas:begin -->` and `<!-- midas:end -->`. Content outside the markers is the user's and
   is left untouched.
3. **Report drift** per adapter: `in sync` / `drifted (N regions)` / `missing`, with a short diff
   summary of what changed.
4. **Offer to re-render.** If anything drifted, ask the user to confirm, then write the corrected
   adapters via `node scripts/render-adapters.mjs` (the same render path — no ad-hoc editing). Only
   re-render adapters for tools listed in `state.yaml -> tools`.

## Phase 2 — Health assertions (warn, don't fix silently)

`node scripts/doctor.mjs` now prints the **mechanical** subset of these checks (version stamp vs
`harness/VERSION`, required `state.yaml` keys, secret-free `.mcp.json`, skills frontmatter, critical
files). Read `harness/state.yaml` once, then add the **judgment** assertions and report pass/warn for each:

- **`AGENTS.md` present** and contains its managed markers.
- **`state.yaml` parses** as valid YAML and matches the schema in `harness/state.schema.md`
  (required keys, a valid `stage` enum, a `routing` block consistent with `cost_profile`).
- **Context7 reachable.** Probe via the Context7 MCP (a `resolve-library-id` ping). If unreachable or
  rate-limited, warn and recommend setting `CONTEXT7_API_KEY` per `harness/rules/context7-usage.md`
  (print the OS-appropriate `setx`/`export` command; never write or echo a key value).
- **`.mcp.json` is secret-free** — every credential is a `${ENV_VAR}` placeholder, no literal keys.
- **Specialist model tiers.** For each recommended specialist agent referenced by the skills/state,
  check its declared `model` against its expected tier in `docs/agents-and-models.md`. **Warn** (do not
  edit vendor files) if a pinned model disagrees with the desired tier — suggest wrapping it in a thin
  first-party agent.

## Output

A compact health table — one row per check with `ok` / `warn` / `drift` and a one-line note — followed
by the offered action (re-render drifted adapters) and any secret-setup command the user must run. Never
write a key, never hand-edit a generated adapter outside the render script, never mutate vendor agent files.
