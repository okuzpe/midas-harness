# Sandbox oracles

Deterministic disk checks for `/midas-sandbox`. The cheap Task does **not** grade itself.

```bash
node scripts/sandbox-run.mjs reset
node scripts/sandbox-run.mjs grade --skill idea-intake
# after a real skill run:
node scripts/sandbox-run.mjs grade --skill idea-intake --ledger
```

| File | When |
|---|---|
| `isolation.json` | Always (merged into every `grade`) |
| `<skill>.json` | When `--skill <skill>` |

`{product}` `{state}` `{runs}` `{rules}` `{cache}` expand from the fixture `paths.*`.
Paths that resolve outside `sandbox/example-product/` fail closed.

`--ledger` appends one JSON line to `sandbox/findings/_ledger.jsonl` (opt-in so `npm test` does not pollute it).
