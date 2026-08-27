# ADR-005: AGENTS.md generation strategy

## Status

Accepted — 2026-07-06

## Context

Engine `AGENTS.md` is hand-maintained while installed adapters (`.claude/CLAUDE.md`, `.cursor/rules/00-midas.mdc`, …)
are rendered from `harness/conventions.md` via `scripts/render-adapters.mjs`. Drift between
`AGENTS.md` and conventions is an audit finding (G1).

Installed projects use `harness/templates/AGENTS.md.tmpl` filled by the installer — a different surface.

## Decision

**Option A (conservative):** Keep engine `AGENTS.md` as a **curated summary** edited alongside
`harness/conventions.md` when engine metadata changes (skills list, safety commands, routing table).
Do **not** auto-generate the full engine `AGENTS.md` in v0.5.x.

**Adapter digest:** ~~Keep full CHECK digest inline in generated adapters (Option A from audit Phase C).
Reducing to title-only digests (Option B) is deferred — token savings vs audit visibility trade-off.~~
**[SUPERSEDED by ADR-014](ADR-014-adapter-digest-on-demand.md)** — Option C (on-demand full digest)
for Cursor (and Windsurf when docs support an on-demand trigger); Gemini points at `checks.json` /
`rules/` instead of inlining. Engine `AGENTS.md` remains a curated summary (this ADR, Option A).

`npm run align` + `change-propagation.md` CHECKs enforce adapter sync; `AGENTS.md` sync remains manual
with a checklist item in repo audits.

## Consequences

- Contributors update `AGENTS.md` when adding side-effecting skills or changing routing.
- Future: optional `scripts/render-agents.mjs` may render bullets from conventions — requires template
  design so product installs are not affected.
