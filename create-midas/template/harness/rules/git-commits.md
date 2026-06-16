# Rule: Git commits (always-on)

These rules apply from Phase 5 onward and are verified during Phase-8 audits by inspecting the
sprint's commit log. They expand the brief Git section of `harness/conventions.md`. Team-specific
branch strategies (e.g. GitHub Flow vs trunk-based) are added by `/define-conventions`.

## Checklist

### Commit message format
- [ ] Every commit message follows Conventional Commits:
      `<type>(<optional scope>): <short imperative summary>` on line 1 (≤ 72 chars).
- [ ] Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `style`, `ci`.
      No invented types — if a type is missing, raise it in the team conventions.
- [ ] The summary is imperative present tense: "add user auth" not "added" or "adding".
- [ ] Breaking changes include `!` after the type/scope (`feat!:`) and a `BREAKING CHANGE:` footer.
- [ ] Optional body (separated by a blank line) explains the *why*, not the *what*.

### Commit hygiene
- [ ] Each commit is a single logical change — reviewable in isolation without guessing context.
- [ ] No commits bundle unrelated changes (e.g. a bug fix + a new feature in one commit).
- [ ] No commit contains secrets, tokens, credentials, or `.env` files (see `security.md`).
- [ ] No "WIP", "temp", "asdf", or "fix fix fix" commits in the branch history before merge.
      Squash or reword before opening a PR.
- [ ] Binary files (images, compiled artifacts, lock files that balloon on change) are not
      committed unless specifically required and documented.

### Branch discipline
- [ ] All feature and fix work branches off the project's default branch (never off another
      feature branch unless the dependency is explicit and documented in the PR).
- [ ] Branch names follow the pattern `/define-conventions` generates (typically
      `<type>/<short-slug>`, e.g. `feat/user-auth`, `fix/login-redirect`).
- [ ] Branches are short-lived: merged or abandoned within the sprint they were opened.
- [ ] The default branch is never force-pushed without explicit team agreement and an ADR note.

### Push and merge discipline
- [ ] Code is committed and pushed **only when the human explicitly requests it** — not
      proactively by the agent.
- [ ] PRs are opened against the default branch; the PR description references the sprint task
      and acceptance criteria from `product/sprints/NN-*.md`.
- [ ] Merge commits are squashed or rebased per the strategy set in `/define-conventions`; the
      choice is consistent across the team (one strategy per project).
