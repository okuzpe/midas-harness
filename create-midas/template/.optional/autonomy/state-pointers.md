# Autonomy operational pointers (optional)

When the optional autonomy capability is installed and enabled, `state.yaml` may
include a short `autonomy:` block. **Absence ≡ disabled** (no effects).

```yaml
autonomy:
  enabled: false                 # must match policy.enabled when effects run
  mode: disabled                 # disabled | bounded | custom | full (P0: disabled|bounded)
  status: idle                   # idle | running | approval_pending | paused_budget |
                                 # paused_quota | blocked_unknown_limit | blocked | completed
  policy_digest: ""              # sha256 hex of policy.yaml canonical bytes; empty when disabled
  active_agent_id: null          # Cursor agent id when a run is in flight
  active_run_id: null            # Cursor run id
  active_sha: null               # builder-produced commit SHA pending audit / next effect
  journal_path: .harness/runs/autonomy/journal.jsonl
  next_attempt_at: null          # ISO timestamp for resume after pause; null when idle
```

Long-form policy, ledger, journal entries, and tick records live under
`.harness/autonomy/` and `{runs}/autonomy/` — not in `state.yaml`.

Controller statuses are **orthogonal** to `stage` (they are not a second product FSM).
