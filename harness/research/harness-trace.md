# Harness Trace — research note (V1 Observe)

Actionable summary for engine dogfood. Full brainstorm history: `Untitled-1.md` (optional).
Binding decision: `docs/adr/ADR-010-harness-trace-observe.md` (engine repo; not shipped in create-midas).

## Goal

Open a run and answer: what ran, how long, what state changed, which tools fired, what looks wrong.

## Not V1

MCP · Langfuse · Grafana · breakpoints · `.nd` · OTel · template ship · mirrored SKILL emits ·
`context_utilization` · LLM `confidence`.

## Layout

```
.harness/cache/traces/
  current.json          # { session_id, run_id?, started_at }
  session-<id>/
    run-<id>.jsonl      # one envelope per line
```

## Envelope

`ts`, `session_id`, `run_id`, `type`, `name`, `attrs`

Types: `run.started` | `run.finished` | `span.started` | `span.finished` | `event` |
`state.snapshot` | `artifact`

## CLI

```bash
npm run trace:write -- start-run
npm run trace:write -- snapshot
npm run trace:inspect -- <run-id>
# or: node scripts/trace-inspect.mjs <run-id>
```

## Hooks (Cursor, engine only)

`.cursor/hooks.json` → `node scripts/trace-hook.mjs` (fail-open, redacted attrs).

## PROBLEMS heuristics

- span duration ≥ 60s
- same span `name` ≥ 3 times in a run
- any `event` with name/attrs marking error
- same `stage` in `state.snapshot` ≥ 3 times in a run

## V2 (deferred)

Semantic `skill.<name>` emits only when `trace-write` exists on disk or via an engine-only skill;
never as a hard step in skills mirrored to product installs without the binary.
