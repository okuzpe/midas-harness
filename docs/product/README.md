# Engine repo — no product lifecycle here

This directory is **not** a Midas product install. The midas-harness engine repository authors
methodology in `harness/` and ships it via `cli/` — it does **not** run Phase 0–8 on itself.

| What | Where |
|---|---|
| Engine source | `harness/`, `scripts/`, `cli/` |
| Lifecycle CI fixture | `scripts/fixtures/product-closed/` |
| Contributor Trace cache | `runs/cache/` (gitignored) |

Product installs use `{product}/` under their project root (see ADR-007). Do not add sprint plans,
feature ledgers, or audit evidence here unless you are intentionally reviving engine dogfood.
