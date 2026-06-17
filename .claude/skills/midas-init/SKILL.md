---
name: midas-init
description: Adaptive one-time setup for Midas — scans everything the project already has (code, manifests, README, docs, notes), classifies its maturity, pre-fills every artifact it can infer, asks only the genuine gaps in one batched round, and places the project at the correct phase. Use once, when the user explicitly runs /midas-init.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-required: [context7]
---

# midas-init — the adaptive intake (one-time setup)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; if the precondition stage is wrong, report and stop.

**Run this once.** The installer wrote a default `harness/state.yaml` so nothing is broken, but it made
no real decisions. `/midas-init` is the **one-time guided setup** — and it adapts to *where the project
already is* instead of forcing every repo to start from a blank `/idea-intake`.

- **If `state.yaml` has `setup_complete: true`** → setup is already done. **STOP** and point the user at
  `/midas-status`. (You will not be needed again.)
- **Otherwise** → run the intake below, then set `setup_complete: true` and tell the user verbatim:
  *"Setup complete — from here, just use `/midas-status`; you won't need `/midas-init` again."*

The flow is **SCAN → CLASSIFY → PRE-FILL → SHOW + ASK (gaps only) → GENERATE → `setup_complete: true`**.
The governing rule everywhere below is **infer → SHOW → confirm**: anything you deduce from the project is
shown to the user to accept or correct — **never silently baked** into an artifact. Ask in a **single
batched round** (`AskUserQuestion`), pre-filled, so the user confirms rather than answers blank prompts.
This skill is **idempotent**: it owns only the regions between `<!-- midas:begin -->` … `<!-- midas:end -->`
and never overwrites content outside them. **Never write a secret to disk.**

---

## Phase A — SCAN (read-only; harvest every signal, not just code)

Dispatch **scout** subagents to read, without writing anything yet:

