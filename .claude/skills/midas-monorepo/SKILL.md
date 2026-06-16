---
name: midas-monorepo
description: Set up Midas across a MONOREPO / polyglot repo — detect every package (npm/pnpm/yarn workspaces, turbo, nx, go modules, cargo workspaces, python sub-packages), write a nested AGENTS.md per package (nearest-file-wins) referencing the root harness + per-package stack, and index them in state.yaml. Use after /midas-init (or /midas-adopt) when one repo holds multiple packages.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-required: [context7, sequential-thinking]
argument-hint: "[--dry-run] [path/to/package ...]"
---

# midas-monorepo — multi-package / polyglot setup

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; this skill assumes the **root** harness is already initialized
> (`/midas-init` or `/midas-adopt`). If there is no root `state.yaml`, stop and point at `/midas-init`.

Bring Midas to a repository that holds **many packages** (a workspace monorepo, or a polyglot repo with
language sub-trees), so each package gets agent guidance tuned to **its own stack** while inheriting the
**one** root harness. The mechanism is **nested files + nearest-file-wins**: an agent working inside a
package reads that package's `AGENTS.md` first, which references the root.

> **Dry-run + diff-confirm (brownfield doctrine).** Never overwrite a pre-existing nested `AGENTS.md`,
> `CLAUDE.md`, or source file. New files may be written directly; for any existing file you only *append
> inside* managed `<!-- midas:begin -->` … `<!-- midas:end -->` markers, and only after showing the exact
> diff and getting `AskUserQuestion` confirmation. `--dry-run` shows the full plan and writes nothing.

---

## Procedure (DETECT → INDEX → WRITE)

### Step 1 — Detect packages (scout, read-only)
Dispatch **scout** subagents to enumerate every package without modifying anything. A "package" is any
unit with its own manifest/boundary. Recognize at least:

- **JS/TS workspaces** — `package.json` `workspaces`, `pnpm-workspace.yaml`, `yarn` workspaces; the
  `turbo.json` and `nx.json` package graphs (read them to discover members, not to invent them).
- **Go** — every directory with a `go.mod` (each is a module root).
- **Rust** — `Cargo.toml` `[workspace] members` and each member crate's own `Cargo.toml`.
- **Python** — sub-packages declared by `pyproject.toml` / `setup.cfg` / `setup.py` in sub-trees, or a
  uv/poetry workspace.
- **Other** — a directory the user names on the command line (`path/to/package`), or an obvious
  service/app boundary (its own `Dockerfile` + manifest).

For each, record: path, name, ecosystem, primary language/framework, and **pinned versions** (from the
package's own lockfile/manifest — not the root's). Do **not** Context7-verify yet; that is per-package in
Step 3. Skip `node_modules`, vendored deps, and build output. Report the discovered list (path • name •
stack • version hints) and let the user deselect any before writing.

### Step 2 — Index packages in state.yaml (root spine, read-modify-write)
There is exactly **one** state file (`harness/state.yaml`). Add a root `packages:` list — the index of
every member. Read-modify-write the whole file; never create a second state model.

```yaml
packages:                       # root index of monorepo members (omit for single-package repos)
  - path: apps/web              # repo-relative dir holding the package
    name: web                   # package slug
    ecosystem: pnpm             # pnpm | yarn | npm | turbo | nx | go | cargo | python | other
    language: typescript        # primary language
    stack: "next@15, react@19"  # one-line stack hint (Context7-verified in Step 3)
    agents_file: apps/web/AGENTS.md
    overrides: []               # e.g. [conventions, design-system] — see Step 4
  - path: services/api
    name: api
    ecosystem: go
    language: go
    stack: "go 1.23, chi"
    agents_file: services/api/AGENTS.md
    overrides: [conventions]
```

The root stage/phase ledger is **unchanged** — packages are an index, not a parallel lifecycle. A package
may carry its own sprints later, but the gates still advance once, at the root.

