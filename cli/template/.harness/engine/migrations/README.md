# Midas engine migrations

Breaking engine version cuts ship a migration note here: `vX.Y.md` with the minimal file edits
required to move an existing install from the previous version.

Pre-1.0: most breaking changes are documented in `CHANGELOG.md` under `### Migration` until 1.0.0.

## Index

| Version | File | Status |
|---------|------|--------|
| 2.0.0 | [`v2.0.md`](v2.0.md) | Implemented by installer `--migrate` / `--migrate --apply` |
| 2.8.2 | [`v2.8.2.md`](v2.8.2.md) | Slash/path rename (auto-pilot / auto-sprints); journal migration on first `/midas-auto-pilot` |
| 2.9.5 (Unreleased) | [`v2.9.5.md`](v2.9.5.md) | Unify evolve + sprint guide under `/midas-auto-pilot`; aliases forward |

Migration receipts are written to `.harness/migrations/receipts/`; local rollback backups live under
`.harness/migrations/backups/` and are gitignored.
