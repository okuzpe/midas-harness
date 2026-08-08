# Hygiene sweep sweep-01

Ran: 2026-08-06 · Tier: build · Scope: `all` · Depth: `standard`  
Stage snapshot: `plan_sprints` / `pending` · mode: `brownfield` · midas_version: `2.5.2`  
**Amended:** 2026-08-06 — fixes applied in parts (monorepo alias → legacy templates → local node_modules)

Engine dogfood repo (classic layout). No app `src/` — code pass focused on
`scripts/`, `create-midas/`, skills trees, templates, and `examples/taskpilot`.

## Findings

| # | Severity | Category | Path | Note | Disposition |
|---|----------|----------|------|------|-------------|
| 1 | high | dead-flow | `harness/skills/midas-monorepo/` (+ mirrors) | Documented **Removed in 2.1.0**; still shipped at **2.4.0**. | **fixed** — skill deleted; docs/registry/AGENTS updated; `npm run build` + verify |
| 2 | medium | stale-doc | `docs/skills.md`, pipeline, ADRs | Said "Removed in 2.1.0" while artifact remained. | **fixed** — catalog/flows/ADRs point at `/midas-init --monorepo` only |
| 3 | medium | orphan | `harness/templates/cursor-rule.mdc.tmpl` | Deprecated; unused by render. | **fixed** — deleted |
| 4 | medium | orphan | `harness/templates/windsurf-rule.md.tmpl` | Same as #3. | **fixed** — deleted |
| 5 | medium | orphan | `harness/templates/README-legacy-adapters.md` | Only documented #3–#4. | **fixed** — deleted |
| 6 | low | hygiene | `examples/taskpilot/.midas/product/node_modules/` | ~433 MB local; gitignored. | **fixed** — removed locally (~0.4 MB left) |
| 7 | low | hygiene | `.harness/audits/repo-audit-01.md`, `.harness/debates/debate-01.md` | Stale dogfood records. | **accepted** — keep as historical dogfood evidence |

## Clean / not findings

| Area | Result |
|------|--------|
| `scripts/*.mjs` (25) | All wired — **no orphan scripts**. |
| Skill trees | **31 shipped** + **1 engine-only** (`midas-precommit`); deprecated `midas-monorepo` removed. |
| `node scripts/doctor.mjs` | Adapters + health **ok** after align. |
| Root `package.json` deps | None. |
| `product/` missing features/roadmap | Expected at `plan_sprints` pending. |

## Fix plan applied

1. Deleted `harness/skills/midas-monorepo/` + `.claude/skills/midas-monorepo/`; updated
   `scripts/skill-registry.mjs`, pipeline, `AGENTS.md` / tmpl, `docs/skills.md`,
   `docs/skill-flows.md`, ADRs, `CHANGELOG` Unreleased; rebuilt mirrors (`build-plugin`,
   `build-create`); `npm run verify` → 824 pass.
2. Deleted legacy templates #3–#5; rebuilt create-midas template; tests green.
3. Removed local taskpilot `node_modules`.
4. Left `.harness/audits|debates` (accepted).

MIDAS_SWEEP_RESULT: dead_flows=0 orphans=0 ledger_drift=0 stale_docs=0 harness_drift=0 hygiene=0 verdict=fixed

## Disposition

fixed — all actionable rows closed; #7 accepted.

**Amended 2026-08-07:** sweep-02 confirms post-audit hygiene (`verdict=clean`); see
`.harness/audits/repo-audit-02.md` for audit-cycle closure.
