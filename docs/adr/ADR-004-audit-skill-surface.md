# ADR-004: Audit skill surface — defer unification

## Status

Accepted (deferred implementation) — 2026-07-06

## Context

Repo audit Phase F proposed merging `/midas-tribunal`, `/midas-security-audit`, and `/close-sprint`
checklists into one importable surface. Today:

- `/close-sprint` is the **binding Phase-8 gate** (advances sprint state).
- `/midas-tribunal` and `/midas-security-audit` are **informational, non-advancing** debates/scans.

Unifying them risks conflating optional debate with mandatory gate semantics.

## Decision

**Do not merge** audit skills in v0.5.x. Keep three commands with explicit roles documented in
`harness/methodology.md` § Phase 7 execution ladder and cross-links in `start-sprint` / `close-sprint`.

Future work may add a **shared checklist fragment** in `harness/templates/audit-record.md` consumed by
all three — not a single slash-command.

## Consequences

- Agents must still run `/close-sprint` for gates; tribunal/security remain optional.
- Reduced blast radius vs a mega-skill that could be mistaken for a gate pass.
