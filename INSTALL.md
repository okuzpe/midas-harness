# Installing Midas

> **Canonical install reference.** Flags, layouts, update flows, and troubleshooting live here.
> [README.md](README.md) and [docs/getting-started.md](docs/getting-started.md) summarize and link to this file.

Midas installs **into any project** (new or existing). Every method runs the same dependency-free Node
installer, which copies the harness in **non-destructively** (it only adds files — it never deletes
yours), generates the tool adapters, writes a default state file (`.midas/state.yaml` for hub/compact or
`harness/state.yaml` classic), and merges a Midas block
into `.gitignore` (secrets, `node_modules/` and common build dirs, volatile hashes — the harness itself stays
committed) so the project is ready
to use. Then run `/midas-init` once — the **one-time guided setup** (it adopts an existing repo for
you); it retires itself afterward and `/midas-status` drives the rest.

**Requirement:** Node.js ≥ 16.7 (ships with `npx`). Check with `node -v`.

---

## One command (recommended)

Run **inside the project** you want to add Midas to. **Default layout is `hub`** — everything Midas-owned
under `.midas/` (engine, product artifacts, runs, state). Tool adapters stay at the repo root.

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
```

**Any platform, no shell script** (works with every package manager):
```bash
npx  github:okuzpe/midas-harness          # hub layout (default)
pnpm dlx github:okuzpe/midas-harness
bunx github:okuzpe/midas-harness
```

All three forms do the same thing; the `curl`/`irm` shims just check Node and then call the `npx` form.

### Flags
- `--layout` — `hub` (default), `classic`, or `compact`. See [ADR-006](docs/adr/ADR-006-hub-layout.md).
  Tool-mandated paths (`AGENTS.md`, `.claude/`, `.cursor/`, `.mcp.json`) always stay at the project root.
- `--tools` — comma-separated AI tools (e.g. `cursor`, `cursor,gemini,codex`, or `claude-code,cursor`).
  On a TTY the installer shows a **compatibility matrix** and accepts presets: **`c`** = cursor only,
  **`s`** = cursor + gemini + codex, **`a`** = all adapter tools. Non-interactive installs default to all
  adapter tools. **Ignored on `--update`** — your existing state file `tools:` list is preserved.
- `--force` — overwrite files that already exist (default: skip them).
- `--diagnose` — read-only; print install state and the **single next command** (no writes). Works even
  when Midas is not installed yet.
- `-h`, `--help` — usage.
- a positional `target-dir` — install into that directory instead of the current one.

**Legacy layouts:**
```bash
npx github:okuzpe/midas-harness --layout=classic --tools=cursor   # harness/ at repo root
npx github:okuzpe/midas-harness --layout=compact --tools=cursor   # engine in .midas/, product at root
```
Post-install doctor: `node .midas/scripts/doctor.mjs` (hub/compact; classic: `node scripts/doctor.mjs`).

### Three layers at the project root (hub layout)

| Layer | Examples | Hub location |
|---|---|---|
| Tool-mandated | `AGENTS.md`, `.claude/`, `.cursor/`, `.mcp.json` | repo root |
| Your app code (optional) | `src/`, `app/` | repo root (if outside Midas product tree) |
| Midas + product methodology | engine, `product/`, runs, state | **`.midas/`** |

**Cursor-only:**
```bash
npx github:okuzpe/midas-harness --tools=cursor
```
Wires: `AGENTS.md` · `.claude/skills/` · `.cursor/rules/00-midas.mdc` · `.cursor/mcp.json` (mirrored from `.mcp.json`).

**Cursor + Gemini + Codex** (recommended multi-tool stack):
```bash
npx github:okuzpe/midas-harness --tools=cursor,gemini,codex
```
Wires Cursor adapters + `GEMINI.md` + `gemini-extension.json` + Codex/Copilot via `AGENTS.md` and `.claude/skills/`.
The installer prints **per-tool onboarding steps** when complete.

**Gemini CLI only:**
```bash
npx github:okuzpe/midas-harness --tools=gemini
```
Wires: `GEMINI.md` (generated adapter) · `gemini-extension.json` · `AGENTS.md`. Run `gemini extensions link .` once from the project root.

With the shell one-liner, pass flags after `--`:
```bash
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash -s -- --force
```

---

## Claude Code plugin (alternative)

Adds the skills/agents/MCP to Claude Code via the plugin marketplace:
```text
/plugin marketplace add okuzpe/midas-harness
/plugin install midas@midas
/midas-init
```
> Plugins do **not** auto-install project rules or `CLAUDE.md`, so `/midas-init` still runs once to
> write `AGENTS.md`, the adapters, and `harness/state.yaml`.

---

## Copy only (no installer logic)

Fetch the kit without running the installer (you then generate adapters yourself, or run `/midas-init`).
**On Windows,** the raw `.mcp.json` launches MCP servers with bare `npx`, which won't spawn — run
`/midas-init` (or the full installer), which wraps them in `cmd /c`, or wrap them by hand. Then:
```bash
npx giget@latest gh:okuzpe/midas-harness ./my-project
```

---

## What gets installed

```
.claude/            skills (the /midas-* commands + phases) and the 3 cost-tiered agents
harness/            methodology, conventions, rules, design tokens, pipeline playbooks, templates
AGENTS.md           project law (read by Cursor, Copilot, Codex, Windsurf, Gemini, …)
.mcp.json           sequential-thinking MCP config (secret-free; Context7 optional, add it if you want)
docs/, scripts/     model routing reference + render-adapters / doctor (used by /midas-doctor)

