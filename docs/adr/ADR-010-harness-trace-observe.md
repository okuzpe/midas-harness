# ADR-010 — Harness Trace V1 (observe-only)

- **Status:** accepted
- **Date:** 2026-08-08
- **Extends:** [ADR-003](./ADR-003-project-memory-model.md) (git-visible LTM; no hidden memory store)
- **Related:** [ADR-008](./ADR-008-thin-root-allowlist.md) (root surfaces); engine dogfood only

## Context

Improving the harness requires seeing how agent sessions actually behave: which tools ran,
how long spans took, what `paths.state` looked like, and which patterns look like loops or
errors. Generic LLM UIs (Langfuse, etc.) do not know Midas stages, gates, or evidence.

We need a **local observe layer** first — not interactive breakpoints, MCP control, or a
product-wide install surface. Trace data must not become a second LTM that contradicts ADR-003.

## Decision

1. **Observe before control.** V1 records events only. No pause/step/continue, no MCP, no
   Langfuse/Grafana/OTel export, no `.nd` format, no HTTP debugger UI.
2. **Cache ≠ LTM.** Append-only JSONL under `.harness/cache/traces/` (gitignored via
   `.harness/cache/`). Durable insight still crystallizes through existing markdown rituals
   (`/midas-sweep`, `/midas-investigate`, `/midas-capture`, verify/audit records).
3. **Zero new dependencies.** Node ESM scripts only (`scripts/lib/trace-*.mjs`,
   `scripts/trace-write.mjs`, `scripts/trace-inspect.mjs`, `scripts/trace-hook.mjs`).
4. **Primary signal = Cursor hooks (engine dogfood).** Project `.cursor/hooks.json` wires
   `sessionStart`, `postToolUse`, `subagentStop`, `stop` → `node scripts/trace-hook.mjs`.
   Hooks are **not** shipped in `create-midas/template`. CLI works on any host; hooks are
   Cursor-only.
5. **Fail-open + redaction.** Hook adapter always exits 0 / allows the agent; never blocks.
   Do not persist full prompts, tool results, or diffs. Strip values matching secret patterns.
6. **No mirrored skill instrumentation in V1.** Editing `harness/skills/*/SKILL.md` would
   propagate via `portable-skills.mjs` to installs that lack `trace-write`. Semantic
   `skill.*` emits are deferred (guard with `existsSync` / engine-only skill later).
7. **Lifecycle.** `session_id` from `sessionStart` (or lazy); `run_id` opens on first tool
   span or CLI `start-run`; closes on hook `stop` or CLI `finish`. Pointer:
   `.harness/cache/traces/current.json`.
8. **Inspect views.** CLI prints RUN / TRACE / STATE / PROBLEMS only.

## Consequences

- Engine contributors can reconstruct a Cursor turn from cache JSONL + `trace-inspect`.
- Product installs are unaffected until a later ADR ships an optional install path.
- ADR-008 root noise: `.cursor/hooks.json` is dogfood-only; not part of the product
  thin-root allowlist yet.
- V2 may add skill-shaped emits (when the binary exists), richer context inspect, loop
  compare, then MCP query — still without replacing progress/verify/audit markdown.

## Amendment — 2026-08-08

- `sessionStart` / session-switch now emit `run.finished` before clearing `run_id` (no orphan runs).
- `research/harness-trace.md` and `research/Untitled-1.md` are `HARNESS_ENGINE_ONLY_RELS` (not
  copied into `create-midas/template`).
- Event `message` attrs are kept (redacted/truncated) instead of blanket `[omitted]`.

## Amendment — 2026-08-08 (install ship)

- Superseded for **install packaging** by [ADR-011](./ADR-011-harness-trace-installs.md):
  scripts ship under `.harness/scripts/`; Cursor hooks are seeded/merged on install/update.
  Engine dogfood hooks remain root `.cursor/hooks.json` → `scripts/trace-hook.mjs`.
  Decision points 4 and Consequences “product installs unaffected” no longer apply after 2.8.0.
