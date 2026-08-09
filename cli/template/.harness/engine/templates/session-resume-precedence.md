# Session resume precedence (shared — cite, do not restate)

Authoritative read order when an agent returns **mid-work** in a Midas project. Installed projects cite
`<paths.engine>/templates/session-resume-precedence.md` from generated `AGENTS.md` § CRITICAL — active
session. Skills (`/midas-recall`, `/midas-explore`) **cite this file**; they do not restate the ladder.

Full memory model: `<paths.engine>/research/memory-model.md`. Session signal: [ADR-012](../../docs/adr/ADR-012-muninn-adaptations.md).

## Active session (ADR-012)

An **active session** is true when **either**:

1. **`paths.state`** lists a sprint with `status: active`, or
2. **`{runs}/explore/.active`** exists (slug pointer to an open explore investigation).

Safety hooks and AGENTS bootstrap key off this signal. Explore mode does **not** advance sprint gates;
an active sprint may coexist with explore — resolve sprint vs explore intent from the user's message.

**Every turn:** read **`paths.state`** first (`layout` + `paths`). Substitute `{runs}/` and `{product}/`
per `AGENTS.md` § Path resolution before any I/O.

## REJECT — not Midas resume

Do **not** use Muninn ticket-scoped machinery for Midas resume:

| REJECT | Why |
|---|---|
| `/flow` phases 0–7 | Ticket state machine; Midas unit of work is phase/sprint under `{product}/` + `{runs}/` |
| Jira `meta.yml` / `.ai-flow/` pointer | Parallel lifecycle; violates ADR-003 git-visible LTM |
| `memory/entries` auto-inject | Hidden scored store; use `/midas-recall` + on-disk STM/LTM instead |

## Resume ladder (authoritative order)

Apply top-down. Stop early only when the artifact is **missing** or **not applicable** (e.g. no UI
journeys → skip step 1). Do not skip a lower step because a higher one exists — read through the
ladder unless context budget forces truncation (then prefer steps 1–3 over 6).

| # | Source | When |
|---|---|---|
| 1 | Latest `{runs}/verifications/verify-NN.md` | `stage: sprint_execution`, active sprint, and acceptance rows need UI/API/runtime proof |
| 2 | `{runs}/sprints/NN-progress.md` | Active sprint — STM (**Done**, **Learned**, **Next**, **Do not re-read**) |
| 3 | `{product}/sprints/NN-*.md` | Active sprint — task table + acceptance criteria + DoD |
| 4 | `{paths.cache}/metrics/current-carryover.json` | Present, `ok: true`, **fresh** (`generated_at` ≤ 24h and matches active sprint id) |
| 5 | `{runs}/explore/.active` → `<slug>/meta.yaml` + `notes.md` | Explore session active — carryover only; do not load full `/midas-explore` mid-turn |
| 6 | `/midas-recall` | No fresh carryover (step 4 absent/stale) — curated ~15-path pack + brief (scout; read-only) |
| 7 | Close-ready hint | **Forward pointer only** — before `/close-sprint`, ensure Phase-8 receipts/gates (see below) |

### Carryover freshness (step 4)

Treat `current-carryover.json` as authoritative **only** when all hold:

- File exists under `{paths.cache}/metrics/`
- `ok: true`
- `generated_at` is ISO-8601 and **≤ 24 hours** before turn time
- `sprint_id` (or equivalent) matches the active sprint in `paths.state`

When fresh, prefer its `files[]` allow-list over re-loading full phase skills mid-session. When stale or
`ok: false`, fall through to steps 1–3 and 6 — never invent paths from memory.

### Explore vs sprint (step 5)

When both signals are true, default to **sprint ladder (1–4)** for implementation work; use **step 5**
only when the user message is explore-scoped or does not reference sprint tasks. See
`<paths.engine>/skills/midas-explore/SKILL.md` § Carryover.

## Close-ready (forward pointer — not resume)

Resume ladder ends at orientation. **Before** the user runs `/close-sprint`, surface (do not auto-run):

- Sprint tasks checked with proof in progress § Done (**Tool** column populated)
- `/midas-verify` record when UI/API criteria exist (`verify-NN.md` tally green or documented deferrals)
- Gate receipts under `{paths.cache}/gates/<run>/` (`test.json` + `quality.json`, passing per `soft-pass.md`) when the diff touches **production** paths — run `/midas-diff-gates` before `/close-sprint`; engine/docs-only diffs may skip
- Independent Phase-8 audit — `/close-sprint` replaces Muninn self-audit, not Muninn `flow_validate --close-ready`

Doctor `gate:diff-receipts` warns when an active sprint has a production diff but receipts are missing or stale (`changed_paths` mismatch). `/close-sprint` Step 0.5 requires receipts or a documented skip.

## Agent CHECKs (resume turn)

- [ ] **CHECK:** `paths.state` read first; active session predicate evaluated (sprint `active` and/or explore `.active`).
- [ ] **CHECK:** Resume ladder followed in order 1→7; Muninn `/flow` + ticket `meta.yml` not consulted.
- [ ] **CHECK:** When UI acceptance criteria exist, latest `verify-NN.md` consulted before implementing visual changes.
- [ ] **CHECK:** `{runs}/sprints/NN-progress.md` **Learned** / **Done** rows consulted before re-reading broad repo paths.
- [ ] **CHECK:** Carryover used only when `ok: true` and `generated_at` fresh; stale snapshot ignored.
- [ ] **CHECK:** Explore mid-turn loads only `meta.yaml` + `notes.md` from the `.active` slug — not full explore skill body.
- [ ] **CHECK:** `/midas-recall` invoked (or equivalent scout pack) when carryover absent/stale and orientation still unclear.
- [ ] **CHECK:** Close-ready items mentioned only when user nears sprint close — not loaded as resume context every turn.

## Related artifacts

| Artifact | Role |
|---|---|
| `<paths.engine>/templates/sprint-progress.md` | STM schema for step 2 |
| `<paths.engine>/templates/verify-record.md` | Verify schema for step 1 |
| `harness/rules/session-continuity.md` | Continuity CHECKs for Phase-8 audit |
| `/midas-progress` | Writer for step 2 — agents read; do not substitute ad-hoc notes |
| `/midas-status` | Program counter only (~6 lines) — does not replace this ladder |

## Amendment

**2026-08-09** — Initial template (ADR-012 P1). Defines active session, Muninn REJECT list, resume
ladder 1–7, carryover freshness, and close-ready forward pointer. Cited from install `AGENTS.md`
bootstrap; pairs with `node <paths.scripts>/carryover-refresh.mjs` → `{paths.cache}/metrics/current-carryover.json`.
