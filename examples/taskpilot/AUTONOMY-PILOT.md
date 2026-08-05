# TaskPilot × Midas autonomy pilot notes

See canonical protocol: [`harness/autonomy/pilot.md`](../../harness/autonomy/pilot.md).

This example remains a **content fixture** (hub layout). For the P0 control-plane pilot, copy
product sprints into a fresh v2 install created with `--autonomy`, or point
`midas-autopilot --root` at a harness-layout sandbox seeded from these files.

## Seed checklist

- [ ] Baseline manual timing recorded
- [ ] `midas-autopilot setup` + `dry-run` green
- [ ] Three fake-runner ticks completed
- [ ] One optional cloud run within reserve
- [ ] Value-gate table filled (pass/fail)
- [ ] P1 expansion decision recorded (expand / hold bounded)
