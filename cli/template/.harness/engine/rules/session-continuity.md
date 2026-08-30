# Rule: Session continuity (always-on)

These rules apply from Phase 7 (Sprint Execution) onward and support **native project memory** on disk
(STM progress logs + LTM artifacts). See `harness/research/memory-model.md` and `/midas-recall`.

> **Every item carries a `**CHECK:**`** — the concrete condition the Phase-8 audit evaluates: a
> command/grep where one exists, or a `manual:` observable when judgment is required.

## Checklist

### STM progress log
- [ ] An active sprint maintains a cross-session progress file with structured observations.
      See [`state-integrity.md`](./state-integrity.md) § Active-sprint STM continuity
      (`gate:sprint-continuity` via `node <paths.scripts>/doctor.mjs --gates-only`).
- [ ] Completed tasks in the progress log name the **tool/MCP** that proved each item (git-visible
      traceability aligned with Phase 7 and `verification.md`).
      **CHECK:** `manual:` when the sprint diff checks off tasks in `{product}/sprints/NN-*.md`, read
      `{runs}/sprints/NN-progress.md` § Done — each completed row carries a non-empty **Tool** value
      (e.g. `test-runner`, `context7`, `playwright-mcp`); a checked-off task with proof but no Tool is a
      fail. Sprints with zero tasks completed this cycle → `n/a`.

### Capture contradiction hygiene
- [ ] Every `/midas-capture` in the sprint diff recorded whether contradictions were found and resolved.
      **CHECK:** `manual:` the capture log in `state.yaml` or the amended artifact's `## Amendment` notes
      `no conflicts` or documents the contradiction table outcome; a silent capture against an existing
      CHECK is a fail.

### Recall vs hidden store
- [ ] Session continuity uses git-visible files only — no parallel memory DB introduced this sprint.
      **CHECK:** `git diff --name-only HEAD` lists no new `*.db` or vector-store config files;
      continuity evidence is `NN-progress.md`, `{product}/*`, or `<paths.rules>/*` only.

### Session protocol (open / during / close / rehydrate)
- [ ] A long Phase-7 stretch writes a close note before the window dies.
      **CHECK:** `manual:` when `{runs}/sprints/NN-progress.md` exists and `last_touched` advanced this
      cycle, § **Next** is non-empty *and* § Observations has a **Learned** (or explicit Session close)
      row covering goal / discoveries / next step. A progress file that only lists Done with a blank
      Next after a multi-task session is a fail.
- [ ] After compaction or a hard context reset, the agent rehydrates from disk before more writes.
      **CHECK:** `manual:` session evidence shows `/midas-recall` or a re-read of `NN-progress.md` +
      `paths.state` after a compaction/reset before further implementation; continuing from chat
      memory alone is a fail.

## Relationship to other tools

| Tool | Role |
|---|---|
| `/midas-recall` | Read-only context pack when resuming |
| `/midas-capture` | LTM writes (rules/playbooks/conventions) |
| `/midas-sweep` | Hygiene — orthogonal to continuity |

## Amendment

- **2026-08-27** — Gentleman Ch.20 session protocol: close note (Next + Learned) after a long
  stretch; rehydrate from recall/progress after compaction — still git-visible only (ADR-003).
