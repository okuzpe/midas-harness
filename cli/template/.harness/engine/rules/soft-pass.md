# Rule: No soft-pass on gates (always-on)

Agents must not substitute **observability**, **prose approval**, or **missing artifacts** for a
real gate pass. Verification and close-sprint gates require **runnable evidence** — not Trace spans,
not "tests look green", not checkbox prose without receipts.

Pairs with [`verification.md`](./verification.md) ("blocked, never a silent pass"),
[`cursor-safety-hooks.md`](./cursor-safety-hooks.md) (Trace observe ≠ safety deny), and
[ADR-012](../../docs/adr/ADR-012-muninn-adaptations.md) § gate receipts for production diffs.

## What is not a pass

- **Trace spans** — Harness Trace hooks are fail-open and observe-only
  ([ADR-010](../../docs/adr/ADR-010-harness-trace-observe.md)); a recorded span does not prove a
  gate ran or passed.
- **Missing gate receipts** — When production paths changed, `{paths.cache}/gates/<run>/` must hold
  `test.json` / `quality.json` with **`isPassingReceipt`** semantics (`pass` or `skipped` + reason),
  an explicit skip in `{runs}/sprints/NN-progress.md` or audit notes, or a `/midas-diff-gates` run.
  Absence is **`blocked`**, not pass.
- **Prose "looks good"** — Narrative approval without command output, receipt JSON, or verify-record
  rows is not evidence.

## Checklist

- [ ] Production-diff gate claims cite machine evidence, not Trace or vibes.
      **CHECK:** `node <paths.scripts>/doctor.mjs --gates-only` reports `ok` or `skip` for
      `gate:diff-receipts` (passing `{paths.cache}/gates/<run>/{test,quality}.json` or no production
      diff). Citing only Trace output is a fail.
- [ ] Trace and safety are not conflated as gate proof.
      See [`cursor-safety-hooks.md`](./cursor-safety-hooks.md) (Trace observe ≠ safety deny) — not restated here.

## Amendment

- **2026-08-09** — P3 / Phase 6: soft-pass ban for gate receipts and verification (F-026); Trace ≠
  enforcement per ADR-012 and `cursor-safety-hooks.md`.
