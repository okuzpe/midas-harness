<!-- Seed for phase / sprint gate freezes. Skills copy fields into `{runs}/audits/gate-0N.md`
     or embed an equivalent **Artifacts** table in `{runs}/audits/audit-NN.md`.
     Shape inspired by Gentleman Ch.20 phase result contracts — markdown only, no SQLite. -->

# Phase result — <phase or sprint id>

Ran: <YYYY-MM-DD> · Tier: orchestrate | build | scout

## Status
<!-- pass | fail | blocked | redo -->

## Executive summary
<!-- One short paragraph: what this phase claimed to finish. -->

## Artifacts
| Path | Exists | Notes |
|---|---|---|
| <!-- `{product}/…` or `{runs}/…` --> | yes / no | |

Every path claimed above must exist on disk before the gate advances. A `verdict=pass` /
`status: done` with an empty Artifacts table, or with a missing path, is a fail.

## Risks
<!-- Residual risks, assumptions, or deferred items. "None" is allowed when honest. -->

## Next
<!-- Recommended next stage command or sprint task. -->

## Tally
```
MIDAS_PHASE_RESULT: status=pass|fail|blocked artifacts=N missing=0 next=<command>
```

## Checklist (Phase-8 / gate auditor)

- [ ] Artifacts table is non-empty when claiming pass.
      **CHECK:** `manual:` for each `{runs}/audits/gate-0N.md` or `audit-NN.md` with
      `verdict=pass` / `MIDAS_*_RESULT` … `verdict=pass`, the record lists artifact paths and each
      path exists on disk; advancing with no Artifacts list (or a missing path) is a fail.
