# Context & file hierarchy

Midas writes a handful of files into your project. This page is the single map of **what each file is
for, who edits it, and which one wins when they conflict** — so neither you nor the agent has to guess.

## The files, top to bottom

| File / dir | Role | Who edits it | Read by |
|---|---|---|---|
| `AGENTS.md` | **Project law** — the source of truth for conventions, the fetch-current-docs rule, and model-routing intent | you / `/define-conventions` | every tool natively |
| `.claude/CLAUDE.md` · `GEMINI.md` · `.cursor/rules/00-midas.mdc` · `.windsurf/rules/00-midas.md` | **Generated adapters** | **generated — never hand-edit** (`/midas-doctor` re-renders) | selected hosts |
| `.harness/engine/conventions.md` + `.harness/engine/rules/*` | Immutable versioned base rule bodies | Midas release | inlined into adapters |
| `.harness/rules/*` | Project-specific rule overlays; matching slug wins over base | you / `/define-conventions` / `/midas-capture` | inlined into adapters |
| `.harness/state.yaml` | **Operational state only** — current phase, gates, routing, tools, paths, sprint pointer | skills (read first, write last) | `/midas-status`, every skill |
| `.harness/product/*` | **Lifecycle artifacts** — idea, market, architecture, ADRs, roadmap, sprints | phase skills | relevant phases |
| `.harness/runs/*` | Frozen evidence plus active sprint progress | audit/verify/progress skills | reference / evidence / resume |
| `.harness/manifest.json` | Ownership ledger (`vendor`, `generated`, `user`) | installer | update, doctor, uninstall |

## Precedence (when rules conflict, higher wins)

```
project rule overlay (<paths.rules>/)  >  stack-specific rules  >  {product}/conventions.md  >  {product}/design-system.md  >  engine base
```

Stack-specific rules are generated in Phase 5 (`/define-conventions`), with the stack's current docs fetched (Context7 or your own tool).
`.harness/product/conventions.md` and `design-system.md` are project overrides you own. Engine conventions
is the floor every project starts from. There is exactly **one** taxonomy — don't add a parallel one.

## Two rules of thumb
- **Edit the source, not the adapter.** Change `.harness/rules/`, then run `/midas-doctor`
  (or `node .harness/scripts/render-adapters.mjs`) to regenerate selected-host adapters.
  Generated files carry a `<!-- midas:begin -->` … `<!-- midas:end -->` managed block; content outside it is yours.
- **Keep `state.yaml` minimal.** It holds only operational state (the program counter). Long-form detail lives
  in `.harness/product/*` and `.harness/runs/*`; state references them by path. See
  [the state schema](https://github.com/okuzpe/midas-harness/blob/main/harness/state.schema.md).
