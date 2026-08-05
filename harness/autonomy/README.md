# Midas autonomy (optional capability)

Bounded, durable control plane for continuous sprint work. **Off by default.**

Install with:

```bash
npx github:okuzpe/midas-harness --autonomy
# or, in an existing install:
npx github:okuzpe/midas-harness --update --autonomy
```

Then authorize commit/push for the work branch prefix and run:

```bash
node .harness/autonomy/bin/midas-autopilot.mjs status
node .harness/autonomy/bin/midas-autopilot.mjs dry-run
node .harness/autonomy/bin/midas-autopilot.mjs tick --runner=fake
```

## Layout

| Path | Owner | Role |
|---|---|---|
| `.harness/autonomy/` | vendor (code) | Runtime + contracts |
| `.harness/autonomy/policy.yaml` | user | Project policy (digest-gated) |
| `.harness/cache/autonomy/` | volatile | Lease lock |
| `.harness/runs/autonomy/` | user | Journal + tick records |
| `state.yaml → autonomy:` | user | Short operational pointers |

## Ordinary chat vs controller

Side-effecting skills keep `disable-model-invocation: true`. Only the
`midas-autopilot` controller (valid policy digest + commit/push authz) may
start `execute-next-sprint-task` — never an ordinary chat Skill invocation.

## P0 scope

- Mode: `bounded` only
- Action: `execute-next-sprint-task`
- Concurrency: 1
- No merge, deploy, rule amendment, go/no-go, or `shipped`
- Fake runner for tests; Cursor Cloud runner optional (`--runner=cursor-cloud`)

See [ADR-009](../../docs/adr/ADR-009-optional-autonomy-control-plane.md).
