# Repo audit 01 — Midas harness engine

Frozen: 2026-07-06 · Scope: skills, rules, flows, scripts, docs, examples (plan phases A–F)

MIDAS_REPO_AUDIT: area=all findings=0 verdict=pass

## Summary

Full repository audit per phased plan. All P0–P3 items addressed or recorded in ADRs.

| Phase | Verdict | Highlights |
|---|---|---|
| A0 | pass | `/midas-bundle` v0.5.30 verified (`npm run verify` green) |
| A | pass | deep-research refs fixed; README tracks; gstack PROPOSED; TaskPilot OQ-09; template deprecation note; test.mjs fixes |
| B | pass | `harness/stage-command-table.yaml` + `scripts/stage-command-table.mjs`; methodology Phase 7 ladder; recall verifications; start/close clarity; lite ritual |
| C | pass | CHECK dedupe (docs↔code-quality); `context7-usage.md` CHECKs; `acceptance-criteria.md`; adapter digest Option A in `change-propagation.md` |
| D | pass | rules-match hash test; auto `ENGINE_BASE_RULES`; migrate-layout/bundle CLI smoke; TaskPilot artifacts test; CI `npm run align` job |
| E | pass | INSTALL canonical; TaskPilot `features.json` + `01-progress.md`; repository-arch glosario; ADR-001 status note |
| F | pass | `/midas-progress` skill; ADR-004 audit unification deferred; ADR-005 AGENTS generation strategy |

## Residual / watch

- Engine `AGENTS.md` remains hand-curated summary (ADR-005) — sync checklist on new skills.
- Adapter digest Option B (token reduction) deferred.
- Legacy `cursor-rule.mdc.tmpl` / `windsurf-rule.md.tmpl` deprecated, not deleted (post-1.0).
- PROPOSED gstack skills (`/midas-retro`, `/midas-doc`) not shipped.

## Evidence

- `node scripts/test.mjs` — structural + new audit tests
- `npm run align` — propagation ladder
- `node scripts/doctor.mjs` — adapter sync
