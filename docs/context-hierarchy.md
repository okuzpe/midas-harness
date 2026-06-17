# Context & file hierarchy

Midas writes a handful of files into your project. This page is the single map of **what each file is
for, who edits it, and which one wins when they conflict** — so neither you nor the agent has to guess.

## The files, top to bottom

| File / dir | Role | Who edits it | Read by |
|---|---|---|---|
| `AGENTS.md` | **Project law** — the source of truth for conventions, the fetch-current-docs rule, and model-routing intent | you / `/define-conventions` | every tool natively |
| `CLAUDE.md` · `GEMINI.md` · `.cursor/rules/00-midas.mdc` · `.windsurf/rules/00-midas.md` | **Generated adapters** — render `AGENTS.md` + conventions into each tool's format | **generated — never hand-edit** (`/midas-doctor` re-renders) | Claude Code · Gemini · Cursor · Windsurf |
| `harness/conventions.md` + `harness/rules/*` | The actual rule bodies (code quality, security, testing, Context7, …) | you / `/define-conventions` | inlined into the adapters |
| `harness/state.yaml` | **Operational state only** — current phase, gates, cost profile, tools, sprint pointer | the skills (read first, write last) | `/midas-status`, every skill |
| `product/*` | **Lifecycle artifacts** — `idea.md`, `market.md`, `business-plan.md`, `architecture.md`, `adr/*`, `design-system.md`, `roadmap.md`, `sprints/*` | the phase skills | the agent, during the relevant phase |
| `.harness/*` | **Frozen records** — `audits/`, `debates/`, `verifications/` (append-only) | `/close-sprint`, `/midas-tribunal`, `/midas-verify` | reference / evidence |

## Precedence (when rules conflict, higher wins)

```
stack-specific rules  >  product/conventions.md  >  product/design-system.md  >  harness/conventions.md (base)
```

Stack-specific rules are generated in Phase 5 (`/define-conventions`), with the stack's current docs fetched (Context7 or your own tool).
`product/conventions.md` and `product/design-system.md` are project overrides you own. `harness/conventions.md`
is the floor every project starts from. There is exactly **one** taxonomy — don't add a parallel one.

## Two rules of thumb
- **Edit the source, not the adapter.** Change `AGENTS.md` / `harness/conventions.md`, then run `/midas-doctor`
  (or `node scripts/render-adapters.mjs`) to regenerate `CLAUDE.md`, the Cursor/Windsurf rules, and `GEMINI.md`.
  Generated files carry a `<!-- midas:begin -->` … `<!-- midas:end -->` managed block; content outside it is yours.
- **Keep `state.yaml` minimal.** It holds only operational state (the program counter). Long-form detail lives
  in `product/*` and `.harness/*`; `state.yaml` references them by path. See [`harness/state.schema.md`](https://github.com/okuzpe/midas-harness/blob/main/harness/state.schema.md).