### Step 3 — Write a nested AGENTS.md per package (orchestrate)
For **each** package write `<path>/AGENTS.md`. It is short and **defers to the root** — it never restates
base conventions. Before naming any framework API, **Context7-verify that package's pinned versions**
(`resolve-library-id` → `get-library-docs` at the version from *this* package's lockfile); route the
fetches to **scout**. Template:

```markdown
<!-- midas:begin -->
# AGENTS.md — <package name> (<ecosystem>)

> Nested Midas file. **Nearest-file-wins:** agents working in `<path>/` follow this file; it inherits
> everything from the root. Do not duplicate base law here.

## Inherits
- Root harness & project law: [`../../AGENTS.md`](../../AGENTS.md) and `harness/conventions.md`
  (adjust the relative depth to this package).
- Always-on rules in `harness/rules/` (Context7-before-third-party-code applies here too).

## This package
- **Stack:** <language/framework @ pinned versions — Context7-verified>.
- **Build / test:** <the package's own commands>.
- **Stack-specific rules:** <link any per-package rule file, or "none beyond root">.
- **Overrides:** <link `<path>/conventions.md` / `<path>/design-system.md` if present, else "none">.
<!-- midas:end -->
```

If `<path>/AGENTS.md` **already exists**, apply the brownfield doctrine: compute only the managed-marker
block, **show the diff**, and `AskUserQuestion` to confirm before appending. On decline, print the block
for manual paste. Never rewrite the hand-authored part of an existing nested file.

### Step 4 — Per-package overrides (documented precedence)
A package may override conventions or the design system locally. Keep the **single taxonomy** — the
precedence chain just gains a per-package layer at the top:

```
package stack rules  >  package conventions/design-system  >  root stack rules
  >  product/conventions.md  >  product/design-system.md  >  base conventions
```

So a `<path>/conventions.md` or `<path>/design-system.md` wins **inside that package only**, above the
root overrides, and the package's `AGENTS.md` links it (and the `overrides:` field in `state.yaml` lists
which layers it sets). UI in a package still references **tokens** (the package's own `tokens.json` if it
overrides, else the root's) — never hardcoded values. Don't fork the root design system unless the
package genuinely ships a different surface; record the rationale if you do.

### Step 5 — Adapters (single render path)
Per-tool adapters (`CLAUDE.md` shim, Cursor/Windsurf rules) are still rendered by **one** engine. Run
`/midas-doctor` (or `node scripts/render-adapters.mjs`) so any nested `CLAUDE.md` import shims and the
root adapters stay in sync; never hand-author an adapter.

---

## Exit gate (monorepo wired)
- [ ] Every package detected and listed in `state.yaml.packages[]` (path • name • ecosystem • language • stack • agents_file).
- [ ] A nested `AGENTS.md` exists per package, deferring to the root via nearest-file-wins; no base law duplicated.
- [ ] Each package's stack versions **Context7-verified** against *its own* lockfile (or a logged web-fallback note).
- [ ] No pre-existing nested `AGENTS.md` / `CLAUDE.md` / source modified without a confirmed diff (or `--dry-run` wrote nothing).
- [ ] Per-package `conventions.md` / `design-system.md` overrides (if any) linked, with `overrides:` recorded and precedence honored.
- [ ] Adapters re-rendered through `/midas-doctor`; `state.yaml` read-modify-written once.
- [ ] Next action printed (usually `/midas-status`, then `/plan-sprints` or per-package sprint work).

## Tier & cost
Package discovery, manifest/version extraction, and Context7 fetches → **scout** (Haiku) — mechanical,
high-volume. The package taxonomy, every override/precedence decision, and each diff/confirm call →
**orchestrate** (Opus). Drafting the nested `AGENTS.md` bodies → **build** (Sonnet). One read-modify-write
of the root `state.yaml`; one render pass via `/midas-doctor` — no second state model, no per-tool copies.
