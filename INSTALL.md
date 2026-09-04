# Installing Midas

> **Canonical install reference.** Flags, layouts, update flows, and troubleshooting live here.
> [README.md](README.md) and [docs/getting-started.md](docs/getting-started.md) summarize and link to this file.
>
> **Version pins:** `INSTALL.md` `#v…` pins are **generated** from `harness/VERSION` via
> `npm run sync-version` (also runs at the start of `npm run build`). Maintainers bump with
> `npm run bump -- <version>` only.

Midas installs **into any project** (new or existing). Every method runs the same dependency-free Node
installer, which installs the managed engine under `.harness/`, generates only the selected host
mirrors/adapters, writes `.harness/state.yaml` plus an ownership manifest, and merges a Midas block
into `.gitignore` (secrets, `node_modules/`, common build dirs, and the **vendor kit** — `.harness/engine`,
`.harness/scripts`, generated host mirrors — so those files are **not** committed; `midas update` restores
them. Project memory stays tracked: `.harness/state.yaml`, `.harness/product/`, `.harness/rules/`,
`.harness/runs/`) so the project is ready
to use. Then run `/midas-init` once — the **one-time guided setup** (it adopts an existing repo for
you); it retires itself afterward and `/midas-status` drives the rest. Optional later: `/midas-auto-pilot`
(unified Mode Ask: continuous evolve with PR|code + `/loop`, or ADR-009 sprint checklist guide;
CLI `midas-autopilot.mjs` unchanged).

**Requirement:** Node.js ≥ 22 (ships with `npx`). Check with `node -v`.

---

## One command (recommended)

Run **inside the project** you want to add Midas to. There is one installed layout: engine, scripts,
product artifacts, rules, runs, state, cache, and migration metadata live under `.harness/`.
Only host-required discovery surfaces stay at the repo root.

**Prefer a pinned release** (matches `harness/VERSION` — currently **v3.0.1**):

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
# shim defaults to github:okuzpe/midas-harness#v3.0.1
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
# shim defaults to #v3.0.1
```

**Any platform, no shell script** (works with every package manager):
```bash
npx  github:okuzpe/midas-harness#v3.0.1   # recommended — pinned
pnpm dlx github:okuzpe/midas-harness#v3.0.1
bunx github:okuzpe/midas-harness#v3.0.1
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
  After install: `node .harness/autonomy/bin/midas-autopilot.mjs setup` (or `/midas-auto-pilot` Sprint checklist / `setup` in the editor).
  On a TTY the installer shows a **compatibility matrix** and accepts presets: **`c`** = cursor only
  (default), **`s`** = cursor + gemini + codex, **`a`** = all adapter tools. Non-interactive installs
  default to **cursor**. On **`update --tools=…`**, when passed, rewrites `state.yaml` `tools:` and prunes
  orphan Midas host mirrors/adapters; omit `--tools` to keep the existing tools list.
- `--force` — overwrite files that already exist (default: skip them).
- `--migrate` — **refused in 3.x** (pin `create-midas@2.10.x` to migrate a 1.x tree, then upgrade).
- `update` — refresh a v2/v3 `.harness/` install. 1.x trees are refused (zero writes).
  `--update` is a silent alias for this subcommand (older docs/scripts keep working).
- `--diagnose` — read-only; print install state and the **single next command** (no writes). Works even
  when Midas is not installed yet.
- `--dry-run` — plan only for install / update / uninstall (writes nothing). Prints the lifecycle plan.
- `--json` — machine-readable diagnose / plan / result envelope on stdout (CI-friendly).
- `--yes` / `-y` — skip TTY confirmation for `update` and `--uninstall`.
- `-h`, `--help` — usage.
- a positional `target-dir` — install into that directory instead of the current one.

