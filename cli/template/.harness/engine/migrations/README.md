# Midas engine migrations

Breaking engine version cuts ship a migration note here: a purpose-slug markdown file
(`kebab-case.md`) with the minimal file edits required to move an existing install from the
previous version. The index table below maps each engine version to its note.

Pre-1.0: most breaking changes are documented in `CHANGELOG.md` under `### Migration` until 1.0.0.

## Index

| Version | File | Status |
|---------|------|--------|
| 3.0.0 | [`v3.0.md`](v3.0.md) | Role + paths; 1.x layouts refused (pin 2.10.x to migrate) |
| 2.0.0 | [`harness-layout.md`](harness-layout.md) | Historical — installer `--migrate` existed in 2.x |
| 2.8.2 | [`auto-pilot-slash-rename.md`](auto-pilot-slash-rename.md) | Slash/path rename (auto-pilot / auto-sprints); journal migration on first `/midas-auto-pilot` |
| 2.9.5 | [`auto-pilot-unify.md`](auto-pilot-unify.md) | Unify evolve + sprint guide under `/midas-auto-pilot`; aliases forward |
| 2.9.6 | [`hygiene-init-entry.md`](hygiene-init-entry.md) | `/midas-hygiene` + `/midas-init` setup/update entry; `/midas-update` deprecated |
| 2.9.8 | [`update-failure-hardening.md`](update-failure-hardening.md) | Verify fail → NEEDS_REPAIR; migrate rollback paths; install-verify doctor profile |

Migration receipts are written to `.harness/migrations/receipts/`; local rollback backups live under
`.harness/migrations/backups/` and are gitignored.
