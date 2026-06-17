# Rule: Code quality (always-on)

These rules apply from Phase 5 onward and are audited every sprint in Phase 8. They expand the
brief code-quality section of `harness/conventions.md` into checkable audit items. Where a rule
is stack-specific (e.g. linter config, max line length), `/define-conventions` generates an
extension under `harness/rules/` that overrides or supplements the items here.

> **Every item carries a `**CHECK:**`** — the concrete condition the Phase-8 audit evaluates: a
> grep/command where one exists, or a `manual:` observable when judgment is required (the auditor
> records pass/fail with `file:line` evidence). This is the floor's half of the contract
> `/define-conventions` enforces on *generated* rules — every rule must be checkable.

## Checklist

### Consistency
- [ ] New code matches the surrounding style: naming, indentation, comment density, idioms.
      **CHECK:** `manual:` diff each new file against a sibling in the same directory; a naming/indent/idiom break that stands out from local style is a fail.
- [ ] No second way of doing something that already has a project pattern — reuse the pattern.
      **CHECK:** `manual:` grep the codebase for the concept (`grep -rin "<concept>" src/`); a parallel implementation of an existing pattern is a fail.
- [ ] No parallel "standards" layer introduced outside `harness/conventions.md` and its extensions.
      **CHECK:** any rules/standards/guidelines doc outside `harness/conventions.md` + `harness/rules/` is a fail (`find . -iname "*standard*" -o -iname "*guideline*"` outside those paths → empty).

### Functions and modules
- [ ] Every function does exactly one thing and is named for its effect, not its type.
      **CHECK:** `manual:` the name is a verb-phrase describing the effect; a body with multiple unrelated responsibilities (independent side effects) is a fail.
- [ ] Functions are short enough to read without scrolling (guideline: ≤ 40 logical lines;
      `/define-conventions` sets the stack-specific hard limit).
      **CHECK:** linter (`eslint max-lines-per-function` / equivalent) reports no function over the stack limit; absent a linter, no body exceeds ~40 logical lines.
- [ ] No function has more than 3–4 parameters; group related params into a named object/struct.
      **CHECK:** `manual:`/AST: no signature in the diff declares > 4 positional parameters.
- [ ] Module/layer boundaries defined in `product/architecture.md` are respected — no
      cross-layer imports.
      **CHECK:** grep imports against `harness/rules/folder-structure.md` (the project's Phase-5-generated rule; e.g. `grep -rn "from '@/db'" src/ui/` → empty); any forbidden cross-layer import is a fail.

### Cleanliness
- [ ] No dead code (unreachable branches, unused variables, unreferenced exports).
      **CHECK:** `eslint no-unused-vars` / `ts-prune` / `vulture` (per stack) reports zero unused or unreachable symbols in the diff.
- [ ] No commented-out code blocks; use a git branch or an ADR note instead.
      **CHECK:** review for commented-out statements (`grep -nE "^\s*(//|#).*[;{}()]" <diff>`); a commented-out code block is a fail.
- [ ] Every TODO in code has a format: `TODO(<owner>|<issue>): <condition>`. Open-ended TODOs
      are a gate failure.
      **CHECK:** `grep -rnE "TODO" src/ | grep -vE "TODO\((\w+|#[0-9]+)\):"` must be empty.
- [ ] No `console.log` / `print` / debug statements left in committed code unless they are
      structured log calls wired to the project logger.
      **CHECK:** `grep -rnE "console\.(log|debug)|(^|[^.])\bprint\(|fmt\.Print" src/` → empty, unless the match is the project logger.

### Abstractions
- [ ] Before writing a new utility, grep the codebase for an existing one (document the search
      result in the PR if a new utility is justified).
      **CHECK:** `manual:` the PR/sprint notes record the search for an existing utility; an unexplained duplicate utility is a fail.
- [ ] No premature abstraction: generalize only when a third distinct call site exists.
      **CHECK:** `manual:` a generic abstraction with fewer than 3 distinct call sites is a fail unless explicitly justified.
- [ ] No over-abstraction: a wrapper that adds no logic is removed.
      **CHECK:** `manual:` a wrapper/indirection that adds no behaviour over the call it forwards to is a fail.

### Dependencies
- [ ] Every new dependency is justified in the PR (size, maintenance status, license).
      **CHECK:** lockfile diff: every added dependency has a PR note covering size/maintenance/license; an unexplained addition is a fail.
- [ ] All dependency versions are pinned (no unbound `^`, `~`, or `*`).
      **CHECK:** `grep -nE ":\s*[\"']?[\^~*]" package.json` (or the stack manifest) → empty; lockfile committed.
- [ ] Third-party APIs are called only after following `harness/rules/context7-usage.md`.
      **CHECK:** each new third-party call site carries the Context7 (or documented web-fallback) doc note; a missing note is a fail.

### Error handling
- [ ] All external inputs (HTTP requests, file reads, CLI args, env vars) are validated at the
      boundary before use.
      **CHECK:** `manual:` each boundary entry validates shape/range before use; an unvalidated external read is a fail (evidence: `file:line`).
- [ ] Errors propagate with actionable messages; error messages never include raw secrets or
      internal stack details exposed to end users.
      **CHECK:** `manual:` inspect error/response paths; a message returning a raw secret or internal stack trace to a caller is a fail.
- [ ] No silent error swallowing (`catch (_) {}` or bare `except: pass` with no log/rethrow).
      **CHECK:** `grep -rnE "catch\s*\([^)]*\)\s*\{\s*\}|except[^\n]*:\s*\n\s*pass"` → empty.
