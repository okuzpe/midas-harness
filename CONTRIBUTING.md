# Contributing to Midas

Thank you for improving the harness. This document covers the mechanics: what to edit, how to
structure changes, and what the bar is for a contribution to land.

---

## Ground rules

- **English only.** All harness artifacts — skills, rules, docs, commit messages, PR descriptions —
  are English. This keeps the single-source adapters consistent across tools.
- **Markdown + dependency-free scripts only.** The harness ships as plain `.md` files and two
  optional Node scripts (`render-adapters.mjs`, `doctor.mjs`). Do not add npm packages, lock files,
  or build steps. Scripts must run with `node <script>` and zero installs.
- **Supply-chain changes are explicit.** GitHub Actions use immutable SHA pins with the major tag
  kept in a comment; workflow permissions start at `contents: read`; CI-installed packages are
  exact-pinned. MCP defaults and exceptions are documented in `SECURITY.md`.
- **Edit the source; never hand-edit generated adapters.** `CLAUDE.md`, `.cursor/rules/00-midas.mdc`,
  and `.windsurf/rules/00-midas.md` are generated from `harness/conventions.md` + `AGENTS.md` by
  `scripts/render-adapters.mjs`. Edit the source file, then run `/midas-doctor` (or
  `node scripts/render-adapters.mjs`) to re-render. PRs that touch generated adapters directly
  will be asked to revert those edits.
- **One concern per PR.** Small, reviewable diffs merge faster.

---

## Repository layout (quick reference)

For the full source/generated-file map, install flow, and change-path guide, see
[`docs/repository-architecture.md`](./docs/repository-architecture.md).

```
harness/           ← source of truth for conventions, rules, pipeline playbooks, state schema
.claude/skills/    ← skill definitions (Agent Skills standard); one dir per skill
.claude/agents/    ← agent definitions
scripts/           ← render-adapters.mjs, doctor.mjs (no external deps)
docs/              ← reference docs (agents-and-models.md is the single model-ID bump point)
examples/          ← worked examples (taskpilot is the reference greenfield)
AGENTS.md          ← project law for all AI agents; source for generated adapters
CLAUDE.md          ← generated; do not hand-edit
.mcp.json          ← MCP wiring (secret-free; see SECURITY.md)
```

---

## Adding a new skill

1. Create `.claude/skills/<kebab-name>/SKILL.md`.
2. Use the standard frontmatter (all fields listed in `AGENTS.md` under the SKILL.md contract).
   Required: `name`, `description`, `user-invocable`, `disable-model-invocation`, `model`,
   `harness-tier`, `recommended-model`.
3. If the skill is side-effecting (writes files, advances state), set
   `disable-model-invocation: true` and include the ritual guard verbatim at the top of the body:

   ```
   > **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
   > First read `harness/state.yaml`; if the precondition stage is wrong, report and stop.
   ```

4. Assign the correct `harness-tier`: `orchestrate` for think/audit/decide, `build` for
   implement/write, `scout` for search/extract/status.
5. Update `AGENTS.md` if the skill is user-facing (add it to the skills list or the phase table).
6. Run `node scripts/doctor.mjs` to verify no adapter drift is introduced.

---

## Adding a new rule

1. Create `harness/rules/<topic>.md`. Name it for what it governs, not for a tool.
2. Every rule must be **checkable**: the Phase-8 audit must be able to emit pass/fail with
   on-disk evidence. If a rule cannot be checked, document explicitly what "pass" looks like.
3. If the rule belongs in the always-on base conventions, add it to `harness/conventions.md`
   instead and re-render adapters.
4. Reference the rule from the relevant phase playbook in `harness/pipeline/`.

---

## Modifying the state schema

Changes to `harness/state.schema.md` that rename or remove fields are breaking (see `VERSIONING.md`).
If your change is breaking:

- Add a `harness/migrations/v0.X.md` migration note.
- Bump `harness/VERSION` (the canonical engine version); `package.json`, `create-midas/package.json`,
  and `gemini-extension.json` mirror it, and `scripts/test.mjs` asserts they match.
- Document the migration in the `CHANGELOG.md` entry under a `### Migration` subsection.

---

## Commit style: Conventional Commits

```
<type>(<scope>): <short summary in English, imperative, no period>

[optional body]

Signed-off-by: Your Name <your@email.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.  
Scope: optional, use the affected path segment (`skills/midas-init`, `harness/rules`, `scripts`, etc.).

Examples:
```
feat(skills/start-sprint): add guard for gate: pending stage
fix(render-adapters): preserve trailing newline in generated CLAUDE.md
docs(contributing): clarify skill ritual guard requirement
chore: bump midas_version to 0.2.0
```

---

## DCO sign-off

Midas uses the [Developer Certificate of Origin](https://developercertificate.org/) in place of a
CLA. Add a sign-off to every commit:

```
git commit -s -m "feat: ..."
```

This appends `Signed-off-by: Your Name <your@email.com>`. By signing off you certify that you have
the right to submit the contribution under the Apache-2.0 license.

---

## Pull request checklist

Before opening a PR, confirm:

- [ ] Edited source files only (not generated adapters).
- [ ] `node scripts/doctor.mjs` exits clean (no adapter drift).
- [ ] Any new skill includes the ritual guard if side-effecting.
- [ ] Any new rule is checkable; evidence format is documented.
- [ ] Breaking change? Migration note added; `CHANGELOG.md` updated.
- [ ] Commits follow Conventional Commits and carry `Signed-off-by`.
- [ ] No external dependencies introduced.
- [ ] Workflow changes keep action SHAs pinned, permissions least-privilege, and CI installs
      exact-pinned.
- [ ] MCP changes preserve secret-free config and document any unmanaged-server exception.
- [ ] English throughout.

---

## Reporting bugs

Open a GitHub issue. Include:
- Midas version (`midas_version` from `harness/state.yaml`).
- Tool (Claude Code / Cursor / Copilot / etc.) and version.
- The skill or command that misbehaved.
- Expected behavior vs. actual behavior.
- Relevant excerpt from `harness/state.yaml` (redact project-specific details).

For security issues, follow [`SECURITY.md`](./SECURITY.md) — do not file a public issue.
