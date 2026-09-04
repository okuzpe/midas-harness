# Midas autonomy (optional capability)

Bounded, durable control plane for continuous sprint work. **Off by default.**

Install with:

```bash
npx github:okuzpe/midas-harness --autonomy
# or, in an existing install:
midas update --autonomy
```

Then run (no env export required locally — setup auto-creates `.harness/autonomy/authz/hmac`, a gitignored local secret):

```bash
node .harness/autonomy/bin/midas-autopilot.mjs status
node .harness/autonomy/bin/midas-autopilot.mjs setup --actor=pilot --hours=24
node .harness/autonomy/bin/midas-autopilot.mjs dry-run
node .harness/autonomy/bin/midas-autopilot.mjs tick --runner=fake
```

`setup` grants a **time-boxed multi-use** authz (until `--hours`). Pass `--single-use` for one tick only.
When the sprint is operator-only, setup exits **0** with `status: configured` and recommends `/start-sprint`.
`dry-run` returns `recommendation` — the single next command when blocked.
Autopilot **skips** operator/manual checklist lines (`[operator]`, narrow release-runbook heuristics).
Prefer tagging ambiguous human work with `[operator]` / `[manual]`.

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
`midas-autopilot` **CLI controller** (valid policy digest + commit/push authz) may
start `execute-next-sprint-task` — never an ordinary chat Skill invocation.

| Want… | Use |
|---|---|
| Continuous product evolve (Cursor `/loop`) | `/midas-auto-pilot` → Continuous evolve |
| Next sprint checklist tick (policy/budget/lease) | `/midas-auto-pilot` → Sprint checklist → CLI `midas-autopilot.mjs` |

Do **not** confuse the hyphenated slash `/midas-auto-pilot` with the hyphenless CLI
`midas-autopilot.mjs` (ADR-009 controller — name unchanged).

## P0 scope

- Mode: `bounded` only
- Action: `execute-next-sprint-task`
- Concurrency: 1
- Sprint pick: `active` first, else latest `planned` in `state.yaml`
- Sprint files: `{product}/sprints/NN-*.md` (greenfield) or `{product}/planning/sprint-NN-*.md` (brownfield)
- No merge, deploy, rule amendment, go/no-go, or `shipped`
- Fake runner for tests; Cursor Cloud runner optional (`--runner=cursor-cloud`)

See [ADR-009](../../docs/adr/ADR-009-optional-autonomy-control-plane.md).
