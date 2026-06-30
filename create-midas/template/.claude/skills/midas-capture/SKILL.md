---
name: midas-capture
description: Crystallize a recurring request or correction into the right project artifact — a rule (harness/rules/*), a playbook (product/playbooks/*), or a convention (product/conventions.md) — via a decision rubric, so every later sprint and audit honors it automatically. The agent proposes this whenever it notices you asking for the same thing ~2-3 times (recommend-don't-wall — it asks first, never writes silently); you can also invoke it to capture a pattern on demand. Writes to the visible project artifacts you review in git, never a hidden store.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[the pattern to capture] [--as rule|playbook|convention]"
---

# midas-capture — Crystallize a recurring pattern into a rule / playbook / convention

> **Run only when the user explicitly invokes this command, or right after they confirm a captured-pattern
> proposal.** Never write a rule/playbook/convention silently — the user says yes first.

When you ask for the same thing over and over, that preference should become part of the project's
**standards** instead of living in chat. This skill — and the always-on capture behaviour in `AGENTS.md` —
turns a recurring request or correction into the **right** codified artifact, so every later sprint and
Phase-8 audit honours it automatically. It writes to the **visible** project artifacts you review in git;
Midas has **no** hidden memory / runtime store.

## When the agent proposes this on its own (the always-on loop)
Across any phase, if the user asks for the same thing **~2-3 times**, or **corrects you the same way**
repeatedly, **pause and propose** capturing it — *recommend-don't-wall*, never write silently:
> *"You've asked for X three times — want me to capture it as a rule so every sprint follows it?"*
On the user's **OK**, run the procedure below. On **no**, drop it (don't nag).

## The rubric — which artifact? (this answers "rule or skill?")
| The recurring thing is… | Capture as | Where |
|---|---|---|
| a **constraint / preference** ("always use X", "never Y") a reviewer can pass/fail | **rule** (with a `**CHECK:**`) | `harness/rules/<slug>.md` |
| a **procedure** done the project's way ("when I add an endpoint, do A→B→C") | **playbook** | `product/playbooks/<verb-noun>.md` |
| a **prose preference** that isn't a mechanical check | **convention** | `product/conventions.md` |
| (rarely) a genuinely new **invokable engine command** | a skill — **almost never per-project** | — |

Default to a **rule** when it's checkable, a **playbook** when it's a multi-step recipe. A per-project
pattern is a rule/playbook/convention — Midas keeps new slash-commands at the engine level, **not** per project.

## Procedure
### 1. Identify the pattern
From the conversation (the repeated requests/corrections) or the `--as`/argument, state the pattern in
**one sentence** and cite the **≥2 instances** that justify it. A one-off is not a pattern — require genuine recurrence.

### 2. Classify + find an existing home first (amend over duplicate + contradiction check)
Pick rule / playbook / convention via the rubric. **Search existing `harness/rules/*`, `product/playbooks/*`,
and `product/conventions.md` first** — grep for the concept and close synonyms.

- **Overlap** (same concept, ~85%+ overlap — amend, do not duplicate): extend that file with a dated
  `## Amendment` or playbook edit; record importance `explicit` (user invoked capture) or `recurring`
  (≥2 chat instances).
- **Contradiction** (proposed pattern conflicts with an existing `**CHECK:**` or normative statement):
  stop and surface a table — do not write until the user picks a resolution:

  | Existing | Proposed | Resolution |
  |---|---|---|
  | `path` + quote | one-line pattern | `amend` \| `supersede` \| `coexist` |

  On `amend`/`supersede`, log rationale in `## Amendment`. On `coexist`, document scope boundaries.
- **No match** — proceed to step 3 as a new artifact.

### 3. Write the artifact (match the house style)
- **Rule** — a new or extended `harness/rules/<slug>.md` item carrying a concrete `**CHECK:**` (grep or
  `manual:`), in the same style as the existing rules. Respect the precedence chain.
- **Playbook** — `product/playbooks/<verb-noun>.md` from `harness/templates/playbook.md`: use-when, steps,
  the rules/tokens it honours, a Context7 fetch if it touches a third-party API, a done-when check.
- **Convention** — an entry in `product/conventions.md` (prose override of the base `harness/conventions.md`).

### 4. Propagate + log
- If you wrote/changed a **rule**, re-render adapters (`node scripts/render-adapters.mjs` / `/midas-doctor`)
  so every tool sees it; note it will be graded at the next `/close-sprint` (and enforced by the linter if
  it maps to one — see Phase 5 tooling).
- Record the capture in `harness/state.yaml` (the artifact path + a one-line "captured from a repeated request"
  + contradiction result: `no conflicts` or `resolved: <summary>`).

### 5. Confirm
Tell the user in **one line** exactly what was written/changed and where, so they can review the git diff.

## Recommend-don't-wall + anti-bloat
- **Always propose; never write silently.** The user confirms before anything lands.
- **Amend over duplicate.** Extend an existing rule/playbook rather than spawning a near-twin.
- **Genuine recurrence only** (≥2-3×, or an explicit "always do this") — don't capture a one-off.
- **Prefer rule/playbook/convention over a new skill** — keep the engine surface small.

## Exit gate (capture complete)
- [ ] The pattern is one sentence with the ≥2 instances that justify it (real recurrence).
- [ ] Classified via the rubric; overlap → amend; contradiction → table resolved before write.
- [ ] The artifact is written correctly (a rule carries a `**CHECK:**`; a playbook has use-when/steps/done-when).
- [ ] If a rule changed, adapters were re-rendered; the capture is logged in `state.yaml`.
- [ ] The user was shown exactly what changed (reviewable in git) — nothing written without confirmation.

## Tier & cost
Classify + write the artifact → **build** (Sonnet). The detection/proposal happens inline in whatever tier
is already driving the conversation. Re-rendering adapters is mechanical.
