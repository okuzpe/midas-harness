# create-midas

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

## What it does
- Copies the harness (`.claude/` skills + agents, `harness/` methodology + rules + templates,
  `AGENTS.md`, `.mcp.json`, the `render-adapters`/`doctor` scripts) into your project.
- **Non-destructive:** files that already exist are skipped (use `--force` to overwrite). It only
  adds files — it never deletes yours.
- Generates tool adapters from a single source (`CLAUDE.md`, `.cursor/rules/`, `.windsurf/rules/`, `GEMINI.md`).
- Prints a **per-tool compatibility summary** and onboarding steps (Cursor MCP reload, Gemini extension link, Codex AGENTS.md, …).

Existing `AGENTS.md` / `CLAUDE.md` are preserved; run `/midas-init` to merge harness conventions into
them.

## Options
- `--force` — overwrite files that already exist.
- `--update` — refresh engine files from the bundled template; preserves your `harness/state.yaml`.
- `--uninstall` — remove Midas-installed files (with confirmation).
- `--tools=<list>` — e.g. `cursor`, `cursor,gemini,codex`, or `claude-code,cursor,windsurf,gemini`.
- `--dry-run` — show what would be copied without writing.
- `--purge` — with `--uninstall`, also remove generated adapters and `.harness/` caches.
- `-h`, `--help` — show usage.

Pin a release: `npx github:okuzpe/midas-harness#v0.5.28`

Apache-2.0. Issues and docs: <https://github.com/okuzpe/midas-harness>.
