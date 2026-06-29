# ADR-001 — Install layout: consolidate the engine under `.midas/`

| Field | Value |
|---|---|
| **Status** | proposed |
| **Date** | 2026-06-29 |
| **Deciders** | maintainer + orchestrate tier |
| **Context7 verified** | n/a (no third-party library decision) |

> This is the first **engine-level** ADR (decisions about the Midas repository itself, not about a
> product built with Midas). Product ADRs live in a project's `product/adr/`; engine ADRs live here in
> `docs/adr/`.

## Context

A fresh install adds a lot of top-level entries to the user's project root. After `create-midas`
runs, the root holds the project's own files **plus** all of these Midas paths:

| Path | Role | Tool-mandated location? |
|---|---|---|
| `AGENTS.md` | Project law for every agent | **Yes** — Cursor/Copilot/Codex/Windsurf read it at root |
| `CLAUDE.md` | Claude Code project memory | **Yes** — Claude Code reads it at root |
| `.cursor/rules/00-midas.mdc` | Cursor always-on rule | **Yes** — Cursor only reads `.cursor/rules/` |
| `.windsurf/rules/00-midas.md` | Windsurf always-on rule | **Yes** — Windsurf only reads `.windsurf/rules/` |
| `GEMINI.md` | Gemini CLI memory | **Yes** — Gemini reads it at root |
| `.claude/skills/`, `.claude/agents/` | Agent Skills + agents | **Yes** — Claude Code **and Cursor** discover `.claude/skills/` natively |
| `.mcp.json` | MCP server wiring | **Yes** — MCP convention is repo root |
| `harness/` | The **engine**: methodology, rules, pipeline, templates | **No** — Midas-internal path |
| `harness/state.yaml` | Lifecycle spine (state) | **No** — Midas-internal path |
| `scripts/` | `doctor.mjs`, `render-adapters.mjs` | **No** — Midas-internal path |
| `docs/agents-and-models.md` | Model routing reference | **No** — Midas-internal path |
| `product/` | The user's product artifacts | **No** — but this is *their* work, not the engine |
| `.harness/` | Run output: audits, verify records, volatile cache/hashes | **No** — Midas-internal path |

Two problems:

1. **Root clutter.** Even a Cursor-only install (after `--tools=cursor`, v0.5.19) still drops
   `harness/`, `.claude/`, `scripts/`, `.mcp.json`, `AGENTS.md`, and the Cursor adapter into the root.
   The engine's internals (`harness/`, `scripts/`) sit at the same visual level as the user's code.
2. **`harness/` vs `.harness/` is genuinely confusing.** `harness/` is the **engine source** (committed,
   edited only for amendments); `.harness/` is **run output** (audits + gitignored cache). The near-
   identical names invite mistakes.

What is **not** a problem: `product/` is already cleanly separated from the engine, and v0.5.19 already
prunes unused tool adapters via `--tools`.

The hard constraint: the **tool-mandated** paths in the table above cannot move without breaking
discovery in each editor (no per-tool config exists today to relocate `.claude/skills/`, `.cursor/rules/`,
`AGENTS.md`, etc.). Only the **Midas-internal** paths are candidates to relocate.

## Decision

We will introduce an **opt-in compact layout** that consolidates the **Midas-internal** paths under a
single `.midas/` directory, while keeping the current ("classic") layout as the default until a future
major version. Tool-mandated paths stay exactly where each editor requires them.

```
npx github:okuzpe/midas-harness --layout=compact   # engine internals under .midas/
npx github:okuzpe/midas-harness --layout=classic   # current behaviour (default)
```

Compact layout target:

```
project-root/
  AGENTS.md                      # stays at root (tool-mandated)
  CLAUDE.md / GEMINI.md          # stays at root, only for selected tools
  .cursor/rules/00-midas.mdc     # stays (tool-mandated)
  .windsurf/rules/00-midas.md    # stays (tool-mandated)
  .claude/skills/ + agents/      # stays (tool-mandated discovery)
  .mcp.json                      # stays (MCP convention)
  product/                       # the user's work — stays visible at root
  .midas/                        # ← everything engine-internal moves here
    engine/                      # was harness/ (methodology, rules, pipeline, templates, conventions)
    scripts/                     # was scripts/ (doctor.mjs, render-adapters.mjs)
    docs/                        # was docs/agents-and-models.md
    state.yaml                   # was harness/state.yaml
    audits/ verifications/ debates/   # was .harness/* (run output)
    cache/                       # volatile, gitignored
```

