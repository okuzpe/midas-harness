# Auto-pilot journal

> Append-only log for `/midas-auto-pilot` cycles (local `/loop` or Cursor Automations).
> Path: `{runs}/auto-pilot/journal.md`
> **Not** a Phase-8 audit. Producer evidence only.
> Branch prefix: `midas-auto/` (`pr` may list a PR; `code` lists the session branch).
> **Result:** `pass` | `fail` | `abort` | `idle` — two consecutive `idle` rows stop the local `/loop`.

| When (ISO) | Branch / PR | Improvement (one line) | Verify command | Result | Notes |
|---|---|---|---|---|---|
| <!-- 2026-08-08T00:00:00Z --> | <!-- midas-auto/… / #NN or branch-only --> | <!-- EARS short or idle --> | <!-- npm test -w … or — --> | <!-- pass \| fail \| abort \| idle --> | <!-- delivery=pr\|code; tick-NN; idle streak --> |
