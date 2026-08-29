# ADR-015: Sandbox skill-testing lab (`/midas-sandbox`)

## Status

Accepted — 2026-08-28

## Context

`scripts/fixtures/product-closed/` proves gate-record *shape* (`doctor.mjs --strict --gates-only`)
but never actually **runs** a skill with an agent — nothing in the engine repo exercises the real,
current text of `harness/skills/*` end-to-end before it ships. `docs/muninn-comparison.md` (§7)
separately flagged the absence of a blacklist of forbidden cheap/fast model variants for
review/test work as an adoptable gap. Contributors want a way to dry-run a skill/rule change
against something real, cheaply, with traceable evidence they can learn from — without turning the
engine repo into a product install (forbidden by `harness/rules/engine-repo-boundary.md`).

## Decision

1. **New engine-only skill** `harness/skills/midas-sandbox/SKILL.md` (added to
   `scripts/engine-only.mjs` `ENGINE_ONLY_SKILLS` — stripped from `cli/template` and
   `harness/plugins/midas`, same mechanism as `midas-precommit`).
2. **Nested fixture:** committed seed `sandbox/seed/` (product-root tree, including
   `.harness/state.yaml`) copied onto gitignored `sandbox/example-product/` via
   `scripts/sandbox-run.mjs reset`. Same "nested is allowed, root is not" exception as
   `scripts/fixtures/*` (`harness/rules/engine-repo-boundary.md`).
3. **Cross-repo path override (sandbox-only):** the fixture's `state.yaml` sets `paths.engine` /
   `paths.scripts` to `../../harness` / `../../scripts`, pointing back at this repo's real source
   instead of vendoring a copy — the only way a subagent runs the *current* skill text with zero
   duplication to keep in sync. A real product install must never do this.
4. **Model pin, not a new tier:** every sandbox subagent (Task tool) runs on `composer-2.5`,
   **never** `composer-2.5-fast`. This is a Cursor-only cost control orthogonal to the
   `orchestrate/build/scout` Claude-tier routing in `harness/rules/model-routing.md` — it does not
   become a fourth tier there.
5. **Human-gate substitution is logged, not silent.** Wherever a real skill would call
   `AskQuestion`, the sandbox subagent picks a default and must log
   `[SANDBOX AUTO-DECISION] <question> -> <choice> (<reason>)` — this is itself a source of
   findings (bad defaults surface), and keeps auto-decided runs distinguishable from real ones.
6. **Findings are proposals, never applied.** `sandbox/findings/*.md` (committed, curated) —
   nothing under `harness/skills/*` or `harness/rules/*` is edited by a sandbox run, same
   recommend-don't-wall spirit as `/midas-capture`.
7. **Precommit integration is a nudge, not a gate.** `/midas-precommit` Step 0 proposes
   `/midas-sandbox` via `AskQuestion` when the staged diff touches `harness/skills/**` or
   `harness/rules/**` — it never blocks the commit. This is a declarative behavior (the agent must
   remember to ask), not a mechanical git hook — the same known limitation `docs/muninn-comparison.md`
   §5.1 already names for the rest of Midas's rule enforcement.

## Consequences

- Contributors get a real, traced dry-run of a skill/rule change on a cheap model before it ships,
  closing a gap the static fixture never covered.
- Sandbox runs validate **procedure fidelity** (does the skill follow its own steps, write the
  right files, keep its `**CHECK:**`s) — not business/architecture *judgment*; a cheap model
  auto-deciding on a toy idea will not produce meaningful phase 2–4 reasoning. Findings from those
  phases must say so.
- Raw Trace spans live under the gitignored working copy (`sandbox/example-product/`, generated
  from `sandbox/seed/` via `scripts/sandbox-run.mjs reset`). Only curated `sandbox/findings/*.md`
  is committed, with a documented retention nudge (keep ~10 most recent runs).
- `/midas-sandbox --all` (full-pipeline batch) is opt-in and cost-confirmed via `AskQuestion` —
  default invocation only ever runs one skill. Precommit Step 0 recommends `--smoke`.
- Two changes ripple through mechanical checks: `docs/skills.md` catalog counts (30 primary, 2
  engine-only) and `scripts/test.mjs`'s shape-comparison filters, which previously hardcoded
  `'midas-precommit'` in six places instead of reading `ENGINE_ONLY_SKILLS` — fixed alongside this
  ADR so a third engine-only skill won't repeat the same drift.

## Amendment

- **2026-08-30** — Deterministic oracles (`sandbox/oracles/*.json`) + `sandbox-run grade`
  (`MIDAS_SANDBOX_ORACLE:`). Isolation hash of engine `harness/state.yaml` at reset. Opt-in
  `_ledger.jsonl`. Composer does not self-score.
- **2026-08-30** — `sandbox-run env` fails unless resolved `paths.state` (and product/rules/runs/cache)
  live under the working copy. Default / `--smoke` / `--all` always `reset` first. `env` prints
  `MIDAS_TRACE_ROOT:`; the parent must pass that env into every Task `trace-write` (the runner
  cannot export it to Cursor Task). Target skill runs in-process in the composer-2.5 Task — no
  nested builder on another model.
- **2026-08-28** — Isolation runner (`scripts/sandbox-run.mjs`: reset / env / trace wrappers).
  Working copy is gitignored and restored from `sandbox/seed/`. Findings require a class
  (`harness-gap` | `model-miss` | `fixture-limit` | `isolation-bug`). Template
  `skill-registry.md` is recomputed after stripping engine-only skills so installs do not keep
  ghost rows. `--smoke` = touched skill + next stage command; stage mismatch is a STOP
  robustness check (`fixture-limit` unless the abort is unusable).
