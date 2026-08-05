# Action: execute-next-sprint-task

**P0 only.** Implements one task from the active sprint playbook
[`pipeline/7-sprint-execution.md`](../pipeline/7-sprint-execution.md).

## Preconditions

- `paths.state` stage is `sprint_execution`
- An active sprint exists with unchecked tasks
- Autonomy policy `enabled: true` and `mode: bounded`
- Valid commit/push preauthorization for the branch prefix
- Budget reserve available; no other lease held
- Action id in `action_allowlist`

## Role

- **Producer:** `midas-builder` (build tier) — implement + test
- **Scout (optional):** `midas-scout` for doc fetches
- **Auditor:** `midas-orchestrator` read-only on detached SHA (controller persists verdict)

## Allowed effects

- Create/update files under project source paths declared by folder-structure rules
- Write `{runs}/sprints/NN-progress.md`, sprint task checkmarks, `features.json` status/evidence only
- Commit and push to `branch.prefix*` only (never default branch)
- Produce tests + evidence

## Forbidden effects

- Merge, deploy, rule amendment, go/no-go, `shipped`
- Force-push, branch delete
- Mutating auditor evidence or policy
- Writing outside workspace / secret files

## Terminal outcomes

| Outcome | Controller status |
|---|---|
| Task done + tests green + SHA recorded | `idle` (or next tick) |
| Irreversible action needed | `approval_pending` |
| Budget reserve fail | `paused_budget` |
| Ambiguous rate limit | `blocked_unknown_limit` |
| Precondition miss / policy deny | `blocked` |

## Structured I/O

See `execute-next-sprint-task.json`.
