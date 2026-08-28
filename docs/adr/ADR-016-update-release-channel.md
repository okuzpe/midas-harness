# ADR-016: Update by published release channel and content hash

## Status

Accepted — 2026-08-28

## Context

`--update` re-copied whatever bundle npx had already downloaded and compared
`manifest.midas_version` against the bundled `VERSION`. Three consequences:

- **A push to `main` was invisible.** The only way to learn that the engine had changed was to
  download the whole package and look. There was no cheap "is there anything new?".
- **`VERSION` is the wrong signal.** It moves only on `npm run bump`, so dozens of commits share one
  version. Two bundles reading `2.9.9` could differ by a hundred files.
- **The scan was not total.** Pruning covered `.harness/engine` and `.harness/scripts` via
  `pruneStaleVendorTree`, plus hardcoded lists like `pruneLegacyRootArtifacts`. A directory dropped
  from the engine survived forever on every installed project, because a copy-only install can never
  notice a file that is no longer shipped.
- **Conflicts were discarded exactly when they mattered.** With five or more modified vendor files,
  `isStaleManifestDrift` assumed old drift and silently re-baselined the manifest — the signal was
  strongest precisely when it was thrown away.

## Decision

**Publish a content hash per channel; reconcile the installed tree against it.**

1. **`tree_sha256` is the release identity.** sha256 over sorted `path\0sha256` lines for every
   `vendor` file in the built bundle. It changes when the harness changes and does not change when
   only docs or CI move. `VERSION` stays the human label; the hash is the machine one.
2. **CI publishes a small manifest to an orphan `releases` branch** — `edge.json` on every push to
   `main`, `stable.json` on every `v*` tag. A separate branch means publishing cannot retrigger the
   CI that produced it, and `raw.githubusercontent.com` serves it without shipping anything else.
   Discovery costs a few KB instead of a package download.
3. **`update` is a real subcommand**, with `--check` (read-only, exits 0 current / 1 available /
   2 undetermined), `--channel`, `--offline`, and `--manifest-file` for tests. `--update` stays a
   silent alias so existing docs and skills keep working.
4. **Reconciliation replaces pruning.** `planReconcile` diffs three inputs — the installed manifest
   (what the last install laid down), the bundle (what this one should), and the disk (what is
   actually there) — and derives create / refresh / overwrite / delete. Deleting a directory from
   the engine now propagates on its own.
5. **State migrations apply by id, not by version range** (`harness/state-migrations/NNNN-slug.mjs`,
   ledger in `state.migrations`). A semver window would never fire on `edge`, where many commits
   share a version; an id ledger is also idempotent by construction.
6. **Offline never blocks.** Every network path degrades to the on-disk cache and then to "unknown",
   and an undetermined channel is a note in the report, not a refusal.

## Consequences

**Vendor conflicts are now reported, not hidden.** The bundle still wins — vendor files are engine
property and project overrides belong in `.harness/rules/` — but the local version is copied to
`.harness/conflicts/<timestamp>/` first and `doctor` warns until it is cleared. That path is
deliberately *outside* the gitignored `.harness/cache/`, which `scrubNonInstallerCache` wipes on
rollback: the one copy of the user's work must not live in a tree designed to be disposable.

**A second update refuses while conflicts sit unresolved.** Consistent with how `apt` and `git`
treat conflicted state, and cheap to clear (delete the directory).

**Deletion is the dangerous half.** It is bounded to `vendor` files under `.harness/engine` and
`.harness/scripts`, it runs inside the existing lock/journal/backup transaction with `--rollback`,
and `--dry-run` lists every removal before anything is written. `.harness/autonomy` is excluded: the
bundle ships it from `.optional/autonomy`, so reconciling it would read as "dropped" and delete a
working install.

**`edge` serves unreviewed builds.** Hence `stable` by default and an explicit opt-in, persisted in
`state.channel` so the choice is visible in git rather than implied by a default.

## Alternatives considered

**Three-way merge of vendor files** (the original plan, with `merge3.mjs` and a content-addressed
base store). Dropped: it needs the base blob of every vendor file kept on disk forever, and it
solves a problem the methodology says should not exist — vendor files are not a place to keep local
edits, overlays are. Backup-and-report gives the user their content back without teaching them that
editing engine source is supported.

**Signing the release manifest** (sigstore/minisign). Deferred. The manifest is served over TLS from
the same origin as the package npx already trusts, so signing raises the floor only once we also
verify the package itself.

**Comparing `VERSION` alone.** Rejected above: it cannot distinguish two `edge` builds.

## References

- [INSTALL.md](../../INSTALL.md) — ownership manifest, reconciliation, and conflicts contract
- [ADR-010](ADR-010-harness-trace-observe.md) — the same fail-open posture for observation paths
- `scripts/lib/reconcile.mjs`, `scripts/release-manifest.mjs`, `cli/lib/core/release-channel.mjs`
