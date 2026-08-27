# Rule: Organic implementation routing (always-on)

Choose **how much context** a Phase-7 action needs before coding — then apply
[`model-routing.md`](./model-routing.md) for **which tier** runs each leg. “Organic” here means
size/ambiguity of the *current action*, not Spec-Driven Development and not a risk score.

> File counts describe **context needed for this action**. They do not force planning enrollment
> and do not override cost-aware tier selection.

## Routes

| Route | When | Action |
|---|---|---|
| **Direct inline** | Understanding needs **1–3 files**, or one mechanical, already-understood change | Stay on the current build session; no extra sub-agent |
| **Delegated** | Understanding needs **4+ files**, reading prepares a write, broad research is needed, or a writer must change **2+ non-trivial files** | One focused `midas-scout` (explore/extract) and/or one `midas-builder` (write); pass a **matched subset** of `Delegator: yes` `SKILL.md` paths from `<paths.engine>/skill-registry.md` for the worker to **read** (path-pass ≠ Skill-tool invoke) |
| **Plan first** | Substantial ambiguity; durable proposal/spec/task artifacts would materially reduce uncertainty | After **explicit user OK** only: split tasks in the sprint file, write an ADR, add a progress **Learned** row, and/or run `/midas-explore` — **never** silent mid-sprint `/plan-sprints` or Phase-6 re-enrollment |

Declining plan-first leads to a safely reduced scope, a justified inline/delegated route, or a clear
blocker for the human — never silent planning.

## Stop rules

- **Long session** — after roughly 20 tool calls, 5 exploratory reads, or 2 non-mechanical edits with
  growing complexity: pause, re-pick the route, or justify why not.
- **Incident** — wrong cwd, worktree/git accident, or confusing environment: fresh scout audit before
  continuing.
- **Handoff / PR** — before `/close-sprint` or opening a PR after non-trivial code changes: fresh
  orchestrate review **in a window that did not write the code** (producer never grades its own
  homework).

## Parallelism (reads fan out, writes serialize)

- **Read fan-out** — N scout/explore minions on disjoint paths may run in parallel (no shared write
  state). Return short summaries to the parent; do not paste the files they read.
- **Single writer** — only **one** inline writer or `midas-builder` mutates the repo at a time,
  unless writers are isolated in separate git worktrees. Two concurrent writers on the same tree is
  a merge conflict with extra confidence.
- **Launch dedup** — each delegated task gets a fingerprint (`route` + scope/path set). Do not
  relaunch the same fingerprint in the same session; reuse the first summary.

## Relationship to model routing

1. Pick the **implementation route** (this rule).
2. Then assign **tiers** per [`model-routing.md`](./model-routing.md): scout for fetch/extract,
   build for implement, orchestrate for gate/audit.

## Checklist

- [ ] Rule file is present and checkable.
      **CHECK:** `harness/rules/organic-routing.md` (or `<paths.engine>/rules/organic-routing.md`)
      contains at least one `**CHECK:**` and a dated `## Amendment` section.
- [ ] Multi-file Phase-7 work records the route.
      **CHECK:** `manual:` when a Phase-7 task cluster spans ≥4 files, `{runs}/sprints/NN-progress.md`
      § Done (**Route** column) or § Observations names `Route: inline|delegated|plan-first`.
- [ ] No silent plan enrollment mid-sprint.
      **CHECK:** `manual:` no mid-sprint `/plan-sprints` or silent planning without user acceptance
      noted in progress (Accepted plan-first → evidence in Learned / sprint file / ADR).
- [ ] Tier still applies after route choice.
      **CHECK:** `manual:` cost-aware tier (orchestrate/build/scout) is still applied after the route
      is chosen — see [`model-routing.md`](./model-routing.md).
- [ ] Concurrent writers are serialized (or isolated).
      **CHECK:** `manual:` session/progress notes show at most one writing builder (or inline writer)
      on the same worktree at a time; two overlapping write delegations without worktree isolation
      is a fail.
- [ ] Delegated work is not relaunched blindly.
      **CHECK:** `manual:` when Phase-7 progress records ≥2 `delegated` rows in one session, they
      name distinct scopes (or reuse an earlier summary); identical route+scope relaunch without
      reuse is a fail.

## Amendment

- **2026-08-27** — Gentleman Ch.20 parallelism: single-writer, read fan-out, launch dedup; review
  must run in a window that did not write the code.
- **2026-08-06** — Adopted Gentle-AI-style implementation routing for Phase 7: inline / delegated /
  plan-first (Midas-native plan actions only). Complements model-routing; skill-registry path-passing
  on delegated legs.
