# Installing Midas

> **Canonical install reference.** Flags, layouts, update flows, and troubleshooting live here.
> [README.md](README.md) and [docs/getting-started.md](docs/getting-started.md) summarize and link to this file.
>
> **Version pins:** this file is the *only* user-facing copy-paste surface for `#vX.Y.Z`. Maintainers
> bump it with `npm run bump -- <version>` (do not scatter pins across skills/docs).

Midas installs **into any project** (new or existing). Every method runs the same dependency-free Node
installer, which installs the managed engine under `.harness/`, generates only the selected host
mirrors/adapters, writes `.harness/state.yaml` plus an ownership manifest, and merges a Midas block
into `.gitignore` (secrets, `node_modules/` and common build dirs, volatile hashes — the harness itself stays
committed) so the project is ready
to use. Then run `/midas-init` once — the **one-time guided setup** (it adopts an existing repo for
you); it retires itself afterward and `/midas-status` drives the rest. Optional later: `/midas-automate`
to prepare a Cursor Automation draft for continuous product-aligned improve cycles (scheduler =
Cursor `/automate` in the Agents Window — distinct name).

**Requirement:** Node.js ≥ 22 (ships with `npx`). Check with `node -v`.

---

## One command (recommended)

Run **inside the project** you want to add Midas to. v2 has one installed layout: engine, scripts,
product artifacts, rules, runs, state, cache, and migration metadata live under `.harness/`.
Only host-required discovery surfaces stay at the repo root.

**Prefer a pinned release** (matches `harness/VERSION` — currently **v2.2.1**):

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
# shim defaults to github:okuzpe/midas-harness#v2.5.0
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
# shim defaults to #v2.5.0
```

**Any platform, no shell script** (works with every package manager):
```bash
npx  github:okuzpe/midas-harness#v2.5.0   # recommended — pinned
pnpm dlx github:okuzpe/midas-harness#v2.5.0
bunx github:okuzpe/midas-harness#v2.5.0
```

Bleeding-edge (mutable `main`, not for production):
```bash
MIDAS_BLEEDING_EDGE=1 curl -fsSL …/install.sh | bash
npx github:okuzpe/midas-harness            # unpinned — same risk as main
```

The `curl`/`irm` shims check Node and then call the pinned `npx` form unless `MIDAS_BLEEDING_EDGE=1`
or `MIDAS_INSTALL_REF` overrides the tag.

### Flags
- `--layout=harness` — accepted as an explicit no-op. New installs reject `classic`, `compact`, and `hub`.
- `--tools` — comma-separated AI tools (e.g. `cursor`, `cursor,gemini,codex`, or `claude-code,cursor`).
- `--autonomy` — optional bounded control plane (ADR-009). Copies capability to `.harness/autonomy/`
  and exposes `midas-autopilot`. Off by default; does not add `@cursor/sdk` to the base package.
  After install: `node .harness/autonomy/bin/midas-autopilot.mjs setup` (or `/midas-autopilot` in the editor).
  On a TTY the installer shows a **compatibility matrix** and accepts presets: **`c`** = cursor only
  (default), **`s`** = cursor + gemini + codex, **`a`** = all adapter tools. Non-interactive installs
  default to **cursor**. On **`--update`**, when passed, rewrites `state.yaml` `tools:` and prunes
  orphan Midas host mirrors/adapters; omit it to keep the existing tools list.
- `--force` — overwrite files that already exist (default: skip them).
- `--migrate` — read-only preview for a v1 classic/compact/hub installation.
- `--migrate --apply` — apply that plan transactionally, install v2, and run strict doctor.
- `--diagnose` — read-only; print install state and the **single next command** (no writes). Works even
  when Midas is not installed yet.
- `--dry-run` — plan only for install / update / uninstall (writes nothing). Prints the lifecycle plan.
- `--json` — machine-readable diagnose / plan / result envelope on stdout (CI-friendly).
- `--yes` / `-y` — skip TTY confirmation for `--update`, `--migrate --apply`, and `--uninstall`.
- `-h`, `--help` — usage.
- a positional `target-dir` — install into that directory instead of the current one.

**Lifecycle (deterministic CLI):** requirements → checks → ordered plan → confirm → execute → verify →
result (or rollback). `/midas-update` and `/midas-reconcile` are thin guides; they do not re-plan
installs in the model.

Post-install doctor: `node .harness/scripts/doctor.mjs --strict`.

Examples:
```bash
npx github:okuzpe/midas-harness --tools=cursor --dry-run --json   # plan only
npx github:okuzpe/midas-harness#v2.5.0 --update --yes             # refresh in CI
npx github:okuzpe/midas-harness --diagnose --json                 # status envelope
```

### Three layers at the project root

| Layer | Examples | Location |
|---|---|---|
| Tool-mandated | `AGENTS.md`, `.claude/`, `.cursor/`, `.mcp.json` | repo root |
| Your app code | `src/`, `app/`, application-owned `scripts/` | repo root |
| Midas + product methodology | engine, scripts, product, rules, runs, state | **`.harness/`** |

**Cursor-only:**
```bash
npx github:okuzpe/midas-harness --tools=cursor
```
Wires: `AGENTS.md` · `.agents/skills/` · `.cursor/rules/00-midas.mdc` · `.cursor/mcp.json` (mirrored from `.mcp.json`).

**Cursor + Gemini + Codex** (recommended multi-tool stack):
```bash
npx github:okuzpe/midas-harness --tools=cursor,gemini,codex
```
Wires Cursor adapters + `GEMINI.md` + Codex via `AGENTS.md` and `.agents/skills/`.
The installer prints **per-tool onboarding steps** when complete.

**Gemini CLI only:**
```bash
npx github:okuzpe/midas-harness --tools=gemini
```
Wires: `GEMINI.md` (generated adapter) · `.agents/skills/` · `AGENTS.md`.

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
> Plugins do **not** auto-install project rules or `.claude/CLAUDE.md`, so `/midas-init` still runs once
> to write `AGENTS.md`, the adapters, and `.harness/state.yaml`.

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
.harness/
  engine/           version-managed methodology, source skills/agents, base rules, templates
  scripts/          CLI and validators
  product/          your Midas product artifacts
  rules/            your project-specific rule overlays
  runs/             audits, verification, sprints, debates, sweeps
  migrations/       versioned receipts + ignored local rollback backups
  state.yaml        project state and canonical path map
  manifest.json     vendor/generated/user ownership ledger
AGENTS.md           project law (read by Cursor, Copilot, Codex, Windsurf, Gemini, …)
.mcp.json           empty MCP config (secret-free; add only explicitly approved, Runlayer-managed servers)

# selected host mirrors/adapters generated by the installer:
.claude/CLAUDE.md   Claude Code adapter (imports @../AGENTS.md)
.claude/skills/     Claude native skill mirror (Claude installs only)
.claude/agents/     Claude agent mirror (Claude installs only)
.agents/skills/     portable Agent Skills mirror (portable hosts)
.cursor/rules/00-midas.mdc      Cursor always-on rules
.cursor/mcp.json                Cursor MCP config (synced from .mcp.json when cursor is in tools:)
.windsurf/rules/00-midas.md     Windsurf adapter
GEMINI.md           Gemini CLI adapter (generated)
```

