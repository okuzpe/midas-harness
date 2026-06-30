# ADR-003 — Project memory as git-visible artifacts (native recall, no vector store)

| Field | Value |
|---|---|
| **Status** | **accepted** (2026-06-30) |
| **Date** | 2026-06-30 |
| **Deciders** | maintainer + orchestrate tier |
| **Context7 verified** | n/a (process/engine decision; no third-party API coded here) |

> Engine-level ADR. Product projects inherit the model via `harness/research/memory-model.md` and
> `/midas-recall` — not a separate memory product.

## Context

Persistent-memory products (e.g. [TrueMEM](https://www.truefoundry.com/es/blog/truemem-building-a-model-agnostic-memory-layer-for-ai),
[Jenova](https://www.jenova.ai/es/resources/ai-with-persistent-memory), [Engram](https://github.com/Gentleman-Programming/engram))
solve **session amnesia** with STM/LTM layers — often vector stores, SQLite, or vendor-global memory.
Midas already stores long-form project truth in **git-visible** artifacts (`product/*`, `harness/rules/*`,
`.harness/*`) and operational state in `harness/state.yaml`. `/midas-capture` crystallizes recurring
preferences into rules/playbooks/conventions — explicitly **no hidden runtime store** (`AGENTS.md`).

The remaining gaps:

1. **Recovery** — agents do not know which ~15 files to read first when resuming mid-phase or mid-sprint.
2. **Session continuity** — `.harness/sprints/NN-progress.md` is documented in Phase 7 but had no template.
3. **Capture safety** — `/midas-capture` amends duplicates but did not surface **contradictions** before write.

Alternatives considered:

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| Wire Engram MCP (SQLite + FTS5) | Rich session memory, agent-agnostic | Hidden store; contradicts Midas contract; extra binary | **Rejected** |
| TrueMEM-style vector LTM (pgvector) | Semantic top-K retrieval | Infra-heavy; not a copy-in markdown kit | **Rejected** |
| **Native recall + STM template + capture contradiction check** | Auditable; zero new deps; fits scout tier | Heuristic retrieval (grep/path lists), not semantic | **Accepted** |

## Decision

Adopt a **three-layer memory model on disk**:

| Layer | Role | Canonical locations |
|---|---|---|
| **Program counter** | where am I in the lifecycle | `harness/state.yaml` |
| **STM** (session / sprint cycle) | what happened this working stretch | `.harness/sprints/NN-progress.md`, active `product/sprints/NN-*.md` |
| **LTM** (durable project truth) | decisions, scope, rules, frozen evidence | `product/*`, `harness/rules/*`, `.harness/audits|debates|sweeps|verifications/*` |

Add:

- **`/midas-recall`** (scout, read-only) — assembles a curated Context Pack (~15 paths + ~30-line brief).
- **`harness/templates/sprint-progress.md`** — What / Why / Where / Learned observation format (Engram-inspired protocol, markdown-only).
- **`harness/rules/session-continuity.md`** — Phase 7+ CHECKs for progress log hygiene and capture contradiction logging.
- **Extended `/midas-capture` step 2** — contradiction table before write; overlap → amend (TrueMEM-style dedup intent).

**Context window ≠ memory.** Midas does not stuff full chat history into prompts; it points agents at the
right on-disk artifacts. `/midas-status` remains the cheap PC (~6 lines); `/midas-recall` is the deeper
resume pack — status suggests recall, never replaces it.

No new `state.yaml` field (`last_recall`); continuity evidence lives in progress files and `sprints[].last_touched`.

## Consequences

**Positive**

- Resumable across tools (Cursor, Claude Code, …) because memory is files, not vendor session state.
- Phase-8 auditable: `session-continuity` CHECKs grade continuity like any other rule.
- Aligns with `/midas-sweep` (hygiene/dead flows) — recall **reads**; sweep **cleans**.

**Negative / limits**

- Recall is **heuristic** (stage tables + optional `--focus` grep), not embedding search — large monorepos may need `--focus`.
- STM progress logs are **manual/agent-maintained**; no background worker auto-extracts chat into LTM.
- Contradiction detection in capture is grep + judgment, not `mem_judge` automation.

**Follow-ups**

- Document in `harness/research/memory-model.md` (shipped in template).
- Register skill in `docs/skills.md`; wire checkpoints in methodology, Phase 7, `start-sprint` handoff.