1. **Code & config.** File/dir tree, manifests (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`,
   `pom.xml`, …), languages/frameworks (+ pinned versions — a *hint* now; Phase 4 confirms via Context7),
   test setup, CI, `.git` history depth, and **workspace markers** (`pnpm-workspace.yaml`, `workspaces`,
   `turbo.json`, `nx.json`, Cargo `[workspace]`) that signal a **monorepo**.
2. **Intent & product docs (the part the old flow ignored).** Read `README*`, `docs/`, any product brief,
   spec, `NOTES`/`TODO`, design files, the `description` field of a manifest, and any pre-existing
   `product/` artifacts. This is what lets a project "with very little" (just a written idea) skip the
   blank idea-intake.
3. **Existing tool surfaces.** Which of `.claude/`, `.cursor/`, `.windsurf/`, `.github/copilot-instructions.md`,
   `AGENTS.md`, `CLAUDE.md`, `.mcp.json` exist (so GENERATE uses managed markers, never clobbers).
4. **OS.** Platform, so GENERATE prints the right env-var command (`setx` on Windows, `export` on POSIX).
   Dates come from the user/today — never a live clock inside a script.

## Phase B — CLASSIFY maturity (place the project, don't assume)

From the scan, classify the project into one level. When the signal is ambiguous, pick the **lower**
level and let the user bump it up in Phase D — under-placing only adds a gate, over-placing skips one.

| Level | What the scan found | Pre-fill | Entry `stage` (`mode`) | Next command |
|---|---|---|---|---|
| **E0 — Empty** | no code, no product docs | nothing | `idea_intake` (`greenfield`) | `/idea-intake` |
| **E1 — Idea-only** | a README/brief/notes describing the product; **a manifest or bare scaffold but no real source counts as E1** | `product/idea.md` from those docs | `contextualize` (`greenfield`) | `/contextualize` |
| **E2 — Partial** | **non-trivial source under `src/`/`lib`/`app` that implements product behavior**, but incomplete (thin/no tests, no clear architecture) | stack hint now; inventory + as-built architecture during adopt (Phase E) | `architecture_rules` (`brownfield`) | `/define-conventions` |
| **E3 — Mature** | substantial, structured codebase with tests + CI | full adoption (arch + rules + baseline audit) | `sprint_planning` (`brownfield`) | `/plan-sprints` |

**`mode` mapping (the persisted enum stays binary):** E0 + E1 → `mode: greenfield`; E2 + E3 → `mode: brownfield`.

**Why E2 lands at `architecture_rules`:** `/midas-adopt` emits an *as-built* `product/architecture.md` +
ADRs, so Phase 4 is recorded as a **deliberately-skipped gate** (with an assumption) and `/define-conventions`
runs under its "`architecture_rules` resuming" precondition rather than bouncing. The exact E2/E3 landing
stage is set by `/midas-adopt` (`architecture_rules` when conventions still need finalizing →
`sprint_planning` once rules + a baseline audit are in place); stage and its next command stay a matched pair.

A skipped gate (anything the maturity level jumps over) carries a **recorded assumption** and an honest
`entry_stage` in `state.yaml` — exactly like a deferred Phase-1 question.

## Phase C — PRE-FILL (draft from the scan; do not commit yet)

Build a draft of everything the scan can support, each value tagged with its **source** so the user can
audit it:
- **E1+**: a draft `product/idea.md` — pitch, problem, audience, goals — lifted from the README/brief
  (cite where: *"problem ← README §Overview"*). Leave genuinely-unknown fields blank for Phase D.
- **E2/E3**: stack hint from manifests; the architecture/rules drafts come from the **`/midas-adopt`**
  recon in Phase E (it reverse-engineers them from the real code + the harvested docs).
- Operational defaults: project name (dir slug), tools (every tool dir found, else `claude-code`),
  language (`en`), cost profile (`balanced`).

**If the harvested intent conflicts with the code/manifests** (a stale or aspirational README), do not pick
a winner — tag that field **DISPUTED** and raise it as a confirm question in Phase D.

## Phase D — SHOW + ASK (one batched round; gaps only)

Show the user a tight summary: **detected maturity level + entry phase**, and every pre-filled value with
its source (flag any **DISPUTED** ones). Then ask — in **one** `AskUserQuestion` batch — **only what's
missing or unconfirmed**:

1. **Maturity / entry phase** — confirm the E-level, **stating the gates it skips** so the choice is
   informed (e.g. *"E2 skips idea-intake, contextualize, market and business-case — are those already
   settled? otherwise pick a lower level"*), or correct it.
2. **The real gaps** the scan couldn't fill, **scoped to the level**: for **E0/E1**, ask only operational
   config + maturity confirm and let `/contextualize`'s gap loop collect the product gaps (target user,
   metric, non-goals); for **E2/E3** (no upcoming contextualize), capture those product gaps here. Skip any
   question the scan already answered (don't re-ask the project name, mode, or an inferred stack).
3. **Operational config** (always needed): target tools · cost profile (`balanced`|`max_savings`|
   `max_quality`) · MCP set (`context7` always on; `sequential-thinking` default on) · Context7 mode
   (`anonymous` now | `api-key` recommended for build sprints — ask only the **env-var name**, never the key) ·
   artifact language.

So this round scales to the project: a blank repo answers the full set (nothing to infer); a mature repo
just confirms a classification and a couple of operational questions. **If a monorepo was detected,** note
that `/midas-monorepo` should run before `/plan-sprints`.

## Phase E — GENERATE (write last; place at the chosen stage)

Write additively (state file last), wrapping every Midas-managed region in `<!-- midas:begin -->` …
`<!-- midas:end -->`. **Never** rewrite hand-authored content; for a pre-existing `AGENTS.md`/`CLAUDE.md`/
`.mcp.json`, show the diff and confirm (`AskUserQuestion`) before writing, else print the block to paste.

1. **Confirmed artifacts.** Write the pre-filled artifacts the user accepted — at minimum `product/idea.md`
   for **E1+** (filled, not a blank template). Scaffold `product/adr/`, `product/sprints/`.
2. **E2 / E3 → run `/midas-adopt` in the same run.** Perform the `.claude/skills/midas-adopt/SKILL.md`
   procedure (inventory → reverse-engineer architecture + rules from the real code **and the harvested
   docs** → baseline audit → wire with **dry-run + diff-confirm**). One flow, not two commands. **Resumable:**
   if adoption is declined or interrupted, leave `setup_complete: false`; on re-run, detect already-written
   `product/inventory.md` / `architecture.md` and resume rather than restart.
3. **`AGENTS.md`** — render from `harness/templates/`, placeholders filled (name, mode, tools, MCP).
   Summarize conventions + the Context7 rule; don't restate them (they live in `harness/conventions.md`
   and `harness/rules/context7-usage.md`).
4. **Tool adapters** (selected tools only) — `CLAUDE.md` as a thin `@AGENTS.md` shim, `.cursor/…`,
   `.windsurf/…`. **Generated, not hand-authored**: delegate the render to `/midas-doctor` (or
   `node scripts/render-adapters.mjs`) — one render path.
5. **`.mcp.json`** — secret-free, `${ENV_VAR}` only; `context7` + chosen optional servers. Merge into the
   managed region if one exists.
6. **`harness/state.yaml`** (per `harness/state.schema.md`, read-modify-write the whole file). Set
   `midas_version`, `name`, **`mode`** (per the E-level mapping: E0/E1 `greenfield`, E2/E3 `brownfield`),
   `language`, `created`/`updated` (today, supplied), the **`stage` from the maturity table**,
   `stage_status: not_started`, `entry_stage` (= that stage) + a recorded assumption for every gate the
   level skipped, `cost_profile`, the resolved `routing`, `tools`, `mcp`, the `phases` ledger, and finally
   **`setup_complete: true`**.

### Secrets (print, never write)
If the user chose `api-key`, print the OS-specific command and stop short of running it:
- Windows: `setx CONTEXT7_API_KEY "<your-key>"` (new shells only; reopen the terminal)
- POSIX: `export CONTEXT7_API_KEY="<your-key>"` (add to your shell profile to persist)

Never echo, store, or commit the key. `.mcp.json` references it only as `${CONTEXT7_API_KEY}`.

## Exit
Confirm: files written (or the manual paste path), the secret command if any, the **maturity level chosen**,
and the **single next action** from the maturity table (`/idea-intake`, `/contextualize`,
`/define-conventions`, or `/plan-sprints`). Then it's `/midas-status` from here on.

## Tier & cost
Scanning + evidence extraction → **scout** (Haiku). Maturity classification, the infer→show→confirm calls,
and the brownfield adoption → **orchestrate** (Opus). Drafting the pre-filled artifacts → **build** (Sonnet).
