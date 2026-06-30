# Project memory model (native, git-visible)

Midas does **not** use a hidden vector DB or vendor-global memory. Persistent project knowledge lives in
files you review in git. This page maps the cognitive STM/LTM split (see
[TrueMEM](https://www.truefoundry.com/es/blog/truemem-building-a-model-agnostic-memory-layer-for-ai),
[Jenova](https://www.jenova.ai/es/resources/ai-with-persistent-memory)) onto Midas artifacts.

Engine decision record (maintainers): `docs/adr/ADR-003-project-memory-model.md` in the
[midas-harness](https://github.com/okuzpe/midas-harness) repository. Installed projects use **this file**
as the canonical memory overview.

## Three layers

| Layer | Analogy | Where | Who writes |
|---|---|---|---|
| **PC** | program counter | `harness/state.yaml` | phase skills (read first, write last) |
| **STM** | working memory this stretch | `.harness/sprints/NN-progress.md`, active sprint file | build tier during Phase 7 |
| **LTM** | durable truth | `product/*`, `harness/rules/*`, `.harness/*` frozen records | phase skills + `/midas-capture` |

**Context window ≠ memory.** A larger context window is not LTM; it is expensive STM that resets when the
session ends. Midas points agents at the right LTM files instead of replaying chat.

## Operations

| Command | Tier | Role |
|---|---|---|
| `/midas-status` | scout | Cheap PC — phase, gate, **single next command** (~6 lines) |
| `/midas-recall` | scout | **Context Pack** — ~15 paths + brief; use when resuming mid-phase/sprint |
| `/midas-capture` | build | Crystallize recurring patterns → rule / playbook / convention (user-approved) |
| `/midas-sweep` | build | Hygiene — dead flows, ledger drift (orthogonal to recall) |

`/midas-status` **suggests** `/midas-recall` when `stage_status: in_progress` or an active sprint's
`last_touched` is older than **7 days** — optional, never blocking.

## STM protocol (sprint progress)

Copy [`harness/templates/sprint-progress.md`](../templates/sprint-progress.md) to
`.harness/sprints/NN-progress.md` when a sprint goes `active`. Each significant decision uses:

- **What** — what changed or was decided
- **Why** — rationale
- **Where** — `path:line` or artifact
- **Learned** — takeaway for the next session

Inspired by [Engram](https://github.com/Gentleman-Programming/engram)'s observation shape — **markdown only**, no SQLite.

## LTM capture

`/midas-capture` writes visible artifacts only. Before writing, step 2 runs:

1. **Amend over duplicate** — extend an existing rule/playbook if the concept already exists.
2. **Contradiction check** — if the proposed pattern conflicts with an existing CHECK, surface a table;
   user picks amend / supersede / coexist.
3. **Importance** — `explicit` (user asked) or `recurring` (≥2 instances); note in `## Amendment` or playbook header.

## What we deliberately did not build

- Engram MCP / `~/.engram` SQLite (hidden store)
- TrueMEM-style pgvector + background extract workers
- Auto-capture from every chat turn (recommend-don't-wall stays)
