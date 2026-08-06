# Sprint 03 — installer-update-docs

| Field | Value |
|---|---|
| **Sprint number** | 03 |
| **Status** | planned |
| **Started** | — |
| **Target close** | — |
| **Depends on** | none |

## Goal

Document the `create-midas --update` ownership-manifest rebaseline flow in `INSTALL.md`, anchored to
existing structural tests so contributors know the contract before editing installer code.

## Scope / non-scope

**In:** `INSTALL.md` update section; cross-links from `docs/repository-architecture.md` if needed;
name specific `scripts/test.mjs` check ids.

**Out:** New installer features; migrate-v2 behaviour changes; version bump mechanics (already documented).

## Acceptance criteria

- [ ] WHEN a reader opens `INSTALL.md`, they SHALL find an **Update an existing install** section covering `--update`, conflicts, and rebaseline.
- [ ] WHEN the doc cites tests, it SHALL name at least one live `installer:*` or `create-midas:*` check from `scripts/test.mjs`.
- [ ] WHEN `npm test` runs, all cited structural checks SHALL pass.

## Definition of Done (DoD)

- [ ] All acceptance criteria above are met.
- [ ] Docs follow `harness/rules/docs.md` (behaviour change paired with doc update).
- [ ] No broken internal links in changed docs.
- [ ] `product/features.json` F-003 updated if criteria met.

## Tasks

| # | Task | Tier | Status | Notes |
|---|------|------|--------|-------|
| 1 | Inventory existing installer update tests in `scripts/test.mjs` | scout | todo | |
| 2 | Write INSTALL.md update section with rebaseline steps | build | todo | |
| 3 | Add one-line cross-link in `docs/repository-architecture.md` | build | todo | |
| 4 | Verify link targets and run `npm test` | build | todo | |

## Blockers

- none

## Phase 8 audit notes

- **Audit file:** `{runs}/audits/audit-03.md`
- **Verdict:** pending