# generated by the installer (and re-rendered by /midas-doctor):
CLAUDE.md           Claude Code adapter (imports @AGENTS.md)
.cursor/rules/00-midas.mdc      Cursor always-on rules
.cursor/mcp.json                Cursor MCP config (synced from .mcp.json when cursor is in tools:)
.windsurf/rules/00-midas.md     Windsurf adapter
GEMINI.md           Gemini CLI adapter (generated)
gemini-extension.json   Gemini CLI extension manifest (when gemini in tools:)
```

Your existing `AGENTS.md` / `CLAUDE.md` / `.mcp.json` are kept (skipped) — run `/midas-init` to merge
harness conventions into them. If `.gitignore` already exists, Midas **appends** a marked block (never
overwrites your rules); on `--update`, missing patterns (e.g. `node_modules/`) are added inside the block.
Fresh projects get one created.

## After installing
1. Open the project in **your chosen tool** (Claude Code, **Cursor**, Windsurf, Gemini CLI, or any editor
   that reads `AGENTS.md` for Codex/Copilot).
2. `/midas-init` — the **one-time guided setup** (a few questions once; for an existing repo it runs the
   brownfield adoption for you). It then retires — you won't run it again.
3. `/midas-status` — from here on, shows the current phase and the single next command.
4. **`/midas-reconcile`** — when unsure which command to run (install vs update vs init); read-only.
5. **`/midas-bundle`** — export/import portable JSON when seeding a new project or sharing rules/playbooks
   between repos (`node <paths.scripts>/bundle.mjs export --profile memory -o bundle.json`).
6. After substantive edits (rules, skills, installer, docs): **`/midas-align`** — propagation pass per
   `<paths.engine>/rules/change-propagation.md` (engine repo: `npm run align`).
7. Drive the lifecycle: `/idea-intake` → `/contextualize` → `/market-research` → `/business-plan` →
   `/choose-architecture` → `/define-conventions` → `/plan-sprints` → `/start-sprint` → `/close-sprint`.
   Run `/midas-tribunal` any time for a whole-project adversarial debate.

## Which command should I run? (troubleshooting)

| Situation | Terminal | Then in Cursor |
|-----------|----------|----------------|
| **Never installed Midas** (your MiLlave case) | `npx github:okuzpe/midas-harness#v1.1.1 --tools=cursor` | `/midas-init` |
| **`--update` said "no existing install"** | Same as above — **drop `--update`** | `/midas-init` |
| Installed, first time in editor | — | `/midas-init` |
| Installed, `setup_complete: true` | — | `/midas-status` |
| Existing codebase, brownfield | install + | `/midas-init` (may route to `/midas-adopt`) |
| Engine refresh only | `npx ...#v1.1.1 --update` | `/midas-update` (optional diff-confirm) |
| **Not sure** | `npx github:okuzpe/midas-harness --diagnose` | `/midas-reconcile` |

