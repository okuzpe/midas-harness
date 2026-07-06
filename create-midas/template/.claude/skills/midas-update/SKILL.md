---
name: midas-update
description: Upgrade an installed Midas project to the current engine version. Compares **`paths.state`**'s midas_version against the installed **`paths.version`**, applies the minimal migration (refresh engine files, re-render adapters, bump the stamp) with a dry-run + diff-confirm, and never touches your {product}/ artifacts or hand-edited files without confirmation. Use after pulling a new engine or when /midas-doctor warns of a version mismatch.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[--dry-run]"
---

# midas-update — migrate an install to the current engine

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read the state file at **`paths.state`**; if there is none, this project isn't initialized — point at `/midas-init`.

> **Paths:** Engine = `<paths.engine>/`; scripts = `<paths.scripts>/`; `{runs}/` = `paths.runs`. See `AGENTS.md` § Path resolution.

Bring an existing Midas install up to the current engine, **safely**. Read `layout` + `paths` from **`paths.state`**. Substitute `{runs}/` → `paths.runs`, `{product}/` → `paths.product` before any path below.

**Optional layout migration (classic → compact):** if the user asks to declutter the root, run `node <paths.scripts>/migrate-layout.mjs --dry-run` first, show the table, confirm, then `--apply`. This is separate from a version bump — never run silently during `--update`.

## Procedure
1. **Read versions.** `from` = state `midas_version`; `to` = engine `VERSION` at `paths.version`. If `from == to`, report "already current" and stop.
2. **Gather migration notes.** For each version between `from` and `to`, read `paths.engine/migrations/vX.Y.md`
   if present, else the `### Migration` subsection of that version's `CHANGELOG.md` entry. Summarize what changes.
3. **Plan the minimal edits (dry-run).** Engine files refresh from the new engine: `paths.engine/`
   (methodology/conventions/rules/pipeline/templates), `.claude/skills`, `.claude/agents`, `paths.scripts/`.
   **Never** rewrite `{product}/*`, state content (except the version bump), or any hand-edited
   file without a diff.
4. **Diff + confirm.** Show the diff per file and `AskUserQuestion` before writing. For files the user has
   edited outside `<!-- midas:begin -->` markers, preserve their content; only update managed regions.
   `--dry-run` prints the plan and writes nothing.
5. **Apply + re-render.** Write the confirmed changes, then re-render the tool adapters via `/midas-doctor`
   (the single render path).
6. **Bump the stamp.** Set state `midas_version = to` (read-modify-write the whole file at `paths.state`).
7. **Report.** Summarize what migrated, what was preserved, and any manual follow-ups from the notes.

## Exit gate
- [ ] `state.yaml.midas_version` equals engine `VERSION`.
- [ ] No `{product}/*` artifact or hand-edited file changed without a confirmed diff.
- [ ] Adapters re-rendered; `/midas-doctor` reports in sync.

## Tier & cost
Reading versions/notes and applying mechanical refreshes → **build** (Sonnet); judgment about a
non-trivial migration → **orchestrate** (Opus); pure extraction → **scout** (Haiku).
