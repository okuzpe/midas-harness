# Midas base conventions (always-on)

This file is the **single body** of project law. Its contents are inlined into the generated tool
adapters (`CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`) and summarized in
`AGENTS.md`. Edit it here; run `/midas-doctor` (or `node scripts/render-adapters.mjs`) to propagate.

## Precedence (when rules conflict, higher wins)

```
stack-specific rules  >  product/conventions.md  >  product/design-system.md  >  these base conventions
```

Stack-specific rules are generated during Phase 5 by `/define-conventions` (docs-verified for the
chosen framework). `product/conventions.md` and `product/design-system.md` are project overrides the
team owns. This base file is the floor every project starts from. There is exactly **one** taxonomy —
do not introduce a parallel "standards" layer.

## Code quality
- Match the surrounding code: naming, structure, comment density, idioms. New code should be
  indistinguishable from existing code.
- Prefer reuse over new abstractions. Search for an existing utility before writing one.
- Functions do one thing; keep them small and named for their effect.
- No dead code, no commented-out blocks, no TODO without an owner/condition.

## Naming
- Files and directories: kebab-case. Types/classes: PascalCase. Functions/vars: per language idiom.
- Names describe intent, not type (`activeUsers`, not `userArray`).

## Errors & boundaries
- Validate at boundaries (inputs, external responses). Fail fast with actionable messages.
- Never swallow errors silently; never log secrets.
- Respect module/layer boundaries defined in the architecture rules (no cross-layer imports).

## Testing
- Every behavior change ships with a test. Test the behavior, not the implementation.
- A sprint's Definition of Done references the testing rule; the Phase-8 audit checks it.

## Verification
- Verify every change with the **cheapest tool that proves it**: static (typecheck/lint/build) →
  tests → runtime smoke (boot it) → browser drive+inspect for UI. Fix and re-run until green before
  marking a task done. The **producer never grades its own homework** — the independent verdict is the
  Phase-8 audit. Full ladder: [`rules/verification.md`](./rules/verification.md).

## Acceptance criteria (EARS)
- Write each sprint acceptance criterion as a **testable** statement, not a vague goal. Prefer EARS:
  `WHEN <trigger>, the system SHALL <response>` (unconditional: `The system SHALL <response>`; use
  `WHILE <state>` / `IF <condition> THEN` for state and edge cases). One observable behavior per line.
- Mirror each criterion with a test named `given / when / then`, so the Phase-8 audit maps every
  criterion to a passing test. A criterion no test could prove is a goal, not a criterion — rewrite it.

## Dependencies
- Before adding a dependency, justify it (size, maintenance, license). Pin versions.
- Before writing code against any third-party library, **fetch its current docs** (Context7 recommended,
  or your own doc tool / web fetch) — see [`context7-usage.md`](./rules/context7-usage.md). Never code APIs from memory.

## Model routing (cost-aware)
- Match the model tier to the stakes: **strongest** to think/plan/audit/decide (`orchestrate`), a
  **mid** model to implement (`build`), the **fastest/cheapest** to search/extract/fetch (`scout`).
- A tier binds to a real model only when work is **delegated** to its first-party agent
  (`.claude/agents/midas-{orchestrator,builder,scout}.md`); a skill's `harness-tier` names its
  dispatch tier only, so delegate produce/fetch legs to `midas-builder` / `midas-scout` explicitly.
- On tools without per-agent model selection (Cursor/Copilot/Windsurf), apply this as **intent**:
  fastest model for research, strongest for architecture and audits. Ids + profiles:
  [`docs/agents-and-models.md`](../docs/agents-and-models.md); full rule:
  [`rules/model-routing.md`](./rules/model-routing.md).

## Git & commits
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Small, reviewable commits. Branch off the default branch; never commit secrets.
- Commit/push only when the human asks.

## Security
- Secrets only in env vars / per-developer config; never in committed files. MCP configs use
  `${ENV_VAR}` placeholders. Least-privilege for filesystem/git MCP scopes.
- Treat all external input as untrusted.

## Design system
- All UI uses the design tokens from `product/design-system.md` (`tokens.json` / `tokens.css`).
  Never hardcode colors, spacing, type sizes, or radii — reference tokens.
