# Sandbox findings

One file per `/midas-sandbox` run: `<date>-<mode>.md` (`<mode>` = skill name, `smoke`, or
`all-skills`). Each file is a **proposal**, never an applied change.

Required sections: Setup · Decision-flow log · Issues found (each with a class) · Proposed
improvements. `--all` also gets `## Harness analysis`.

Issue classes (see `sandbox/README.md`): `harness-gap` | `model-miss` | `fixture-limit` |
`isolation-bug`. Only `harness-gap` is a capture/ADR candidate.

## Retention

This folder is committed (curated). Raw Trace spans stay under the gitignored working copy
(`sandbox/example-product/.harness/cache/`). Keep the most recent ~10 run files; fold still-
actionable notes into the next file or `/midas-capture` before deleting.
