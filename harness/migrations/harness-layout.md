# Migration — harness layout (from classic / compact / hub)

Midas replaces classic, compact, and hub project layouts with one `.harness/` tree.

```powershell
npx github:okuzpe/midas-harness#v{VERSION} --migrate
npx github:okuzpe/midas-harness#v{VERSION} --migrate --apply
```

Substitute `{VERSION}` with the tag matching `harness/VERSION` / the pin in `INSTALL.md`
(e.g. the current stable release tag).

The first command is read-only. The second stages and hash-verifies the target, moves only
schema-known or signature-identified Midas files, preserves unknown application files, installs the
engine under `.harness/engine/`, generates host mirrors, and requires `doctor --strict` to pass.
Any failure restores the pre-migration tree.

`--update` does not perform this migration.
