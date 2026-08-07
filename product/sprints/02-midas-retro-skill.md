# Sprint 02 — midas-retro-skill

| Field | Value |
|---|---|
| **Sprint number** | 02 |
| **Status** | done |
| **Started** | 2026-08-07 |
| **Target close** | 2026-08-07 |
| **Depends on** | none |

## Goal

Ship a read-only `/midas-retro` skill that captures a sprint retrospective under `{runs}/` without
advancing lifecycle stage — closing the gstack `/reflect` gap documented in `docs/gstack-comparison.md`.

## Scope / non-scope

**In:** `harness/skills/midas-retro/SKILL.md`, registry + `docs/skills.md`, `npm run build` mirrors.

**Out:** Auto-scheduled retros; vector memory; changes to `paths.state` stage; midas-doc skill.

## Acceptance criteria

- [x] WHEN `/midas-retro` runs after a sprint, the system SHALL write `{runs}/retros/retro-NN.md` (or equivalent) with learnings table.
- [x] WHEN the skill completes, `paths.state` stage SHALL remain unchanged (`disable-model-invocation` respected).
- [x] WHEN `node scripts/skill-quality-check.mjs` runs, `midas-retro` SHALL report no hard fails.
- [x] WHEN `docs/skills.md` is read, `/midas-retro` SHALL appear in the catalog.

## Definition of Done (DoD)

- [x] All acceptance criteria above are met.
- [x] Skill follows `harness/rules/skill-quality.md` (frontmatter, Tier & delegation, ≤500 lines).
- [x] Propagation complete (`harness/rules/change-propagation.md` — `npm run align` / `npm run build`).
- [x] Skill quality score block recorded in sprint notes or PR description.
- [x] `product/features.json` F-002 updated if criteria met.

## Tasks

| # | Task | Tier | Status | Notes |
|---|------|------|--------|-------|
| 1 | Author `harness/skills/midas-retro/SKILL.md` (read-only, scout/orchestrate split) | orchestrate | done | build + scout split in Tier & delegation |
| 2 | Add retro record template under `harness/templates/` if needed | build | done | `retro-record.md` |
| 3 | Register in `scripts/skill-registry.mjs` + `docs/skills.md` | build | done | generator + catalog |
| 4 | Run `npm run align` and skill-quality-check | build | done | via build + test |

## Skill quality gate — midas-retro (leaf)

```
Skill quality: midas-retro (leaf)  Mode: standard  Score: 34/40  🟢
Hard fails: none
Core floors: ok
Evidence: Trigger=description WHAT+WHEN+NOT vs close-sprint/progress; Structure=Does/Does not+Args+Procedure+Exit; Completion=exit gate + MIDAS_RETRO_RESULT; Safety=disable-model-invocation + no stage mutation
Lowest: Efficiency=3, Calibration=3
Next fix (if not 🟢): n/a
```

## Blockers

- none

## Phase 8 audit notes

- **Audit file:** `.harness/audits/audit-02.md`
- **Verdict:** pass (un-attested) — re-attest with orchestrate `/close-sprint` for binding gate
