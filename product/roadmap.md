# Roadmap — midas-harness engine

## MVP definition (from business-plan.md)

1. Autonomy P0 CI-smokeable (`--autonomy` + fake runner).
2. `/midas-retro` read-only retrospective skill shipped.
3. Installer `--update` rebaseline documented with test citation.

## Sprint sequence

| Sprint | Title | Goal | Depends on | Status |
|--------|-------|------|------------|--------|
| 01 | autonomy-ci-smoke | Prove optional autonomy installs and fake-runner tick in structural tests | — | done |
| 02 | midas-retro-skill | Ship read-only `/midas-retro` skill with catalog + quality gate | — | done |
| 03 | installer-update-docs | Document update/rebaseline contract in INSTALL.md with test anchor | — | done |

Sprints are **parallelizable** after planning; ordering is pedagogical (autonomy first per ADR-009).

## Dependency notes

- Sprint 01 may use `examples/taskpilot/` fixtures only as reference — no TaskPilot code changes required.
- Sprint 02 has no third-party API calls (no Context7 required for skill markdown).
- Sprint 03 is docs + cross-check existing `scripts/test.mjs` installer tests.

## Out of scope (v1 non-goals)

- Autonomy P1 profiles, merge/deploy, methodology sign-off removal.
- Hosted Midas SaaS, cloud agent runtime beyond optional Cursor Cloud in pilot docs.
- Full gstack skill parity (only `/midas-retro` in this MVP).

## Success metrics reminder

| Metric | Target | Sprint |
|--------|--------|--------|
| SM-1 Autonomy CI smoke | structural test green | 01 |
| SM-2 Retro skill | catalog + skill-quality pass | 02 |
| SM-3 Update docs | INSTALL.md + test id | 03 |

---

*Gate check: MVP scope covered ✓, each sprint has goal + acceptance + DoD ✓, deps ordered ✓.*  
*Next: run `/start-sprint 01` (Phase 7).*
