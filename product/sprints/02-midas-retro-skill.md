# Sprint 02 — midas-retro-skill

| Field | Value |
|---|---|
| **Sprint number** | 02 |
| **Status** | planned |
| **Started** | — |
| **Target close** | — |
| **Depends on** | none |

## Goal

Ship a read-only `/midas-retro` skill that captures a sprint retrospective under `{runs}/` without
advancing lifecycle stage — closing the gstack `/reflect` gap documented in `docs/gstack-comparison.md`.

## Scope / non-scope

**In:** `harness/skills/midas-retro/SKILL.md`, registry + `docs/skills.md`, `npm run build` mirrors.

**Out:** Auto-scheduled retros; vector memory; changes to `paths.state` stage; midas-doc skill.

## Acceptance criteria

- [ ] WHEN `/midas-retro` runs after a sprint, the system SHALL write `{runs}/retro/retro-NN.md` (or equivalent) with learnings table.
- [ ] WHEN the skill completes, `paths.state` stage SHALL remain unchanged (`disable-model-invocation` respected).
- [ ] WHEN `node scripts/skill-quality-check.mjs` runs, `midas-retro` SHALL report no hard fails.
- [ ] WHEN `docs/skills.md` is read, `/midas-retro` SHALL appear in the catalog.

## Definition of Done (DoD)

- [ ] All acceptance criteria above are met.
- [ ] Skill follows `harness/rules/skill-quality.md` (frontmatter, Tier & delegation, ≤500 lines).
- [ ] Propagation complete (`harness/rules/change-propagation.md` — `npm run align`).
- [ ] Skill quality score block recorded in sprint notes or PR description.
- [ ] `product/features.json` F-002 updated if criteria met.

## Tasks

| # | Task | Tier | Status | Notes |
|---|------|------|--------|-------|
| 1 | Author `harness/skills/midas-retro/SKILL.md` (read-only, scout/orchestrate split) | orchestrate | todo | |
| 2 | Add retro record template under `harness/templates/` if needed | build | todo | |
| 3 | Register in `scripts/skill-registry.mjs` + `docs/skills.md` | build | todo | |
| 4 | Run `npm run align` and skill-quality-check | build | todo | |

## Blockers

- none

## Phase 8 audit notes

- **Audit file:** `{runs}/audits/audit-02.md`
- **Verdict:** pending
