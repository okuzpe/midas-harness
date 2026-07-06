---
name: midas-bundle
description: Export or import Midas project knowledge as portable JSON — state, product lifecycle docs, stack rules, playbooks, frozen evidence, MCP/enforcement config (no secrets), optional tests. Use to seed a new project, share a subset between repos, or backup selective memory. Complements git; does not replace it. Runs scripts/bundle.mjs deterministically; optional brief on export.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "export|import [--profile full|memory|knowledge|...] [-o file.json] [--dry-run] [--merge|--replace] [--replace-state]"
---

# midas-bundle — export/import portable project knowledge (JSON)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.

> **Paths:** Read `layout` + `paths` from **`paths.state`**. Scripts = `<paths.scripts>/bundle.mjs`.
> Full memory model: `<paths.engine>/research/memory-model.md`.

Exports or imports **Midas knowledge** (not a full code backup) as a versioned JSON bundle. Paths inside
the bundle use **classic canonical** coordinates (`harness/`, `.harness/`); import remaps for compact layout.

## Profiles

| Profile | Use when |
|---|---|
| `knowledge` | Share ideas, architecture, playbooks only |
| `memory` | Seed a new project (product + stack rules; **no state** overwrite on merge) |
| `full` | **default** — memory + frozen evidence + `.mcp.json` + enforcement configs |
| `config` | tools/MCP/routing/enforcement only |
| `tests` | full + `*.test.*` / `*.spec.*` under `product/` |
| `recall` | Same path set as `/midas-recall` (~15 files) |

## Export

```bash
node <paths.scripts>/bundle.mjs export --profile memory -o midas-bundle.json
node <paths.scripts>/bundle.mjs export --only product/playbooks,product/conventions.md -o rules-pack.json
node <paths.scripts>/bundle.mjs export --profile full --include-tests -o full-plus-tests.json
```

- Fails if `.mcp.json` contains literal secrets (only `${ENV_VAR}` allowed).
- Warns (non-blocking) if other bundled files match common secret patterns.
- Rejects unknown `--profile` values.
- Import verifies per-file `sha256` checksums.

## Import

**Always dry-run first:**

```bash
node <paths.scripts>/bundle.mjs import midas-bundle.json --dry-run
node <paths.scripts>/bundle.mjs import midas-bundle.json --merge
node <paths.scripts>/bundle.mjs import midas-bundle.json --replace   # user confirmed only
node <paths.scripts>/bundle.mjs import midas-bundle.json --merge --replace-state  # explicit PC copy
```

| Flag | Behaviour |
|---|---|
| `--merge` | Write only paths that do not exist |
| `--replace` | Overwrite existing files (confirm with user first) |
| `--replace-state` | Always write `state.yaml` when in the bundle — **never** use silently; gates are not re-run |

After a successful import, suggest `/midas-doctor --fix` so adapters match imported rules.

## Recommended flows

**Seed new project:** export `--profile memory` from source → `npx create midas` + `/midas-init` on dest →
import `--merge` (state stays from init) → `/midas-doctor --fix`.

**Share rules/playbooks:** export `--only harness/rules,product/playbooks,product/conventions.md`.

## Hard boundaries

- Does **not** advance `stage` or gates.
- Does **not** export `product/src/` unless `--include-src`.
- Does **not** export lockfiles or generated adapters (`CLAUDE.md`, `.cursor/rules/*`).
- JSON is transport only — imported files live in git like any other artifact.

## Exit gate

- [ ] Profile/`--only` matches the user's stated goal.
- [ ] Export: `MIDAS_BUNDLE_RESULT` printed; user knows output path.
- [ ] Import: `--dry-run` shown before `--merge` or `--replace`.
- [ ] `--replace` / `--replace-state` only after explicit user confirm.
- [ ] Post-import: `/midas-doctor --fix` surfaced when rules or conventions changed.
