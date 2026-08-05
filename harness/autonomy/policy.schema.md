# Autonomy policy schema (project-owned)

Policy file: `.harness/autonomy/policy.yaml` (user-owned). Digest is SHA-256 of the
canonical YAML bytes; any change invalidates open authorizations and in-flight ticks.

## Fields

```yaml
mode: disabled          # disabled | bounded | custom | full  (P0 implements disabled|bounded)
enabled: false          # must be true and mode!=disabled for effects
version: 1

action_allowlist:
  - execute-next-sprint-task

branch:
  prefix: autonomy/     # work branches must start with this prefix
  forbid_default_push: true

budget:
  max_concurrent_runs: 1
  max_runs_per_day: 20
  max_cost_cents_reserve: 500   # conservative reserve before starting a run
  run_timeout_ms: 1800000

commit_push_authz:
  # Human preauthorization required before remote write.
  # File: .harness/autonomy/authz/commit-push.json (see authz.mjs)
  required: true

runner:
  default: fake          # fake | cursor-cloud
  orchestrate_model_required: true   # gate pauses if attested orchestrate model unavailable

# Optional: owner/repo for commit-push authz (else git remote origin, else local/project)
# repo: okuzpe/BodegaSuite

approvals:               # bounded always requires these; cannot silently empty
  merge: required
  deploy: required
  rule_amendment: required
  go_no_go: required
  shipped: required
```

## Transition rules

- `disabled → bounded`: explicit human edit + new digest.
- `bounded → full|custom`: **forbidden in P0**; requires P1 ADR amending methodology sign-offs.
- Removing the last bounded approval while staying in `bounded` is **rejected**; must set `mode: full` explicitly (P1).

## Absence semantics

Missing `policy.yaml` or missing `state.autonomy` ⇒ autonomy **disabled** (no effects).
