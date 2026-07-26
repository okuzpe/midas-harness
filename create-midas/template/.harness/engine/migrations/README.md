# Midas engine migrations

Breaking engine version cuts ship a migration note here: `vX.Y.md` with the minimal file edits
required to move an existing install from the previous version.

Pre-1.0: most breaking changes are documented in `CHANGELOG.md` under `### Migration` until 1.0.0.

## Index

| Version | File | Status |
|---------|------|--------|
| 2.0.0 | [`v2.0.md`](v2.0.md) | Implemented by installer `--migrate` / `--migrate --apply` |

Migration receipts are written to `.harness/migrations/receipts/`; local rollback backups live under
`.harness/migrations/backups/` and are gitignored.
