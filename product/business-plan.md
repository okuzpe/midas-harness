# Business case — midas-harness engine (dogfood)

**Status:** go (engine meta-product) · Human sign-off: 2026-08-07 (audit-cycle closure)

## MVP scope (2.6 readiness)

Capabilities required to prove the harness is production-ready for optional autonomy and
contributor-scale installs — mapped to engine dogfood, not a hosted SaaS.

1. **Autonomy P0 is CI-smokeable** — `--autonomy` install + fake-runner tick without cloud tokens.
2. **`/midas-retro` skill** — read-only sprint retrospective (gstack `/reflect` gap; see
   `docs/gstack-comparison.md`).
3. **Installer update contract** — `create-midas --update` rebaseline path documented in `INSTALL.md`
   with named test coverage in `scripts/test.mjs`.

## Non-goals (v2.6)

- Hosted Midas control plane or marketplace beyond current GitHub plugin path.
- Autonomy P1 (auto-merge, deploy, `custom`/`full` profiles) — ADR-009 deferred.
- End-user application UI; TaskPilot remains the worked example for product installs.
- Rewriting `gstack-comparison.md` in English (separate docs sprint if ever scheduled).

## Success metrics

| ID | Metric | Target | Measurable in |
|----|--------|--------|---------------|
| SM-1 | Autonomy fake tick in CI | New structural test passes on every PR | Sprint 01 |
| SM-2 | `/midas-retro` in skills catalog | Skill quality gate pass + listed in `docs/skills.md` | Sprint 02 |
| SM-3 | Update path documented | `INSTALL.md` section cites rebaseline + test id | Sprint 03 |

## Go / no-go

**Go** — MVP is three thin engine sprints; Phase 7–8 execution is optional for this repo
(see `docs/dogfood.md`) but artifacts must be gate-complete for methodology dogfood.
