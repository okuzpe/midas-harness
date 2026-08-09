# Installer outcomes and exit codes

Deterministic `create-midas` / `npx … --update|--migrate` lifecycle. No AI is used for install,
update, migrate, or uninstall. See [ADR-012](./adr/ADR-012-muninn-adaptations.md) § durable installer
resume (P1) and comparative notes in `docs/analisis/muninn-audit/04-install-lifecycle.md` (F-019…F-022).

**Not Muninn.** Midas does **not** use `.muninn/installer/` or `.ai-flow/` install state. All durable
installer artifacts live under **`.harness/cache/installer/`** (gitignored via `.harness/cache/`).
Version stamp remains `.harness/engine/VERSION` (committed vendor tree).

## Where state lives

| Path | Meaning |
|------|---------|
| `{paths.cache}/installer/active.json` | Active or interrupted operation (`run_id`, `started_at`, `command`, `step`, `pid`, `hostname`) |
| `{paths.cache}/installer/install.lock` | Exclusive lock (`pid` + `host`; stale locks removed when process is dead) |
| `{paths.cache}/installer/runs/<runId>/journal.ndjson` | Ordered journal ops: `start`, `backup`, `resume`, `restored`, `complete`, `needs_repair`, `rolled_back`, `rollback` |
| `{paths.cache}/installer/runs/<runId>/backups/` | Pre-change file snapshots referenced by the journal |

`{paths.cache}` resolves to `.harness/cache/` on v2 installs (`paths.state`).

## Outcomes and exit codes

Stable codes for CI and scripts. JSON mode (`--json`) echoes `outcome` and `exit_code` on the result
envelope when wired.

| Outcome | Exit | Meaning | Emitted today? |
|---------|-----:|---------|----------------|
| `COMPLETED` | 0 | Apply + verify succeeded; `active.json` cleared | Yes |
| `COMPLETED_WITH_WARNINGS` | 0 | Success; doctor reported warnings only | Reserved |
| `DRY_RUN_COMPLETE` | 0 | `--dry-run` or migrate preview — plan only, no writes | Exit 0 (outcome label optional) |
| `CANCELLED` | 130 | User declined confirmation (TTY) | Yes |
| `FAILED_FATAL` | 1 | Unexpected error, corrupt run state, engine-repo refuse, **or** preflight/check failure | Yes (preflight currently uses 1, not 7) |
| `LOCK_HELD` | 2 | Another live installer holds `install.lock` | Yes |
| `INCOMPLETE` | 3 | Prior `active.json` blocks a new apply — run `--resume` or `--rollback` | Yes |
| `FAILED_VERIFY` | 4 | Post-apply verify failed (strict) — reserved; verify fail today uses `NEEDS_REPAIR` (6) | Reserved |
| `ROLLED_BACK` | 5 | Apply failed; in-process restore from durable/tmpdir backups | Yes |
| `NEEDS_REPAIR` | 6 | Verify failed after apply; `active.json` kept | Yes |
| `FAILED_PREFLIGHT` | 7 | Requirements/checks failed before lock — reserved; today exits **1** | Reserved |

**`active.json` fields (implemented):** `run_id`, `started_at`, `command`, `step`, `pid`, `hostname`
(no `schema_version` / `outcome` yet).

**Today:** `cli/lib/runtime/execute.mjs` acquires `install.lock`, writes `active.json` +
`journal.ndjson`, and stores durable backups under `runs/<runId>/backups/`. Outcomes
`LOCK_HELD` (2), `INCOMPLETE` (3), `ROLLED_BACK` (5), `NEEDS_REPAIR` (6), and `CANCELLED` (130)
are emitted when those paths fire. In-process rollback uses `cli/lib/core/transaction.mjs`
(durable when `runId` set; tmpdir otherwise). `--rollback` requires journal `backup` ops —
never deletes trees without restore sources.

Intentional `npx … --update --rollback` (or `--migrate --apply --rollback`) restores journal backups,
clears `active.json`, and reports `COMPLETED` (exit `0`, warning in stderr) so undo success is scriptable.

## Recovery flags

| Flag | When |
|------|------|
| `--resume` | Continue the run named in `active.json` (re-apply; same `run_id`) |
| `--rollback` | Reverse backups from `journal.ndjson`, clear `active.json`, do not re-apply |

Wiring: `cli/lib/runtime/execute.mjs` (durable journal + lock); argv parsing: `cli/lib/cli/args.mjs`.

```bash
# After exit 3 or 6 with active.json present
npx github:okuzpe/midas-harness#vX.Y.Z --update --resume --yes
npx github:okuzpe/midas-harness#vX.Y.Z --update --rollback --yes
```

## Preserve policy (unchanged)

Durable installer state does **not** change copy/merge rules. `cli/lib/core/preserve-policy.mjs` still
governs plan + execute: product (`{product}/`), rules, `state.yaml`, runs, cache, autonomy user files,
and host skill mirrors on fresh install are preserved; engine + scripts vendor paths refresh on
`--update`. See F-023 in the Muninn audit — **do not regress** when adding journal/backup I/O.

Durable backups live under `{paths.cache}/installer/runs/<runId>/backups/`. Rollback path lists must
**not** include `.harness` or `.harness/cache` as wholes (self-subdir `cpSync` would fail); vendor
children are snapshotted instead, and non-`installer` cache files are scrubbed on rollback.

## Lifecycle sketch

```text
detect → checks → plan → confirm → lock + active.json + journal
  → apply (preserve-policy) → verify → clear active → COMPLETED (0)
  → kill / verify fail → NEEDS_REPAIR / INCOMPLETE (3|6) → --resume | --rollback
  → apply throw → journal reverse → ROLLED_BACK (5)
```

## Related

- [ADR-012 — Muninn pattern adaptations](./adr/ADR-012-muninn-adaptations.md)
- `cli/README.md` — flags and lifecycle phases
- `cli/lib/core/preserve-policy.mjs` — preserve / vendor-path rules
- Backlog: **Durable installer runs** (`docs/analisis/muninn-audit/backlog.md`) — Status `APPROVED`
