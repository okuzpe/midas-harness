# Harness Trace — research note (Observe)

Actionable summary. Binding decisions: `docs/adr/ADR-010-harness-trace-observe.md`,
`docs/adr/ADR-011-harness-trace-installs.md` (this research file stays engine-only; not shipped).

## Goal

Open a run and answer: what ran, how long, what state changed, which tools fired, what looks wrong.

## Not in scope (yet)

MCP · Langfuse · Grafana · breakpoints · `.nd` · OTel · mirrored SKILL emits ·
`context_utilization` · LLM `confidence`.

## Layout

Resolved as `{paths.cache}/traces/` (see `scripts/lib/trace-store.mjs` → `resolveTracesRoot`).

**Product install (ADR-007)**

```
.harness/cache/traces/
  current.json          # { session_id, run_id?, started_at }
  session-<id>/
    run-<id>.jsonl      # one envelope per line
```

**Engine dogfood** (`harness/state.yaml` → `paths.cache: runs/cache`)

```
runs/cache/traces/
  current.json
  session-<id>/
    run-<id>.jsonl
```

## CLI

**Engine dogfood**

```bash
npm run trace:write -- start-run
npm run trace:inspect -- list
npm run trace:inspect -- <run-id>
```

**Product install (≥2.8.0)**

```bash
node .harness/scripts/trace-inspect.mjs list
node .harness/scripts/trace-inspect.mjs <run-id>
```

## Hooks

| Host | Command |
|---|---|
| Engine | `.cursor/hooks.json` → `node scripts/trace-hook.mjs <event>` |
| Install (`tools` includes `cursor`) | merge → `node .harness/scripts/trace-hook.mjs <event>` |

Fail-open; redacted attrs. Marker for merge/uninstall: `trace-hook.mjs` in `command`.

## PROBLEMS heuristics

- span duration ≥ 60s
- same span `name` ≥ 3 times in a run
- any `event` type/name marking error
- same `stage` in `state.snapshot` ≥ 3 times in a run

## Later

Semantic `skill.<name>` emits, context inspector, MCP query, compare runs.