This single move resolves both pain points: the root shows only tool-mandated files + `product/`, and
the `harness/` vs `.harness/` collision disappears (one `.midas/` tree, with `engine/` source vs run
output as named subdirectories).

## Considered alternatives

| Alternative | Pros | Cons | Reason rejected |
|---|---|---|---|
| **Do nothing (status quo)** | Zero work; no migration | Root clutter + `harness`/`.harness` confusion persist | The confusion is real and recurring; worth fixing |
| **Hard rename `harness/` → `.midas/` now, no opt-in** | Cleanest end state immediately | Breaking change for every existing install; `--update` cannot silently relocate trees; hundreds of hardcoded `harness/` refs across skills/pipeline/docs break at once | Too disruptive without a migration window |
| **Symlink `harness/` → `.midas/engine/`** | Keeps old refs working | Symlinks unreliable on Windows; pollutes git; doesn't actually declutter | Cross-platform fragility (Windows is a first-class target) |
| **Document the layers only (no move)** | Cheap; no risk | Doesn't reduce clutter; only mitigates confusion | Insufficient on its own — but adopted as the **short-term** step below |
| **Opt-in `--layout=compact`, classic default, deprecate later** *(chosen)* | No breaking change; migration window; users choose | Two layouts to support during transition; path-resolution must become layout-aware | Accepted — the cost is bounded and the end state is reachable safely |

## Consequences

### Positive

- Project root shows only tool-mandated files + `product/` — the engine's internals are tucked away.
- `harness/` (source) vs `.harness/` (output) confusion is eliminated under one `.midas/` tree.
- Mirrors the well-understood `.github/` / `.vscode/` convention (tool internals under a dotdir).
- `--tools` (v0.5.19) + `--layout` together give a genuinely minimal footprint.

### Negative / trade-offs

- **Two layouts to support** during the deprecation window. Every path reference (skills, pipeline,
  rules, `doctor.mjs`, `render-adapters.mjs`, `build-create.mjs`, `test.mjs`, `AGENTS.md`, uninstall,
  `/midas-monorepo`) must resolve the engine root from a single helper rather than a hardcoded
  `harness/` string. This is the bulk of the work.
- **Migration is multi-sprint**, not an installer tweak — see the count of `harness/` references in
  `docs/repository-architecture.md` (skills, pipeline, rules, tests).
- Docs, screenshots, and existing `--update`/uninstall logic all assume `harness/`.

### Risks

- **`--update` on a classic install must not half-migrate.** Mitigation: `--update` detects the
  installed layout from disk and refreshes **in place**; relocation only happens via an explicit
  `--migrate-layout` step (dry-run + diff-confirm, like `/midas-update`), never silently.
- **Monorepos** (`/midas-monorepo`) assume `harness/state.yaml` per package. Mitigation: the layout
  resolver is applied per package; the migration step is required before monorepo indexing under compact.
- **Drift between the two layouts in tests.** Mitigation: add a `scripts/test.mjs` matrix that asserts
  both layouts render identical adapter content from the same source.

## Migration map (classic → compact)

| Classic path | Compact path |
|---|---|
| `harness/` (engine source) | `.midas/engine/` |
| `harness/state.yaml` | `.midas/state.yaml` |
| `harness/VERSION` | `.midas/engine/VERSION` |
| `scripts/doctor.mjs`, `scripts/render-adapters.mjs` | `.midas/scripts/` |
| `docs/agents-and-models.md` | `.midas/docs/agents-and-models.md` |
| `.harness/audits/`, `.harness/verifications/`, `.harness/debates/` | `.midas/audits/`, `.midas/verifications/`, `.midas/debates/` |
| `.harness/cache/`, `.harness/*.hash` | `.midas/cache/` (gitignored) |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/…`, `.windsurf/…`, `.claude/…`, `.mcp.json` | **unchanged** (tool-mandated) |

## Rollout plan

1. **Short term (no breaking change).** Document the three-layer mental model (tool-mandated root /
   `product/` / engine internals) in `INSTALL.md` and `docs/repository-architecture.md`. Land `--tools`
   pruning (already shipped in v0.5.19).
2. **Medium term.** Introduce a single engine-root resolver used by every script and referenced by
   skills via `state.yaml`. Add `--layout=compact|classic` (default `classic`) and a `--migrate-layout`
   command with dry-run + diff-confirm. Add the both-layouts test matrix.
3. **Long term (next major).** Flip the default to `compact`; keep `--layout=classic` for one major
   version; provide an automatic, confirmed migration on `--update`.

---

*This ADR is engine-scoped. When accepted, link it from `docs/repository-architecture.md` and reflect
the chosen rollout step in `INSTALL.md`.*
