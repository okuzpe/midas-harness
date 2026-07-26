# Monorepo wiring — nested AGENTS.md per package

Shared procedure for multi-package / polyglot repos. Invoked by:

- **`/midas-init --monorepo`** (preferred) — optional Phase F at the end of one-time setup
- **`/midas-init`** when the scan detects workspace markers and the user confirms in Phase D
- **`/midas-monorepo`** (deprecated alias) — redirects here

Bring Midas to a repository that holds **many packages** so each package gets agent guidance tuned to
**its own stack** while inheriting the **one** root harness. Mechanism: **nested files +
nearest-file-wins** — an agent inside a package reads that package's `AGENTS.md` first, which references
the root.

> **Dry-run + diff-confirm (brownfield doctrine).** Never overwrite a pre-existing nested `AGENTS.md`,
> `CLAUDE.md`, or source file. New files may be written directly; for any existing file only append inside
> managed `<!-- midas:begin -->` … `<!-- midas:end -->` markers, and only after showing the diff and
> getting user confirmation. `--dry-run` shows the full plan and writes nothing.

## Procedure (DETECT → INDEX → WRITE)

### Step 1 — Detect packages (scout, read-only)

Dispatch **scout** subagents to enumerate every package without modifying anything. Recognize at least:

- **JS/TS workspaces** — `package.json` `workspaces`, `pnpm-workspace.yaml`, `yarn` workspaces; `turbo.json`
  and `nx.json` package graphs.
- **Go** — every directory with a `go.mod`.
- **Rust** — `Cargo.toml` `[workspace] members` and each member crate.
- **Python** — sub-packages in `pyproject.toml` / uv/poetry workspaces.
- **Other** — user-named paths or obvious service boundaries (own `Dockerfile` + manifest).

For each, record: path, name, ecosystem, language/framework, **pinned versions** (from the package's own
lockfile). Skip `node_modules`, vendored deps, build output. Report the list and let the user deselect
any before writing.

### Step 2 — Index packages in state.yaml

There is exactly **one** state file (`paths.state`). Add root `packages:` — read-modify-write the whole
file; never create a second state model.

```yaml
packages:
  - path: apps/web
    name: web
    ecosystem: pnpm
    language: typescript
    stack: "next@15, react@19"
    agents_file: apps/web/AGENTS.md
    overrides: []
```

The root stage ledger is **unchanged** — packages are an index, not a parallel lifecycle.

### Step 3 — Write nested AGENTS.md per package

For each package write `<path>/AGENTS.md`. Short, **defers to root** — never restates base conventions.
Context7-verify that package's pinned versions before naming framework APIs (scout tier). Template:

```markdown
<!-- midas:begin -->
# AGENTS.md — <package name> (<ecosystem>)

> Nested Midas file. **Nearest-file-wins:** agents in `<path>/` follow this file; it inherits the root.

## Inherits
- Root: [`../../AGENTS.md`](../../AGENTS.md) and `<paths.engine>/conventions.md`
- Always-on rules in `<paths.engine>/rules/`

## This package
- **Stack:** <language/framework @ pinned versions — Context7-verified>
- **Build / test:** <package commands>
- **Overrides:** <link local conventions/design-system or "none">
<!-- midas:end -->
```

If `<path>/AGENTS.md` exists, brownfield doctrine: show diff, confirm before appending.

### Step 4 — Per-package overrides (precedence)

```
package stack rules  >  package conventions/design-system  >  root stack rules
  >  {product}/conventions.md  >  {product}/design-system.md  >  base conventions
```

Record `overrides:` in `state.yaml` for each package that sets local layers.

### Step 5 — Adapters

Run `/midas-doctor` (or `node <paths.scripts>/render-adapters.mjs`) so root adapters stay in sync.

## Exit gate

- [ ] Every package in `state.yaml.packages[]`
- [ ] Nested `AGENTS.md` per package (nearest-file-wins; no duplicated base law)
- [ ] Stack versions Context7-verified per package lockfile
- [ ] No pre-existing nested file modified without confirmed diff
- [ ] Adapters re-rendered; state read-modify-written once
- [ ] Next: `/midas-status`, then `/plan-sprints` or per-package sprint work