**Lifecycle (deterministic CLI):** requirements → checks → ordered plan → confirm → execute → verify →
result (or rollback). `/midas-init` (when diagnose says version/layout behind) and `/midas-reconcile`
are thin guides to the CLI; they do not re-plan installs in the model. `/midas-update` was removed in
3.0 — use `/midas-init`.

Post-install doctor: `node .harness/scripts/doctor.mjs --strict`.

Examples:
```bash
npx github:okuzpe/midas-harness --tools=cursor --dry-run --json   # plan only
npx github:okuzpe/midas-harness#v3.0.1 update --yes             # refresh in CI
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
Wires: `AGENTS.md` · `.agents/skills/` · `.cursor/rules/00-midas.mdc` · `.cursor/rules/01-midas-checks.mdc` · `.cursor/mcp.json` (mirrored from `.mcp.json`).

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

Adds the skills/agents/MCP to Claude Code via the plugin marketplace (clone the repo first):
```text
/plugin marketplace add ./harness
/plugin install midas@midas
/midas-init
```
> The catalog is at `harness/.claude-plugin/marketplace.json` — not repo root — so `owner/repo`
> marketplace add without a local clone will not find it. Prefer `npx create-midas` for a one-shot install.
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
.cursor/rules/00-midas.mdc      Cursor always-on conventions
.cursor/rules/01-midas-checks.mdc   Cursor on-demand Phase-8 CHECK digest
.cursor/mcp.json                Cursor MCP config (synced from .mcp.json when cursor is in tools:)
.harness/.windsurf/rules/00-midas.md     Windsurf always-on conventions (nested under .harness/)
.harness/.windsurf/rules/01-midas-checks.md  Windsurf on-demand CHECK digest
GEMINI.md           Gemini CLI adapter (generated)
```

Existing host files are preserved outside marked Midas regions. `.mcp.json` and `.gitignore` are
user-owned; updates do not replace their contents.

## Git hygiene — what to commit

Midas splits project memory into **auditable artifacts** (commit them) and **volatile/local** paths
(gitignore them). The installer merges `harness/templates/gitignore-midas.snippet` into your root
`.gitignore` via `node <paths.scripts>/gitignore-merge.mjs` (also runs on install, `update`,
`/midas-init`, and `doctor --fix`).

| Commit to git | Do **not** commit |
|---|---|
| `.harness/state.yaml`, `AGENTS.md`, `.mcp.json` | `.env`, `*.pem`, API keys, credentials |
| `.harness/product/*` and `.harness/rules/*` | `node_modules/`, build dirs (`dist/`, `.next/`, …) |
| `.harness/runs/{audits,verifications,sweeps,debates,sprints,lean,retros,investigate,auto-pilot}/` | `.harness/engine/`, `.harness/scripts/`, `.harness/bin/`, `.harness/manifest.json`, `.harness/cache/` |
| Autonomy user files (`policy.yaml`, `control.json`, …) | Host skill mirrors and generated adapters (`00-midas.mdc`, `GEMINI.md`, `.claude/CLAUDE.md`, `.cursor/mcp.json`) |
| Root `.gitignore` (Midas block) + your app source | Test/browser output: `coverage/`, `test-results/`, `playwright-report/` |

`update` may only add/refresh/delete **vendor kit** (`.harness/engine`, `.harness/scripts`) and re-derive
generated adapters/mirrors. It never deletes `.harness/product/`, `.harness/rules/`, `.harness/runs/`, or
`state.yaml`. If git still tracks kit files from an older install: `git rm -r --cached .harness/engine
.harness/scripts .claude/skills .cursor/skills .agents/skills`.

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
4. Optional: `/midas-auto-pilot` — unified autonomy guide (Mode Ask: continuous evolve with PR|code + `/loop`,
   or ADR-009 sprint checklist → `midas-autopilot.mjs`). Evolve path does not require `--autonomy`.
5. After a sprint lands: `/midas-retro` — freeze learnings under `{runs}/retros/` (non-advancing;
   does not replace `/close-sprint`).
