---
name: midas-init
description: Conversational installer for Midas — detects the project, asks ~8 questions, and writes state, config, and tool adapters. Use once, when the user explicitly runs /midas-init to set up the harness in a repo.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-required: [context7]
---

# midas-init — the conversational installer

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; if the precondition stage is wrong, report and stop.

**Precondition:** no `harness/state.yaml` yet (fresh install), OR the user explicitly asks to
re-initialize. If `harness/state.yaml` already exists and the user did not ask to re-init, STOP and
point them at `/midas-status`. This skill is **idempotent**: it only owns the regions between the
managed markers `<!-- midas:begin -->` … `<!-- midas:end -->` and never overwrites content outside them.

This is a three-phase conversation: **DETECT → ASK → GENERATE**. Never write a secret to disk.

---

## Phase A — DETECT (read-only, no questions yet)

Scan the project to pre-fill smart defaults, then show the user what you found before asking.

1. **Greenfield vs brownfield.** Brownfield if any of these is present: source files in a recognized
   language, a manifest (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, …), or a
   non-trivial `.git` history (commits beyond an initial scaffold). Greenfield otherwise.
2. **Existing tool dirs.** Note which of `.claude/`, `.cursor/`, `.github/copilot-instructions.md`,
   `.windsurf/`, `AGENTS.md`, `CLAUDE.md` already exist (so GENERATE can use managed markers, not clobber).
3. **Stack hints.** Read any manifest to guess language/framework (a *hint* only — Phase 4 pins the stack).
4. **OS.** Detect the platform so GENERATE prints the right env-var command (`setx` on Windows,
   `export` in a POSIX shell). Use `harness/conventions.md` rules; never invent a clock — dates come
   from the user/today, not a live system call inside a script.

Report a 4-6 line summary: `mode`, detected stack hint, existing tool dirs, OS. Then proceed to ASK.

---

## Phase B — ASK (~8 questions, two batches, smart defaults)

Use `AskUserQuestion` so the user can accept defaults fast. Pre-select the DETECT result as the default
for every applicable question. **Batch 1 (identity & shape):**

1. **Project name** (slug, kebab-case) — default from the directory name.
2. **Mode** — `greenfield` | `brownfield` (default from DETECT).
3. **Stack** — "I know it" (capture a one-liner) | "decide later in Phase 4" (default: later).
4. **Target tools** — multi-select of `claude-code`, `cursor`, `copilot`, `codex`, `windsurf`
   (default: every tool whose dir DETECT found, else `claude-code`).

**Batch 2 (operation & cost):**

5. **Artifact language** — default `en`.
6. **Cost profile** — `balanced` (default) | `max_savings` | `max_quality`
   (see `docs/agents-and-models.md`; this resolves the `routing` block).
7. **MCP set** — `context7` is always on (essential). Offer to add `sequential-thinking` (default on)
   and note optional git/fetch/filesystem/Playwright can be wired later.
8. **Context7 mode** — `anonymous` (works now, rate-limited) | `api-key` (recommended for build
   sprints). If `api-key`, ask only for the **env var name** (`CONTEXT7_API_KEY`) — never the key value.

---

## Phase C — GENERATE (write last; one read-modify-write of state)

### Brownfield guard (v1)
If `mode == brownfield`, do **not** write into any pre-existing `AGENTS.md` / `CLAUDE.md` / source.
Instead print a **safe manual path**: the exact files Midas *would* create, a recommended entry stage
(Phase 4/5 "audit-existing"), and the note that automatic brownfield writes (with mandatory dry-run +
diff-confirm) land in a later release. Still write `harness/state.yaml` (with `entry_stage` recorded)
and the `product/` skeleton, since those are additive and non-destructive. Then stop with next steps.

### Greenfield writes
Write in this order (state file last):

1. **`product/` skeleton** — empty placeholder artifacts the pipeline will fill: `product/idea.md`
   (from `harness/templates/`), plus the `product/adr/`, `product/sprints/` directories. Do not invent
   content the phases own — just the scaffolding.
2. **`AGENTS.md`** — render from `harness/templates/` with placeholders filled (project name, mode,
   tools, MCP set). Summarize conventions and the Context7 rule; do **not** restate them in full (they
   live in `harness/conventions.md` and `harness/rules/context7-usage.md`). Wrap Midas-managed regions in
   `<!-- midas:begin -->` … `<!-- midas:end -->`.
3. **Tool adapters for the selected tools only** — `CLAUDE.md` as a thin `@AGENTS.md` import shim;
   `.cursor/rules/00-midas.mdc` and/or `.windsurf/rules/00-midas.md`. These are **generated**, not
   hand-authored: delegate the actual render to `/midas-doctor` (or `node scripts/render-adapters.mjs`)
   so there is exactly one render path. Mark all managed regions.
4. **`.mcp.json`** — secret-free, using `${ENV_VAR}` placeholders only. Include `context7` and the
   chosen optional servers. If the project already has `.mcp.json`, merge into the managed region.
5. **`harness/state.yaml`** — per `harness/state.schema.md`. Set `midas_version`, `name`, `mode`,
   `language`, `created`/`updated` (today's date, supplied — not a live clock), `stage: idea_intake`,
   `stage_status: not_started`, `entry_stage`, `cost_profile`, the resolved `routing` block, `tools`,
   `mcp`, and an empty `phases` ledger. This is the spine — read-modify-write the whole file.

### Secrets (print, never write)
If the user chose `api-key`, print the exact command for their OS and stop short of running it:
- Windows: `setx CONTEXT7_API_KEY "<your-key>"` (new shells only; reopen the terminal)
- POSIX: `export CONTEXT7_API_KEY="<your-key>"` (add to your shell profile to persist)

Never echo, store, or commit the key. `.mcp.json` references it only as `${CONTEXT7_API_KEY}`.

---

## Exit
Print a confirmation: files written (or, for brownfield, the manual path), the secret command if any,
and the single next action: **run `/midas-status`, then `/idea-intake`**. Leave `state.yaml` at
`stage: idea_intake, stage_status: not_started`.
