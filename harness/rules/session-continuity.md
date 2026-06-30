# Rule: Session continuity (always-on)

These rules apply from Phase 7 (Sprint Execution) onward and support **native project memory** on disk
(STM progress logs + LTM artifacts). See `harness/research/memory-model.md` and `/midas-recall`.

> **Every item carries a `**CHECK:**`** — the concrete condition the Phase-8 audit evaluates: a
> command/grep where one exists, or a `manual:` observable when judgment is required.

## Checklist

### STM progress log
- [ ] An active sprint maintains a cross-session progress file with structured observations.
      **CHECK:** `manual:` when `stage: sprint_execution` and a sprint is `active`, either (a)
      `.harness/sprints/NN-progress.md` exists with at least one **Learned** row updated this sprint
      cycle, or (b) `sprints[].last_touched` for that sprint is ≤ **7 days** before audit date.
      Greenfield with no active sprint → `n/a`.
- [ ] Completed tasks in the progress log name the **tool/MCP** that proved each item (git-visible
      traceability aligned with Phase 7 and `verification.md`).
      **CHECK:** `manual:` when the sprint diff checks off tasks in `product/sprints/NN-*.md`, read
      `.harness/sprints/NN-progress.md` § Done — each completed row carries a non-empty **Tool** value
      (e.g. `test-runner`, `context7`, `playwright-mcp`); a checked-off task with proof but no Tool is a
      fail. Sprints with zero tasks completed this cycle → `n/a`.

### Capture contradiction hygiene
- [ ] Every `/midas-capture` in the sprint diff recorded whether contradictions were found and resolved.
      **CHECK:** `manual:` the capture log in `state.yaml` or the amended artifact's `## Amendment` notes
      `no conflicts` or documents the contradiction table outcome; a silent capture against an existing
      CHECK is a fail.

### Recall vs hidden store
- [ ] Session continuity uses git-visible files only — no parallel memory DB introduced this sprint.
      **CHECK:** `manual:` the sprint diff introduces no new `*.db`, `.engram/`, or vector-store config;
      continuity evidence is `NN-progress.md`, `product/*`, or `harness/rules/*` only.

## Relationship to other tools

| Tool | Role |
|---|---|
| `/midas-recall` | Read-only context pack when resuming |
| `/midas-capture` | LTM writes (rules/playbooks/conventions) |
| `/midas-sweep` | Hygiene — orthogonal to continuity |
