# ADR-009 — Optional bounded autonomy control plane

- **Status:** accepted
- **Date:** 2026-08-05
- **Extends:** ADR-003 (git-visible memory), ADR-007 (`.harness/` layout)
- **Related:** methodology human sign-offs; model-routing provenance; complementary continuous
  improve via `/midas-auto-pilot` (local `/loop` default + optional Cursor Automations — **not**
  this policy plane; no durable lease/budget; delivery `pr|code` caps in `templates/auto-pilot-runbook.md.tmpl`).
  Editor slash for this plane: `/midas-auto-sprints` (CLI controller remains `midas-autopilot.mjs`).

## Context

Midas is a methodology kit (markdown + validation scripts), not a long-running agent
runtime. Users want continuous iteration with deterministic policy, budget pause/resume,
and an independent auditor — without making every install depend on Cursor Cloud or
silently bypassing human sign-offs.

Chat `/loop`, stop hooks, and Cursor Automations alone are not a durable control plane:
they lack per-workflow budgets, durable leases, and a public quota-reset API.

## Decision

1. **Optional capability.** Autonomy ships as `harness/autonomy/` and installs to
   `.harness/autonomy/` only when the installer receives `--autonomy`. Fresh installs
   without the flag get no autonomy tree and no `@cursor/sdk` dependency.
2. **P0 = bounded vertical only.** One action (`execute-next-sprint-task`), concurrency 1,
   isolated branch, no merge/deploy. Irreversible methodology sign-offs remain human.
3. **Deterministic controller.** `midas-autopilot` runs ticks in order:
   lock/lease → idempotency key → budget reserve → remote effect → reconcile → state write last.
4. **Minimal state pointers.** `state.yaml` may hold short `autonomy:` pointers only;
   policy, ledger, and journal live under `.harness/autonomy/` and `{runs}/autonomy/`.
5. **Producer ≠ auditor.** Builder/scout may use Cursor Cloud; gate verdicts reuse
   `midas-orchestrator` on a detached SHA with read-only credentials. The controller
   persists the verdict.
6. **Metapolicy is agent-inaccessible.** Agents cannot mutate policy, hooks, budgets,
   credentials, or auditor config. Human out-of-band approval is required.
   Ordinary Midas skills retain `disable-model-invocation`; only `midas-autopilot`
   may start executable contracts.
7. **P1 deferred.** Profiles `custom`/`full`, auto-merge/deploy, Admin API cycle detect,
   and methodology sign-off amendments require a later ADR after the value gate passes.

## Consequences

- Base `create-midas` stays free of `@cursor/sdk`; optional package pins it when installed.
- GitHub Actions is the reference scheduler; the CLI remains portable.
- Absence of `autonomy:` in state means disabled (no effects).
- Exactly-once agent create is not promised without a remote idempotent key; delivery is
  at-least-once with reconciliation.

## Amendment — 2026-08-08

- Complementary continuous-improve slash reclaimed as `/midas-auto-pilot` (was `/midas-improve-loop`);
  evidence path `{runs}/auto-pilot/`; template `auto-pilot-runbook.md.tmpl`.
- This plane’s editor slash is `/midas-auto-sprints`; **controller CLI name unchanged**
  (`midas-autopilot.mjs` / npm bin). Deprecated alias `/midas-autopilot` → `/midas-auto-sprints`.
