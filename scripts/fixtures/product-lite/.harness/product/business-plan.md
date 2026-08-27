# Business plan — product-lite

Lite Idea+Plan stub (not a skipped file). Sourced from `{product}/idea.md`. `{product}/market.md` is
intentionally absent.

## MVP scope

- Prove `track: lite` can plan a sprint without `market.md`.

## MVP non-goals (explicit exclusions)

- Market research artifact
- Production deploy

## Success metrics

| Metric | Target | Measurement method | Time horizon |
|---|---|---|---|
| Fixture tests pass | `pipeline:lite` checks green | `node scripts/test.mjs` | this engine commit |

## Go / no-go recommendation

**Verdict:** go

**Rationale:** Lite GO-assumed from the idea; desk validation deferred with the `market_research`
assumption in `paths.state`.
