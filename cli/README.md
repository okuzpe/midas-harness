# create-midas

> Package lives at `cli/` in the midas-harness engine repository; published npm name is **`create-midas`**.

Install the [**Midas**](https://github.com/okuzpe/midas-harness) product-development harness into any
project — a copy-in kit of markdown skills, rules, agents, and an `AGENTS.md` that drives a product
from idea to shipped code through 9 audited phases, across Claude Code, Cursor, Copilot, Codex and
Windsurf.

```bash
npm create midas            # install into the current directory
npm create midas my-app     # install into ./my-app
```

Works with every package manager (one published package serves all):

```bash
pnpm create midas        #  or:  pnpm dlx create-midas
yarn create midas
npx create-midas
bunx create-midas
```

Then open the project in **Claude Code** (or Cursor) and run `/midas-init` to configure the harness,
followed by `/midas-status`.

## Lifecycle

Deterministic CLI (no AI required):

`requirements → checks → plan → confirm → execute → verify → result/rollback`

## What it does
- Installs the v2 harness under **`.harness/`** (engine + scripts + product/rules/runs layout), plus
  host discovery mirrors (`.claude/skills`, `.cursor/skills`, or `.agents/skills` per `--tools`).
- **Non-destructive:** files that already exist are skipped (use `--force` to overwrite). It only
  adds files — it never deletes yours.
- Generates selected-host mirrors/adapters from canonical `.harness/engine/skills` and rules.
- Prints a **per-tool compatibility summary** and onboarding steps (Cursor MCP reload, Gemini extension link, Codex AGENTS.md, …).

Existing `AGENTS.md` / `.claude/CLAUDE.md` are preserved outside Midas markers; run `/midas-init` to merge conventions into
them.

## Options
- `--force` — overwrite files that already exist.
- `--migrate` — preview a v1 classic/compact/hub migration; add `--apply` to execute transactionally.
- `--update` — refresh a v2 engine; preserves state, product, rules, runs, and user-owned config.
- `--uninstall` — remove Midas-installed files (with confirmation on TTY).
- `--tools=<list>` — e.g. `cursor`, `cursor,gemini,codex`, or `claude-code,cursor,windsurf,gemini`.
- `--dry-run` — plan only for install / update / migrate / uninstall — write nothing.
- `--json` — machine-readable diagnose / plan / result envelope on stdout.
- `--yes` / `-y` — skip TTY confirmation for update / migrate --apply / uninstall.
- `--purge` — with `--uninstall`, also remove product artifacts and audit trail.
- `--diagnose` — read-only install status + single next command.
- `-h`, `--help` — show usage.

Pin a release with `#v{VERSION}` — copy the exact pin from [`INSTALL.md`](../INSTALL.md)
(matches `harness/VERSION`).

Apache-2.0. Issues and docs: <https://github.com/okuzpe/midas-harness>.
