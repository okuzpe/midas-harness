# Sandbox findings

One file per `/midas-sandbox` run: `<date>-<mode>.md` (`<mode>` = skill name, `smoke`, or
`all-skills`). Each file is a **proposal**, never an applied change.

Required sections: Setup (cite `MIDAS_SANDBOX_ORACLE:`) · Decision-flow log · Issues found
(each with a class) · Proposed improvements. `--all` also gets `## Harness analysis`.

Issue classes (see `sandbox/README.md`): `harness-gap` | `model-miss` | `fixture-limit` |
`isolation-bug`. Only `harness-gap` is a capture/ADR candidate. Oracle failures are
`isolation-bug` (engine state / env) or `harness-gap` (missing artifact the skill should have
written) — never re-grade them as vibes.

`_ledger.jsonl` is append-only (`grade --ledger`). Keep curated run files; fold still-actionable
notes into the next file or `/midas-capture` before deleting.

## Retention

This folder is committed (curated). Raw Trace spans stay under the gitignored working copy
(`sandbox/example-product/.harness/cache/`). Keep the most recent ~10 run files; fold still-
actionable notes into the next file or `/midas-capture` before deleting.