Existing host files are preserved outside marked Midas regions. `.mcp.json` and `.gitignore` are
user-owned; updates do not replace their contents.

## Git hygiene — what to commit

Midas splits project memory into **auditable artifacts** (commit them) and **volatile/local** paths
(gitignore them). The installer merges `harness/templates/gitignore-midas.snippet` into your root
`.gitignore` via `node <paths.scripts>/gitignore-merge.mjs` (also runs on install, `--update`,
`/midas-init`, and `doctor --fix`).

| Commit to git | Do **not** commit |
|---|---|
| `.harness/state.yaml` and `.harness/manifest.json` | `.env`, `*.pem`, API keys, credentials |
| `.harness/product/*` and `.harness/rules/*` | `node_modules/`, build dirs (`dist/`, `.next/`, …) |
| `.harness/runs/{audits,verifications,sweeps,debates,sprints}/` | `.harness/cache/`, `.harness/migrations/backups/`, `status.html` |
| `.harness/engine/`, `.harness/scripts/`, selected host mirrors | Test/browser output: `coverage/`, `test-results/`, `playwright-report/` |
| Tool adapters at repo root (`AGENTS.md`, `.cursor/rules/`, …) | Portable bundle exports: `*.midas-bundle.json` (may contain project knowledge) |

**Verify after install or update:**

```bash
node <paths.scripts>/doctor.mjs
# health line: gitignore:midas-block — ok | warn

node <paths.scripts>/gitignore-merge.mjs   # append or upgrade missing patterns
```

Phase 8 (`/close-sprint`) grades `.harness/engine/rules/security.md`: `.gitignore` must cover `.env`, `*.pem`,
`secret`, and `credential` patterns. A missing block is a **warn** in doctor and a **fail** at audit time.

