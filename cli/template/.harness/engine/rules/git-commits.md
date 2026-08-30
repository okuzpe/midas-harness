# Rule: Git commits (always-on)

These rules apply from Phase 5 onward and are verified during Phase-8 audits by inspecting the
sprint's commit log. They expand the brief Git section of `harness/conventions.md`. Team-specific
branch strategies (e.g. GitHub Flow vs trunk-based) are added by `/define-conventions`.

> **Every item carries a `**CHECK:**`** — the concrete condition the Phase-8 audit evaluates: a
> grep/`git log` command where one exists, or a `manual:` observable when judgment is required (the
> auditor records pass/fail with the offending commit SHA as evidence).

## Checklist

### Commit message format
- [ ] Every commit message follows Conventional Commits:
      `<type>(<optional scope>): <short imperative summary>` on line 1 (≤ 72 chars).
      **CHECK:** `git log <base>..HEAD --format=%s | grep -vE "^(feat|fix|docs|refactor|test|chore|perf|style|ci)(\(.+\))?!?: .{1,62}$"` → empty.
- [ ] Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `style`, `ci`.
      No invented types — if a type is missing, raise it in the team conventions.
      **CHECK:** same `git log` scan as above; any subject whose type is outside the allowed set is a fail.
- [ ] The summary is imperative present tense: "add user auth" not "added" or "adding".
      **CHECK:** `git log <base>..HEAD --format=%s | grep -iE ": (added|adding|fixed|fixing|updated|updating)\b"` → empty.
- [ ] Breaking changes include `!` after the type/scope (`feat!:`) and a `BREAKING CHANGE:` footer.
      **CHECK:** `git log HEAD --format=%B -n 50 | grep -E "^BREAKING CHANGE:"` is present whenever
      `git log HEAD --format=%s -n 50 | grep -E "^[a-z]+(\(.+\))?!:"` matches; a `!` subject without
      a `BREAKING CHANGE:` footer is a fail.
- [ ] Optional body (separated by a blank line) explains the *why*, not the *what*.
      **CHECK:** `manual:` where a body exists, it states rationale; a body that just restates the diff is a fail.
- [ ] Commit messages do not advertise AI vendors as authors or generators.
      **CHECK:** `git log <base>..HEAD --format=%B | grep -iE "(co-authored-by:.*(claude|copilot|chatgpt|gemini)|generated (by|with) (claude|copilot|chatgpt|gemini)|claude code)"` → empty.

### Commit hygiene
- [ ] Each commit is a single logical change — reviewable in isolation without guessing context.
      **CHECK:** `git log HEAD --format=%s -n 20` subjects are conventional; a commit spanning unrelated areas is a fail.
- [ ] No commits bundle unrelated changes (e.g. a bug fix + a new feature in one commit).
      **CHECK:** `git log HEAD --format=%s -n 20 | grep -E "^(feat|fix)\\(" ` mixed in one subject is a fail.
- [ ] No commit contains secrets, tokens, credentials, or `.env` files (see `security.md`).
      **CHECK:** `git log <base>..HEAD --name-only | grep -E "\.env($|\.)|\.pem$"` → empty; secret-scan the range (see `security.md`).
- [ ] No "WIP", "temp", "asdf", or "fix fix fix" commits in the branch history before merge.
      Squash or reword before opening a PR.
      **CHECK:** `git log <base>..HEAD --format=%s | grep -iE "^(wip|temp|asdf|fix fix)"` → empty.
- [ ] Binary files (images, compiled artifacts, lock files that balloon on change) are not
      committed unless specifically required and documented.
      **CHECK:** `git log <base>..HEAD --name-only` lists no unexpected binary/build artifacts; any such file is justified in the PR.

### Branch discipline
- [ ] All feature and fix work branches off the project's default branch (never off another
      feature branch unless the dependency is explicit and documented in the PR).
      **CHECK:** `git rev-parse --abbrev-ref HEAD` and `git merge-base HEAD HEAD` succeed; a branch forked off another feature branch without a documented dependency is a fail.
- [ ] Branch names follow the pattern `/define-conventions` generates (typically
      `<type>/<short-slug>`, e.g. `feat/user-auth`, `fix/login-redirect`).
      **CHECK:** current branch name matches the generated pattern (`echo "$BRANCH" | grep -E "^(feat|fix|docs|chore|refactor)/[a-z0-9-]+$"`).
- [ ] Branches are short-lived: merged or abandoned within the sprint they were opened.
      **CHECK:** `manual:` no branch outlives its sprint window without a recorded reason.
- [ ] The default branch is never force-pushed without explicit team agreement and an ADR note.
      **CHECK:** `git log -n 5 --format=%B` has no `force-push` to the default branch without a referencing ADR.

### Push and merge discipline
- [ ] Code is committed and pushed **only when the human explicitly requests it** — not
      proactively by the agent.
      **CHECK:** `git push --dry-run` is not run unless the human requested push; `grep -n gate-commits.mjs .cursor/hooks.json` documents the mechanical twin.
- [ ] When Cursor safety hooks are installed (`tools` includes `cursor`), commit/push also
      requires a one-shot receipt at `{paths.cache}/session/commit-approved.json` (`schema_version: 2`)
      written by the agent immediately after the human's explicit request; hooks consume it on allow.
      See [`cursor-safety-hooks.md`](./cursor-safety-hooks.md) — not restated here.
- [ ] PRs are opened against the default branch; the PR description references the sprint task
      and acceptance criteria from `{product}/sprints/NN-*.md`.
      **CHECK:** `manual:` the PR targets the default branch and links the sprint task; a PR with no sprint reference is a fail.
- [ ] Merge commits are squashed or rebased per the strategy set in `/define-conventions`; the
      choice is consistent across the team (one strategy per project).
      **CHECK:** `manual:` merged history matches the project's single chosen strategy (no mixed merge/squash).

## Amendment

- **2026-08-27** — Gentleman Ch.15 git hygiene: commit subjects/bodies do not name AI vendors as
  co-authors or generators.
