# Coverage baseline (engine unit tests)

Measured with `npm run coverage` (`node --test --experimental-test-coverage` over
`scripts/lib/unit-test-files.mjs`). No third-party coverage tool.

Columns match Node's report: **line % | branch % | function %**.

| Date | Node | Line % | Branch % | Function % | `cli/lib/runtime/execute.mjs` line % | Notes |
|---|---|---|---|---|---|---|
| 2026-08-30 | 22+ | 76.37 | 67.80 | 77.19 | 65.71 | Phase 0 floor — later phases must not regress the all-files or execute.mjs rows |
| 2026-08-30 | 22+ | 77.04 | 67.30 | 77.33 | 67.78 | 3.0.0 cut — F0–F6 complete |

Re-measure after each phase that touches `cli/lib/` or `scripts/lib/` and append a row.
The Phase-3 gate is: `cli/lib/runtime/` coverage at or above this floor.
