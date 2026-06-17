# Phase 0b — Codebase Inventory (brownfield)

**Stage:** pre-`tech_architecture` (brownfield only) | **Tier:** scout (extract) + orchestrate (infer)

> The brownfield on-ramp, run via `/midas-adopt`. Produces the factual picture of an existing project
> that the rest of the pipeline reverse-engineers from. Strictly read-only until the dry-run/diff-confirm
> step in `/midas-adopt`.

## Purpose
Build a faithful, evidence-based picture of what the project **is**, so Midas can codify reality (rules,
architecture) instead of inventing it.

> **Scan robustly.** Read the **repo's files** (manifests, source, tests, CI configs) to detect languages
> and stack — do **not** depend on toolchains being installed on this machine (a sandbox / CI box may lack
> `go`/`flutter`/etc.). Prefer Glob/Grep/Read; when shelling out, run probes independently and swallow
> benign failures (`… || true`) so a missing dir, empty glob, or absent tool reads as data, not an error.

## Inputs
The existing repository: code, manifests, CI, any `AGENTS.md` / `CLAUDE.md` / `.cursor` / `.windsurf`, **and
the project's written intent** — `README*`, `docs/`, briefs/specs/`NOTES`, the manifest `description`.

## Key steps
1. **Tree + size** — enumerate the directory structure and the dominant languages.
2. **Manifests + versions** — read every manifest; list dependencies and **pin versions** (Context7-verify).
3. **Conventions in practice** — sample real files for naming, layering, error handling, test setup.
4. **Existing agent config** — catalogue any `AGENTS.md`/`CLAUDE.md`/`.cursor`/`.windsurf` so they can be
   **merged inside managed markers**, never clobbered.
5. **Build / test / CI** — how the project is built, tested, and deployed.
6. **Stated intent** — harvest the product's purpose/audience/scope from the README and docs, so the
   `/midas-adopt` Step 4 backfill records *what's written*, not an invention (cite the source).

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