`--diagnose` and `/midas-reconcile` are **read-only** — they never write files.

## Updating
Run the same one command with **`--update`** — it refreshes the engine, **keeps your work** (`product/`,
run artifacts under `{runs}/` — `.harness/` classic or `.midas/` compact — the state file, and your
`.mcp.json` MCP wiring), re-renders adapters, **runs midas-doctor verify** (auto-fixes adapter drift once
if needed), and bumps the `midas_version` stamp. Adapters re-render for the tools already listed in the
state file (`--tools` is **not** applied on update):

```bash
npx github:okuzpe/midas-harness#v1.1.1 --update   # pin a version, or omit #vX.Y.Z for the latest main
```

`--update` overwrites engine files, so if you consciously **amended a rule**, review `git diff` and
re-apply your `## Amendment` if it was clobbered. No separate `/midas-doctor` step is required when verify
reports `ok`.

## Migrating an existing install to hub

**While still on classic** (before migration), scripts live at the project root:

```powershell
# dry-run first — review the move table
node scripts/migrate-layout.mjs --target=hub

# apply (moves harness/, product/, .harness/* → .midas/)
node scripts/migrate-layout.mjs --apply --target=hub

# verify (after apply, scripts are under .midas/scripts/)
node .midas/scripts/doctor.mjs
```

**Already on compact** (engine under `.midas/`, `product/` at root): same commands but use
`node .midas/scripts/migrate-layout.mjs --target=hub`.

`--update` refreshes the engine only — it does **not** change layout. Migration is always explicit.

## Uninstalling

Same one command, with `--uninstall`. It is **surgical**: it removes only Midas's own files and
**keeps your work** — `product/`, run artifacts (`{runs}/`), and the state file — unless you ask
otherwise. Run it **inside the project**.

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash -s -- --uninstall
```
```powershell
# Windows (PowerShell)
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1))) --uninstall
```
```bash
# Any platform, no shell script
npx github:okuzpe/midas-harness --uninstall
```

### Uninstall flags
- `--dry-run` — print exactly what **would** be removed (and what is kept); delete nothing.
- `--purge` — also delete your `product/`, run artifacts (`{runs}/`), and the state file.
- a positional `target-dir` — uninstall from that directory instead of the current one.

### What it removes — and what it keeps
- **Removes** the pristine engine: `.claude/`, engine source (`harness/` or `.midas/engine/`),
  generated adapters (`CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`, `GEMINI.md`),
  `.mcp.json`, scripts (`scripts/` or `.midas/scripts/`), and empty engine directories.
- **Keeps** anything you edited (e.g. a Phase-8-amended rule) and any file Midas didn't author (a
  pre-existing `AGENTS.md`, your own scripts) — each is reported so you can remove it by hand.
- **Keeps your product work** (`product/`, `{runs}/`, state file) unless you pass `--purge`.

For exact removal of a pinned install, uninstall with the same release:
`npx github:okuzpe/midas-harness#v1.1.1 --uninstall`.

> Prefer to do it by hand? Midas only ever adds files — delete `.claude/`, engine dirs (`harness/` or
> `.midas/`), `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/00-midas.mdc`,
> `.windsurf/rules/00-midas.md`, `.mcp.json`, and (if you want your artifacts gone too) `product/` and
> `{runs}/`.
