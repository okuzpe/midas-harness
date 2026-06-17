# Rule: Fetch current docs before third-party code (always-on)

**One of the highest-leverage rules in Midas. It applies in every tool, every phase that touches code
(Phase 4 Tech/Architecture and Phase 7 Sprint Execution).** The rule is the *habit*, not a vendor —
wire whichever doc tool you like (or none, and do it by hand).

> Before generating, modifying, or reviewing any code that calls a **third-party library or framework**,
> first fetch its **current, version-accurate docs** — never write APIs from memory, which may be stale
> or hallucinated.

## How — pick a tool (Midas mandates the habit, not the vendor)
- **Recommended: the Context7 MCP** (free, fast). It is **optional** — wire it in `.mcp.json` only if you
  want it:
  1. `resolve-library-id` with the library name (e.g. `next.js`, `drizzle-orm`).
  2. `get-library-docs` with the resolved id, the **version in use** (from the lockfile/manifest), and a `topic`.
- **Or any equivalent:** a `fetch`/web-search MCP against the library's official docs for the **pinned**
  version, your editor's docs integration, or a local docs mirror. Whatever you use, **pin the version**.

Whichever tool: write code against the **returned docs for the version in use**, and leave a visible note
at the call site / PR — `// docs: <lib>@<version> via <tool>`.

## Why
A hallucinated or out-of-date API costs far more in rework than one doc fetch. The two most common
dependency failures — APIs that never existed, and APIs that changed after the model's training cutoff —
both vanish when current docs are in front of the model.

## Cost / when to skip
- Route doc fetches to the **scout** tier (Haiku) — mechanical retrieval.
- Skip only for the **standard library** of the language in use, or an API already fetched this session
  for the same version.

## If no doc tool is wired
You MUST still fetch the official docs for the **pinned** version by hand (web search / the docs site)
and cite them — **never silently generate third-party code from memory**. Context7 (or any doc MCP) just
*automates* this; it does not change the rule.

## Portability
This rule is replicated into every generated tool adapter (`CLAUDE.md`, the Cursor `.mdc`, the Windsurf
rule) and stated in `AGENTS.md`, so the habit fires regardless of the agent — or doc tool — in use.
