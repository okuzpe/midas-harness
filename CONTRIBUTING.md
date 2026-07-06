# Contributing to Midas

Thank you for improving the harness. This document covers the mechanics: what to edit, how to
structure changes, and what the bar is for a contribution to land.

---

## Ground rules

- **English only.** All harness artifacts — skills, rules, docs, commit messages, PR descriptions —
  are English. This keeps the single-source adapters consistent across tools.
- **Markdown + dependency-free scripts only.** The harness ships as plain `.md` files and Node ESM
  scripts under `scripts/` (`test.mjs`, `doctor.mjs`, `render-adapters.mjs`, `mcp-drift.mjs`,
  `build-plugin.mjs`, `build-create.mjs`, `status-page.mjs`, `yaml-lite.mjs`). Do not add npm packages,
  lock files, or build steps. Scripts must run with `node <script>` and zero installs.
- **Supply-chain changes are explicit.** GitHub Actions use immutable SHA pins with the major tag
  kept in a comment; workflow permissions start at `contents: read`; CI-installed packages are
  exact-pinned. MCP defaults and exceptions are documented in `SECURITY.md`.
- **Edit the source; never hand-edit generated files.** `CLAUDE.md`, `.cursor/rules/00-midas.mdc`,
  `.windsurf/rules/00-midas.md`, `GEMINI.md`, `plugins/midas/**`, and `create-midas/template/**` are
  rendered from sources by `npm run render` and `npm run build`. Edit `.claude/`, `harness/`, or
  `harness/conventions.md`, then run `npm run verify`. PRs that touch generated trees directly will
  be asked to revert those edits.
- **One concern per PR.** Small, reviewable diffs merge faster.

---

## Repository layout (quick reference)

For the full source/generated-file map, install flow, and change-path guide, see
[`docs/repository-architecture.md`](./docs/repository-architecture.md).

### Three layers — edit layer 1 only

| Layer | Paths | Edit? |
|---|---|---|
| **1. Sources** | `.claude/skills/`, `.claude/agents/`, `harness/`, `scripts/`, `docs/`, root `AGENTS.md` | **Yes** |
| **2. Generated adapters** | `CLAUDE.md`, `.cursor/rules/`, `.windsurf/rules/`, `GEMINI.md` | No — run `npm run render` |
| **3. Distribution bundles** | `plugins/midas/`, `create-midas/template/`, `.claude-plugin/` | No — run `npm run build` |

The engine repo **commits** layers 2 and 3 so `npx` installs and the Claude plugin work offline. CI
rebuilds them and fails on drift — never hand-edit a generated copy.

```
harness/              ← conventions, rules, pipeline, templates, VERSION, state.schema
.claude/skills/       ← one dir per skill (Agent Skills standard)
.claude/agents/       ← midas-orchestrator, midas-builder, midas-scout
scripts/              ← render, doctor, test, build-* (dependency-free Node ESM)
docs/                 ← MkDocs source (build to _site/, never commit)
examples/taskpilot/   ← reference greenfield + CI gate fixture
create-midas/         ← installer (index.mjs hand-authored; template/ generated)
plugins/midas/        ← Claude Code plugin bundle (generated)
AGENTS.md             ← engine project law (distinct from install template AGENTS.md.tmpl)
.mcp.json             ← engine MCP default; `.cursor/mcp.json` is Cursor-local (Windows npx wrap)
```

### Contributor workflow (after any source change)

```bash
npm run align     # render adapters + test + build bundles + doctor — run before every PR
# or step by step:
npm test          # structural invariants
npm run render    # if harness/conventions.md or rules digest changed
npm run build     # sync plugins/midas + create-midas/template
npm run doctor    # adapter drift + health warnings
```

**Docs preview:** `mkdocs build --site-dir _site` (matches CI). Do not commit `site/` or `_site/`.

**Dual MCP configs:** root `.mcp.json` uses bare `npx`; `.cursor/mcp.json` wraps with `cmd /c` on
Windows. Edit `.mcp.json` as source; Cursor sync is handled by `scripts/mcp-cursor-sync.mjs`.

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
   > First read the state file at **`paths.state`**; if the precondition stage is wrong, report and stop.
   ```

4. Assign the correct `harness-tier`: `orchestrate` for think/audit/decide, `build` for
   implement/write, `scout` for search/extract/status.
5. Update `AGENTS.md` if the skill is user-facing (add it to the skills list or the phase table).
6. Run `npm run build` then `npm run doctor` (or `npm run verify`).

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

- [ ] Edited source files only (not `plugins/midas/`, `create-midas/template/`, or generated adapters).
- [ ] Ran `npm run align` (or `npm run verify`) — all green.
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
