# Migration — update/migrate failure hardening

Installer outcomes for post-apply verify failure and classic→harness rollback paths
(SinFalta-shape fix). Engine **2.9.8+**.

## What changed

| Before (≤2.9.7) | After (2.9.8+) |
|---|---|
| `--update` promoted to migrate but rollback used **vendor-only** paths | Effective `migrate` flags → **full** path list (`harness/`, `product/`, …) |
| Doctor verify **throw** → catch `ROLLED_BACK` wiped `.harness/engine` without restoring classic | Verify fail → **`NEEDS_REPAIR` (exit 6)**; tree left in place; `active.json` kept |
| Installer verify used full `doctor --strict` (could abort on `rules:combined` / `mcp:governance`) | Verify uses `--profile=install-verify`; full strict remains for humans |
| Broken leftover `.harness/product` diagnosed as `not_installed` | Diagnose **`partial_migrate`** with rollback / git tips |

## Recovery

1. Healthy refresh: `npx github:okuzpe/midas-harness#v2.9.8 --update --yes`
2. After `NEEDS_REPAIR`: fix doctor findings → `--update --resume --yes`, or `--update --rollback --yes`
3. Pre-2.9.8 broken trees with no journal: `git restore` then pinned `--update` (**not** `#v2.9.6`)

## Anti-typo

| Token | Role |
|---|---|
| `NEEDS_REPAIR` / exit 6 | Verify failed after apply — **not** a destructive rollback |
| `ROLLED_BACK` / exit 5 | Apply/I/O throw — journal restore |
| `doctor --strict` | Full human profile |
| `doctor --strict --profile=install-verify` | Installer post-apply only |
