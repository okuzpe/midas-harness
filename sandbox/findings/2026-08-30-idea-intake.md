# Sandbox findings — idea-intake

2026-08-30 · mode=`single` · skill=`idea-intake`

## Setup

- Engine: `midas-harness` 3.0.0
- Isolation: `node scripts/sandbox-run.mjs reset` then `env` exit 0; fixture `name: sandbox-example`
- Trace: `start-run` printed `session_id=a0bbad8989f4` `run_id=4abeb38f2094` · `MIDAS_TRACE_ROOT=C:\Users\AfterMe\Desktop\Harness\sandbox\example-product`
- Task model: `composer-2.5` (not `-fast`) · [idea-intake](78cdb8fa-c667-41c0-b95b-693351f503d1)
- First Read (Task): `sandbox/example-product/.harness/state.yaml` (`name=sandbox-example`)
- Grade (parent, after Task):

```
MIDAS_SANDBOX_ORACLE: skill=idea-intake isolation=ok checks=18 pass=18 fail=0 verdict=pass
```

## Decision-flow log

- `[SANDBOX AUTO-DECISION] Confirm project mode (greenfield vs brownfield)? -> greenfield (already set in fixture state; Chorechip is a new local web app with no existing codebase)`
- When NOT skip did **not** fire: `phases.idea_intake.gate` was `pending`, so the body ran.
- Raw idea / pitch already in seed `idea.md`; Task left the raw blockquote unedited; footer set to `*Next: run /contextualize…*`.
- State write-last: `updated: 2026-08-30`, `phases.idea_intake` `{ status: passed, gate: passed, artifacts: ['{product}/idea.md'] }`, `stage: contextualize`.
- No nested Task / other-model builder.
- `finish` after grade: `{"ok":false,"reason":"no-active-run"}`. Fixture cache has only `sandbox-baseline.json` (no run files). Engine `runs/` has no `4abeb38f2094`.

## Issues found

1. **harness-gap** — `harness/skills/idea-intake/SKILL.md` exit gate does not mention `{runs}/audits/gate-00.md`, but `harness/pipeline/0-idea-intake.md` checklist requires it. The Task followed the skill body and did not write a gate record. Procedure fidelity vs playbook is split.
2. **harness-gap** — Playbook heading is `## One-line pitch`; skill + seed + oracle use `## 1-line pitch`. A model that follows the playbook would fail a string check that follows the skill.
3. **harness-gap** — Skill header says `AskQuestion`; step 3 says `AskUserQuestion`. Sandbox auto-decision covered it; a host with only one of those tools can stall.
4. **fixture-limit** — Seed `idea.md` is already a complete Phase-0 artifact, so capture/normalize was a no-op besides the footer. The live signal was **state advance**, not idea capture from a blank template.
5. **isolation-bug** — `start-run` printed ids, `finish` reported `no-active-run`, and no trace files landed under the fixture cache. The lab still does not persist a Task-visible trace for this run.

## Proposed improvements (not applied)

1. Align playbook exit gate with the skill: either require `gate-00.md` in `idea-intake` SKILL.md or drop it from `0-idea-intake.md`. Same for `## 1-line pitch` vs `## One-line pitch`.
2. Spell one prompt tool in the skill (`AskQuestion` on Cursor; Claude fallback as a footnote).
3. Optional empty-idea seed (or a flag) when the point of the run is capture, not gate advance.
4. Write `MIDAS_TRACE_ROOT` into fixture cache so `start-run`/`finish` and the Task share one run directory; fail `finish` loudly in the parent tally if `no-active-run` after a successful `start-run`.

## Applied (2026-08-30 follow-up)

1–3 and 5 from Issues found: `idea-intake` freezes `gate-00.md`; playbook heading is `## 1-line pitch`;
step 3 uses `AskQuestion`; `sandbox-run finish` exits 1 on `no-active-run` and writes `_active-run.json`.
Issue 4 (empty-idea seed) is still a fixture-limit — not applied.

```
MIDAS_SANDBOX_RESULT: skill=idea-intake mode=single verdict=pass auto_decisions=1 isolation=ok
```
