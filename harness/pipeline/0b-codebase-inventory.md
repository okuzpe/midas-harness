# Phase 0b — Codebase Inventory (brownfield)

**Stage:** pre-`tech_architecture` (brownfield only) | **Tier:** scout (extract) + orchestrate (infer)

> The brownfield on-ramp, run via `/midas-adopt`. Produces the factual picture of an existing project
> that the rest of the pipeline reverse-engineers from. Strictly read-only until the dry-run/diff-confirm
> step in `/midas-adopt`.

## Purpose
Build a faithful, evidence-based picture of what the project **is**, so Midas can codify reality (rules,
architecture) instead of inventing it.

## Inputs
The existing repository: code, manifests, CI, and any `AGENTS.md` / `CLAUDE.md` / `.cursor` / `.windsurf`.

## Key steps
1. **Tree + size** — enumerate the directory structure and the dominant languages.
2. **Manifests + versions** — read every manifest; list dependencies and **pin versions** (Context7-verify).
3. **Conventions in practice** — sample real files for naming, layering, error handling, test setup.
4. **Existing agent config** — catalogue any `AGENTS.md`/`CLAUDE.md`/`.cursor`/`.windsurf` so they can be
   **merged inside managed markers**, never clobbered.
5. **Build / test / CI** — how the project is built, tested, and deployed.

## Output artifacts
`product/inventory.md` — the factual snapshot.

## Exit gate
- [ ] Languages, frameworks, and **pinned versions** captured (Context7-verified).
- [ ] Existing agent-config files catalogued (for managed-marker merge, not overwrite).
- [ ] Test / build / CI setup recorded.
- [ ] Nothing written outside `product/inventory.md` yet.

## Recommended agents
`midas-scout` (Haiku) extracts; `midas-orchestrator` (Opus) infers. Then continue with `/midas-adopt`
Step 2 (architecture) and Step 3 (rules derived from the real code).
