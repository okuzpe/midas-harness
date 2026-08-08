# Cursor hooks — Harness Trace (engine contributors)

**Do not ship to product installs / `cli/template`.** See [ADR-010](../../docs/adr/ADR-010-harness-trace-observe.md).

Engine contributors store traces under `runs/cache/traces/` (`paths.cache` in `harness/state.yaml`).
Product installs use `.harness/cache/traces/` (ADR-007).

## What runs

[`.cursor/hooks.json`](../hooks.json) wires:

| Hook | Effect |
|---|---|
| `sessionStart` | Ensure `session_id` in `runs/cache/traces/current.json` |
| `postToolUse` | Append redacted `span.finished` (`tool.<Name>`) |
| `subagentStop` | Append `span.finished` (`subagent.<type>`) |
| `stop` | `run.finished`; clear active `run_id` |

Command: `node scripts/trace-hook.mjs <event>` (stdin JSON → stdout `{ "permission": "allow" }`).
Event name is passed as argv so we do not depend on Cursor payload shape.

## Fail-open

Never blocks the agent. Invalid JSON, missing Node, or write errors still exit 0 with allow.

## Redaction

No full prompts, tool results, or diffs. Secret-like strings → `[redacted]`.

## Disable

Remove or rename `.cursor/hooks.json`, or delete the hook entries.

## Inspect

```bash
npm run trace:inspect -- list
npm run trace:inspect -- <run-id>
```