6. **`/midas-reconcile`** — when unsure which command to run (install vs update vs init); read-only.
7. **`/midas-bundle`** — export/import portable JSON when seeding a new project or sharing rules/playbooks
   between repos (`node <paths.scripts>/bundle.mjs export --profile memory -o bundle.json`).
8. After substantive edits (rules, skills, installer, docs): **`/midas-align`** — propagation pass per
   `<paths.engine>/rules/change-propagation.md` (engine repo: `npm run align`).
9. Drive the lifecycle: `/idea-intake` → `/contextualize` → `/market-research` → `/business-plan` →
   `/choose-architecture` → `/define-conventions` → `/plan-sprints` → `/start-sprint` → `/close-sprint`.
   Run `/midas-tribunal` any time for a whole-project adversarial debate.

## Always refresh (one command)

Run **inside the product repo**. After the first install, the short command is:

```text
midas update
```

That fetches **latest `main`** (`--channel=edge`), skips confirm, and ignores leftover
`.harness/conflicts/` from a past refresh. First-time PATH: install writes `~/.midas/bin` (Windows
User PATH is updated; open a **new** terminal). Until then:

```powershell
.\.harness\bin\midas.cmd update
```

1.x classic/compact/hub trees are **refused** (zero writes) — pin `create-midas@2.10.3`, migrate,
then upgrade (see [Migrating an existing 1.x install](#migrating-an-existing-1x-install)).

Pinned stable (optional):

```bash
npx -y github:okuzpe/midas-harness#v3.0.1 update --yes
```

Preview: `midas update --dry-run`. `--migrate` is refused in 3.x (pin `create-midas@2.10.x` first).

## Which command should I run? (troubleshooting)

| Situation | Terminal | Then in Cursor |
|-----------|----------|----------------|
| **Never installed Midas** | `npx github:okuzpe/midas-harness#v3.0.1 --tools=cursor` | `/midas-init` |
| **`update` said "no existing install"** | Same as above — **drop `update`** (that is install, not refresh) | `/midas-init` |
| Installed, first time in editor | — | `/midas-init` |
| Installed, `setup_complete: true` | — | `/midas-status` |
| Existing codebase, brownfield | install + | `/midas-init` (may route to `/midas-adopt`) |
| Existing 1.x classic/compact/hub | `npx create-midas@2.10.3 update --yes`, then 3.x `update` | `/midas-status` |
| Engine refresh (already `.harness/`) | `midas update` | `/midas-status` when CLI prints `verify: ok` |
| **Not sure** | `npx github:okuzpe/midas-harness --diagnose` | `/midas-reconcile` |

`--diagnose` and `/midas-reconcile` are **read-only** — they never write files.

## Updating an existing install

**Prefer the [Always refresh](#always-refresh-one-command) one-liner.** `update` refreshes a v2/v3
`.harness/` install. It does **not** migrate 1.x classic/compact/hub trees.

**`update` and `/midas-init` (version_behind path) are alternatives, not a sequence.** The CLI
path is complete when it prints `verify: ok — adapters in sync`. Use `/midas-init` when you want
diagnose + an interactive tip before the same refresh.

On a harness-layout install, **`update`** refreshes manifest-owned engine/generated files, re-renders adapters
and skill mirrors, prunes orphan host trees and empty dropped skill dirs, and runs doctor
**`--strict --profile=install-verify`** before it finishes (layout/version/routing/manifest/mirrors/adapters/secrets
— not full MCP governance, `rules:combined`, or product sprint lifecycle such as `gate:close-ready` /
`gate:diff-receipts`). It preserves product, rules, runs, state, MCP, and content outside generated markers. Pass
**`--tools=…`** to change the host set and prune unused adapters. Full doctor remains
`node .harness/scripts/doctor.mjs --strict` / `/midas-doctor`.

### Release channels and `update --check`

CI publishes a small manifest per channel to the orphan `releases` branch: `edge.json` on every push
to `main`, `stable.json` on every `v*` tag. Each records a **`tree_sha256`** — a content hash over
every vendor file under `.harness/engine` and `.harness/scripts`. Optional `--autonomy` files are
still vendor-owned in the install manifest, but they are not in this hash — otherwise every
autonomy install would look out of date against the published channel. That hash, not `VERSION`, is
what tells you whether the engine actually changed: `VERSION` only moves on a release bump, so many
`edge` builds share one.

Ask whether there is anything new without downloading a bundle:

```bash
npx github:okuzpe/midas-harness update --check
```

Exit codes: **0** up to date, **1** update available, **2** undetermined (offline with no cache, or
an install predating content hashing). Safe in CI — it writes nothing outside `.harness/cache/`.
**`--check` never downloads the bundle and never re-execs npx.** Exit 1 prints the exact command to
apply: `stable` pins `#vX.Y.Z`; `edge` pins the published commit and `--channel=edge`. You (or CI)
run that line.

| Channel | Follows | Default |
|---|---|---|
| `stable` | `v*` tags | yes |
| `edge` | every push to `main` | opt-in via `--channel=edge` |

The channel is recorded in `state.channel` and in `.harness/manifest.json`, so you set it once. `--offline` skips the
network explicitly and falls back to the cached manifest. **Being offline never blocks an update** —
an unreachable channel is a line in the report, and the update proceeds from the bundle npx fetched.

### When verify fails (`NEEDS_REPAIR`, exit 6)

Post-apply doctor failure **does not** roll back the tree (since **2.9.8**). The migrated/refreshed
files stay in place and `.harness/cache/installer/active.json` remains so you can:

```bash
# Fix the doctor findings, then finish the same run:
npx github:okuzpe/midas-harness#v3.0.1 update --resume --yes

# Or undo this run from the installer journal (migrate path restores classic when the snapshot was full):
npx github:okuzpe/midas-harness#v3.0.1 update --rollback --yes
```

Do **not** pin an installer older than **2.9.8** for classic→harness migrate (releases through
**2.9.6** could wipe `.harness/engine` without restoring classic on verify abort). Prefer
**`#v3.0.1+`**. If diagnose reports `partial_migrate` (`.harness/product` without engine) and there
is no journal, restore with git and re-run a pinned `update`.

**npm 11+ / explicit bin (optional):** the published package exposes one CLI bin (`midas`). The short
`npx github:okuzpe/midas-harness#v3.0.1 --tools=cursor` form works on current releases. If npm reports
`could not determine executable to run`, name the bin explicitly:

```bash
npx -y --package=github:okuzpe/midas-harness#v3.0.1 midas --tools=cursor
npx -y --package=github:okuzpe/midas-harness#v3.0.1 midas update --dry-run
```

(`midas-autopilot` is installed under `.harness/autonomy/` when you pass `--autonomy`, not as a root npx bin.)

Project rules belong in `.harness/rules/`; a matching slug overrides the immutable base rule.

### Harness Trace (observe agent runs)

After install/update (≥2.8.0) with `tools` including `cursor`, Midas seeds/merges
`.cursor/hooks.json` → `.harness/scripts/trace-hook.mjs` (fail-open; see ADR-011).

```bash
# After a Cursor Agent turn that used tools:
node .harness/scripts/trace-inspect.mjs list
node .harness/scripts/trace-inspect.mjs <run-id>
```

Traces live under `.harness/cache/traces/` (gitignored) on product installs. Engine contributors
use `runs/cache/traces/` (`paths.cache`). Disable by removing
Midas entries from `.cursor/hooks.json` (commands containing `trace-hook.mjs`) or deleting
that file.

### Ownership manifest, reconciliation, and conflicts

Update decisions come from `.harness/manifest.json` (written at install). `update` reconciles
three inputs for the vendor roots (`.harness/engine`, `.harness/scripts`): what the manifest says
the last install laid down, what this bundle ships, and what is actually on disk. Roles matter:

| Situation | What `update` does | Structural guard |
|---|---|---|
| **Vendor conflict** — a `vendor` file on disk no longer matches its recorded SHA (you edited engine source outside an overlay) | **The bundle wins**: your version is copied to `.harness/conflicts/<timestamp>/…​.midas-conflict` first, the file is refreshed, and the update reports it. A later `update --yes` discards that archive and does **not** refuse. Move the change into `.harness/rules/` — vendor edits do not survive updates | `installer:update-vendor-conflict-prewrite`, `installer:update-preflight-does-not-block-on-conflicts` |
| **Stale manifest** — hashes drifted but files still match the engine package | Refreshes normally; there is no silent re-baseline, so drift is always visible in the report | `installer:update-stale-manifest-refresh` |
| **Dropped file or directory** — the bundle no longer ships something the last install wrote | **Deletes it** (and prunes empty directories). If you had edited the file, the local bytes are copied to `.harness/conflicts/` first. `--rollback` covers a failed run; after a successful update the saved edit is the conflict copy | `installer:update-prunes-dropped-vendor-file`, `installer:update-saves-edited-dropped-vendor-file` |
| **Untracked file inside a vendor root** — on disk, in neither the old nor the new manifest | **Left in place** and listed in `--dry-run` as a note. Never owned by an install, so never deleted — and **not recorded** in the rewritten manifest, so a later update cannot treat it as dropped | `installer:update-leaves-untracked-vendor-file`, `installer:update-does-not-adopt-untracked-file`, `installer:update-second-leaves-untracked-vendor-file` |
| **Version upgrade** | Refreshes the engine tree wholesale per the new pin; still preserves product/rules/runs/state | same update path + `installer:update-*` suite |

`--dry-run` lists every removal and conflict as a plan op before anything is written
(`installer:update-dry-run-reports-vendor-conflict`). Generated adapters and host skill mirrors are
outside reconciliation: they are re-derived from `state.tools` on every update.
Do not hand-edit `.harness/manifest.json` — `update` rewrites it. `--update` is the same command.

Related checks (all in `scripts/test.mjs`): `installer:update-honours-tools`,
`installer:update-tools-rewrites-and-prunes`, `installer:update-complete-hint`.

## Migrating an existing 1.x install

3.x **does not migrate** classic / compact / hub trees. `update` and `--migrate` exit non-zero and
write nothing. Pin **2.10.3**, migrate, then upgrade:

```powershell
npx create-midas@2.10.3 update --yes
npx github:okuzpe/midas-harness#v{VERSION} update --yes
node .harness/scripts/doctor.mjs --strict
```

See [`harness/migrations/v3.0.md`](harness/migrations/v3.0.md).

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
  `.claude/CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.cursor/rules/01-midas-checks.mdc`, `.windsurf/rules/00-midas.md`, `.windsurf/rules/01-midas-checks.md`, and `GEMINI.md`.
- **Keeps** anything you edited (e.g. a Phase-8-amended rule) and any file Midas didn't author (a
  pre-existing `AGENTS.md`, your own scripts) — each is reported so you can remove it by hand.
- **Keeps your product work** (`.harness/product/`, rules, runs, state) unless you pass `--purge`.

For exact removal of a pinned install, uninstall with the same release:
`npx github:okuzpe/midas-harness#v3.0.1 --uninstall`.

> Prefer to do it by hand? Delete `.harness/`, generated host mirrors, the marked block in `AGENTS.md`,
> `.claude/CLAUDE.md`, `GEMINI.md`, `.cursor/rules/00-midas.mdc`,
> `.cursor/rules/01-midas-checks.mdc`, `.windsurf/rules/00-midas.md`,
> `.windsurf/rules/01-midas-checks.md`, and (if appropriate for your project) `.mcp.json`.
> `{runs}/`.
