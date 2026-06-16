# Rule: Documentation (always-on)

Good documentation lives as close to the code as possible and stays current. These rules apply
from Phase 5 onward and are audited in Phase 8 by checking that new public surfaces carry
adequate docs and that no stale or contradictory docs were introduced. Stack-specific tooling
(e.g. JSDoc, docstrings, Storybook, OpenAPI) is wired by `/define-conventions`.

## Checklist

### Public API surface
- [ ] Every public function, class, method, and module-level constant exported by a module has
      at least a one-line doc comment stating *what it does* and any non-obvious preconditions.
- [ ] Doc comments describe the *why/what*, not a restatement of the signature
      (`// returns user` is not a doc comment; `// Returns the authenticated user for the current session` is).
- [ ] Parameters and return values with non-obvious types or constraints are documented.
- [ ] Deprecated APIs carry a doc comment: `@deprecated <reason> — use <alternative> instead`.

### In-code comments
- [ ] Non-obvious logic or intentional workarounds are explained with a comment stating *why*,
      not restating *what* the code does.
- [ ] Every `TODO` follows the format in `code-quality.md`: `TODO(<owner>|<issue>): <condition>`.
- [ ] No commented-out code blocks (use git history or a branch for that).
- [ ] Inline comments that reference an external resource (spec, issue, paper) include the URL.

### Harness artifacts
- [ ] Each sprint's `product/sprints/NN-*.md` has a completed acceptance column before the
      Phase-8 audit (done items summarize what was built, not just the original goal).
- [ ] Any rule in `harness/rules/` that is consciously amended during a sprint includes a
      `## Amendment log` entry at the bottom with date, reason, and who decided.
- [ ] ADRs (`product/adr/ADR-*.md`) follow the template: Context, Decision, Consequences.
      An ADR is never deleted — superseded ADRs are marked `[SUPERSEDED by ADR-N]`.

### README and setup docs
- [ ] `README.md` (or the stack entry-point doc) contains a working *Getting Started* section
      that a new contributor can follow from a clean checkout to a running dev environment.
- [ ] Environment variable requirements are documented in a `.env.example` or equivalent file
      committed to the repo (values are placeholders, never real secrets).
- [ ] Any non-obvious CI or deployment step is documented in `README.md` or a
      `docs/` file and cross-referenced from the sprint where it was introduced.

### Accuracy
- [ ] Docs are updated in the same commit as the code change they describe — stale docs are
      treated as a bug, not a backlog item.
- [ ] External links in docs are verified reachable before merging (broken links are replaced
      or removed).
- [ ] No contradictions between `harness/conventions.md`, stack-specific rule extensions, and
      inline doc comments — if a discrepancy is found, the harness file wins and the inline
      comment is corrected.
