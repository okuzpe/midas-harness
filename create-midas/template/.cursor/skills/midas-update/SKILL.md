---
name: midas-update
description: "Upgrade an installed Midas project to the current engine version. Compares **`paths.state`**'s midas_version against the installed **`paths.version`**, applies the minimal migration (refresh engine files, re-render adapters, bump the stamp) with a dry-run + diff-confirm, and never touches your {product}/ artifacts or hand-edited files without confirmation. Use after pulling a new engine or when /midas-doctor warns of a version mismatch."
metadata:
  midas-argument-hint: "[--dry-run]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-update — migrate an install to the current engine

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read the state file at **`paths.state`**; if there is none, this project isn't initialized — point at `/midas-init`.

> **Paths:** Engine = `<paths.engine>/`; scripts = `<paths.scripts>/`; `{runs}/` = `paths.runs`. See `AGENTS.md` § Path resolution.

> **Wrong command?** If install vs update vs init is unclear, run `npx github:okuzpe/midas-harness --diagnose`
> (terminal, works even before Midas is installed) or `/midas-reconcile` after install — both are read-only.

Bring an existing canonical v2 install up to the current engine, **safely**. Read `layout` + `paths`
from **`paths.state`**. If the project is classic, compact, or hub 1.x, stop without writing and point
to `npx github:okuzpe/midas-harness#v2.0.0 --migrate`; applying requires the explicit `--apply`.

## Procedure
1. **Read versions.** `from` = state `midas_version`; `to` = engine `VERSION` at `paths.version`. If `from == to`, report "already current" and stop.
2. **Gather migration notes.** For each version between `from` and `to`, read `paths.engine/migrations/vX.Y.md`
   if present, else the `### Migration` subsection of that version's `CHANGELOG.md` entry. Summarize what changes.
3. **Plan the minimal edits (dry-run).** Use `.harness/manifest.json`: intact `vendor` files may refresh;
   `generated` regions/mirrors may regenerate; `user` paths never overwrite. A vendor mismatch aborts
   before writing. Preserve product, project rules, runs, MCP, and state except the version stamp.
4. **Diff + confirm.** Show the diff per file and `AskUserQuestion` before writing. For files the user has
   edited outside `<!-- midas:begin -->` markers, preserve their content; only update managed regions.
   `--dry-run` prints the plan and writes nothing.
5. **Apply + re-render + gitignore.** Prefer
   `npx github:okuzpe/midas-harness#v2.0.0 --update` (refreshes engine, **merges `.gitignore`**
   from the new snippet, re-renders adapters). Pass `--tools=cursor` (or your subset) to rewrite
   `state.tools` and prune orphan host mirrors. Or write confirmed files then
   `node <paths.scripts>/doctor.mjs --fix` (adapters **and** gitignore upgrade).
6. **Bump the stamp.** Set state `midas_version = to` (read-modify-write the whole file at `paths.state`).
7. **Report.** Summarize what migrated, what was preserved, **gitignore status** (written / upgraded /
   already up to date), and any manual follow-ups from the notes.

## Exit gate
- [ ] `paths.state → midas_version` equals engine `VERSION`.
- [ ] No user-owned product, rule, run, MCP, state, or content outside generated markers changed.
- [ ] Adapters re-rendered; `/midas-doctor` reports in sync.
- [ ] `gitignore:midas-block` is `ok` (`node <paths.scripts>/doctor.mjs`).

## Tier & cost
Reading versions/notes and applying mechanical refreshes → **build** (Sonnet); judgment about a
non-trivial migration → **orchestrate** (Opus); pure extraction → **scout** (Haiku).
