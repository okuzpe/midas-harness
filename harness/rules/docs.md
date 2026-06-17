# Rule: Documentation (always-on)

Good documentation lives as close to the code as possible and stays current. These rules apply
from Phase 5 onward and are audited in Phase 8 by checking that new public surfaces carry
adequate docs and that no stale or contradictory docs were introduced. Stack-specific tooling
(e.g. JSDoc, docstrings, Storybook, OpenAPI) is wired by `/define-conventions`.

> **Every item carries a `**CHECK:**`** — the concrete condition the Phase-8 audit evaluates: a
> grep/command where one exists, or a `manual:` observable when judgment is required (the auditor
> records pass/fail with `file:line` evidence).

## Checklist

### Public API surface
- [ ] Every public function, class, method, and module-level constant exported by a module has
      at least a one-line doc comment stating *what it does* and any non-obvious preconditions.
      **CHECK:** `manual:` each `export`ed symbol in the diff is preceded by a doc comment; an undocumented public export is a fail.
- [ ] Doc comments describe the *why/what*, not a restatement of the signature
      (`// returns user` is not a doc comment; `// Returns the authenticated user for the current session` is).
      **CHECK:** `manual:` a doc comment that merely echoes the signature is a fail.
- [ ] Parameters and return values with non-obvious types or constraints are documented.
      **CHECK:** `manual:` non-obvious params/returns (ranges, units, nullability) are documented; an undocumented constraint is a fail.
- [ ] Deprecated APIs carry a doc comment: `@deprecated <reason> — use <alternative> instead`.
      **CHECK:** `grep -rnE "@deprecated" src/` → each match names a reason and an alternative.

### In-code comments
- [ ] Non-obvious logic or intentional workarounds are explained with a comment stating *why*,
      not restating *what* the code does.
      **CHECK:** `manual:` each workaround/non-obvious branch has a *why* comment; a comment restating the code is a fail.
- [ ] Every `TODO` follows the format in `code-quality.md`: `TODO(<owner>|<issue>): <condition>`.
      **CHECK:** `grep -rnE "TODO" src/ | grep -vE "TODO\((\w+|#[0-9]+)\):"` → empty (shared with `code-quality.md`).
- [ ] No commented-out code blocks (use git history or a branch for that).
      **CHECK:** review for commented-out statements (`grep -nE "^\s*(//|#).*[;{}()]" <diff>`) → none.
- [ ] Inline comments that reference an external resource (spec, issue, paper) include the URL.
      **CHECK:** `manual:` a comment citing a spec/issue/paper includes its URL or issue id.

### Harness artifacts
- [ ] Each sprint's `product/sprints/NN-*.md` has a completed acceptance column before the
      Phase-8 audit (done items summarize what was built, not just the original goal).
      **CHECK:** the active sprint file's acceptance/Tasks table has no `todo`/`in-progress` rows at audit time.
- [ ] Any rule in `harness/rules/` that is consciously amended during a sprint includes a
      `## Amendment` entry at the bottom with date, reason, and who decided.
      **CHECK:** `manual:` each rule changed this sprint carries a dated `## Amendment` entry; a silent rule edit is a fail.
- [ ] ADRs (`product/adr/ADR-*.md`) follow the template: Context, Decision, Consequences.
      An ADR is never deleted — superseded ADRs are marked `[SUPERSEDED by ADR-N]`.
      **CHECK:** each ADR has Context/Decision/Consequences sections; `git log --diff-filter=D -- product/adr/` shows no deleted ADR.

### README and setup docs
- [ ] `README.md` (or the stack entry-point doc) contains a working *Getting Started* section
      that a new contributor can follow from a clean checkout to a running dev environment.
      **CHECK:** `grep -iE "getting started|quickstart|setup" README.md` present, and the steps run from a clean checkout.
- [ ] Environment variable requirements are documented in a `.env.example` or equivalent file
      committed to the repo (values are placeholders, never real secrets).
      **CHECK:** `.env.example` (or equivalent) exists and lists every env var the code reads, with placeholder values only.
- [ ] Any non-obvious CI or deployment step is documented in `README.md` or a
      `docs/` file and cross-referenced from the sprint where it was introduced.
      **CHECK:** `manual:` each non-obvious CI/deploy step has a doc reference; an undocumented deploy step is a fail.

### Accuracy
- [ ] Docs are updated in the same commit as the code change they describe — stale docs are
      treated as a bug, not a backlog item.
      **CHECK:** `manual:` a behaviour change whose docs are untouched in the same commit is a fail.
- [ ] External links in docs are verified reachable before merging (broken links are replaced
      or removed).
      **CHECK:** a link-checker over changed docs returns no 4xx/5xx; a broken link is a fail.
- [ ] No contradictions between `harness/conventions.md`, stack-specific rule extensions, and
      inline doc comments — if a discrepancy is found, the harness file wins and the inline
      comment is corrected.
      **CHECK:** `manual:` cross-read changed docs against `harness/conventions.md` + rules; a contradiction is a fail (harness file wins).
