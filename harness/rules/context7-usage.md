# Rule: Always use Context7 before writing third-party code (always-on)

**This is the highest-leverage rule in Keel. It applies in every tool, every phase that touches
code (4 Tech/Architecture and 7 Sprint Execution).**

> Before generating, modifying, or reviewing any code that calls a **third-party library or
> framework**, you MUST first fetch its current, version-accurate docs via the Context7 MCP server:
> 1. Call `resolve-library-id` with the library name (e.g. `next.js`, `drizzle-orm`).
> 2. Call `get-library-docs` with the resolved id, the **version in use** (from the lockfile /
>    `package.json` / `requirements.txt`), and a `topic` filter for the API you need.
> 3. Write code against the returned docs — not against memory, which may be stale or hallucinated.

## Why
A hallucinated or out-of-date API costs far more in rework than one doc fetch. Context7 eliminates
the two most common dependency failures: APIs that never existed, and APIs that changed after the
model's training cutoff.

## Cost / when to skip
- Route Context7 fetches to the **scout** tier (Haiku) — they are mechanical retrieval.
- Skip only for the **standard library** of the language in use, or APIs you have already fetched
  in this session for the same version.

## Required fallback (must be honored, not just documented)
If Context7 is **unreachable or rate-limited** (anonymous tier returns 429 / "quota exceeded"):
1. Fall back to `WebSearch`/`fetch` for the official docs of the **pinned** version, and
2. Add a visible note in the code/PR: `// docs: <lib>@<version> via web fallback (Context7 unavailable)`,
   and
3. Recommend the user add a free Context7 API key (`CONTEXT7_API_KEY`) for active build sprints.

Never silently generate third-party code from memory when Context7 is down.

## Portability
This rule is replicated verbatim into every generated tool adapter (`CLAUDE.md`, the Cursor
`.mdc`, the Windsurf rule) and stated in `AGENTS.md`, so it fires regardless of the agent in use.
