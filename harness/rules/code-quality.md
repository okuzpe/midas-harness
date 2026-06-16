# Rule: Code quality (always-on)

These rules apply from Phase 5 onward and are audited every sprint in Phase 8. They expand the
brief code-quality section of `harness/conventions.md` into checkable audit items. Where a rule
is stack-specific (e.g. linter config, max line length), `/define-conventions` generates an
extension under `harness/rules/` that overrides or supplements the items here.

## Checklist

### Consistency
- [ ] New code matches the surrounding style: naming, indentation, comment density, idioms.
- [ ] No second way of doing something that already has a project pattern — reuse the pattern.
- [ ] No parallel "standards" layer introduced outside `harness/conventions.md` and its extensions.

### Functions and modules
- [ ] Every function does exactly one thing and is named for its effect, not its type.
- [ ] Functions are short enough to read without scrolling (guideline: ≤ 40 logical lines;
      `/define-conventions` sets the stack-specific hard limit).
- [ ] No function has more than 3–4 parameters; group related params into a named object/struct.
- [ ] Module/layer boundaries defined in `product/architecture.md` are respected — no
      cross-layer imports.

### Cleanliness
- [ ] No dead code (unreachable branches, unused variables, unreferenced exports).
- [ ] No commented-out code blocks; use a git branch or an ADR note instead.
- [ ] Every TODO in code has a format: `TODO(<owner>|<issue>): <condition>`. Open-ended TODOs
      are a gate failure.
- [ ] No `console.log` / `print` / debug statements left in committed code unless they are
      structured log calls wired to the project logger.

### Abstractions
- [ ] Before writing a new utility, grep the codebase for an existing one (document the search
      result in the PR if a new utility is justified).
- [ ] No premature abstraction: generalize only when a third distinct call site exists.
- [ ] No over-abstraction: a wrapper that adds no logic is removed.

### Dependencies
- [ ] Every new dependency is justified in the PR (size, maintenance status, license).
- [ ] All dependency versions are pinned (no unbound `^`, `~`, or `*`).
- [ ] Third-party APIs are called only after following `harness/rules/context7-usage.md`.

### Error handling
- [ ] All external inputs (HTTP requests, file reads, CLI args, env vars) are validated at the
      boundary before use.
- [ ] Errors propagate with actionable messages; error messages never include raw secrets or
      internal stack details exposed to end users.
- [ ] No silent error swallowing (`catch (_) {}` or bare `except: pass` with no log/rethrow).