## After installing
1. Open the project in **your chosen tool** (Claude Code, **Cursor**, Windsurf, Gemini CLI, or any editor
   that reads `AGENTS.md` for Codex/Copilot).
2. `/midas-init` — the **one-time guided setup** (a few questions once; for an existing repo it runs the
   brownfield adoption for you). It then retires — you won't run it again.
3. `/midas-status` — from here on, shows the current phase and the single next command.
4. Optional: `/midas-automate` — validate product context and emit a Cursor `/automate` draft for
   recurring one-improvement PRs (does not require `--autonomy`).
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
| **Never installed Midas** | `npx github:okuzpe/midas-harness#v2.5.0 --tools=cursor` | `/midas-init` |
| **`--update` said "no existing install"** | Same as above — **drop `--update`** | `/midas-init` |
| Installed, first time in editor | — | `/midas-init` |
| Installed, `setup_complete: true` | — | `/midas-status` |
| Existing codebase, brownfield | install + | `/midas-init` (may route to `/midas-adopt`) |
| Existing 1.x classic/compact/hub | `npx ...#v2.5.0 --migrate` then add `--apply` | `/midas-status` |
| Engine refresh on v2 | `npx ...#v2.5.0 --update` **or** `/midas-update` (pick one) | `/midas-status` when CLI prints `verify: ok` |
| **Not sure** | `npx github:okuzpe/midas-harness --diagnose` | `/midas-reconcile` |

`--diagnose` and `/midas-reconcile` are **read-only** — they never write files.

## Updating

**`--update` and `/midas-update` are alternatives, not a sequence.** The CLI path is complete when it
prints `verify: ok — adapters in sync`. Use `/midas-update` only when you want an interactive
dry-run and confirm before the same refresh runs.

On a v2 install, **`--update`** refreshes manifest-owned engine/generated files, re-renders adapters
and skill mirrors, prunes orphan host trees, and runs strict doctor before it finishes. It preserves
`.harness/product`, `.harness/rules`, `.harness/runs`, state, MCP, and content outside generated
markers. A modified `vendor` file aborts same-version updates before any write (version upgrades
refresh the engine wholesale). Pass **`--tools=…`** to change the host set and prune unused adapters:

```bash
npx github:okuzpe/midas-harness#v2.5.0 --update
npx github:okuzpe/midas-harness#v2.5.0 --update --tools=cursor
```

Project rules belong in `.harness/rules/`; a matching slug overrides the immutable base rule.

## Migrating an existing 1.x install

Migration is the only operation that moves legacy files. Preview first; it is byte-for-byte read-only:

```powershell
npx github:okuzpe/midas-harness#v2.5.0 --migrate
npx github:okuzpe/midas-harness#v2.5.0 --migrate --apply
node .harness/scripts/doctor.mjs --strict
```

Only schema-known product artifacts, state-referenced paths, known runs, and signature-identified Midas
scripts move. Unknown `product/` and `scripts/` entries stay where they are and appear in the report.
The migration builds in staging, rejects destination collisions, verifies SHA-256 hashes, and restores
both source and destination if migration, install, or strict doctor fails. `--update` on 1.x exits
without writing and prints these migration commands.

## Uninstalling

Same one command, with `--uninstall`. It is **surgical**: it removes only Midas's own files and
**keeps your work** — `.harness/product/`, `.harness/rules/`, `.harness/runs/`, and state — unless you ask
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
- `--purge` — also delete `.harness/product/`, rules, runs, and state.
- a positional `target-dir` — uninstall from that directory instead of the current one.

### What it removes — and what it keeps
- **Removes** intact manifest-owned engine/scripts and generated mirrors/regions, including
  `.claude/CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`, and `GEMINI.md`.
- **Keeps** anything you edited (e.g. a Phase-8-amended rule) and any file Midas didn't author (a
  pre-existing `AGENTS.md`, your own scripts) — each is reported so you can remove it by hand.
- **Keeps your product work** (`.harness/product/`, rules, runs, state) unless you pass `--purge`.

For exact removal of a pinned install, uninstall with the same release:
`npx github:okuzpe/midas-harness#v2.5.0 --uninstall`.

> Prefer to do it by hand? Delete `.harness/`, generated host mirrors, the marked block in `AGENTS.md`,
> `.claude/CLAUDE.md`, `GEMINI.md`, `.cursor/rules/00-midas.mdc`,
> `.windsurf/rules/00-midas.md`, and (if appropriate for your project) `.mcp.json`.
> `{runs}/`.
