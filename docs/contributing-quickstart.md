# Contributor quickstart (engine)

One page — edit the source, then align.

| I want to change… | Edit | Then run |
|---|---|---|
| A skill | `harness/skills/<name>/SKILL.md` | `npm run build` → `npm test` |
| An agent | `harness/agents/midas-*.md` | `npm run build` |
| A rule / conventions | `harness/rules/*` or `harness/conventions.md` | `npm run align` |
| Installer | `create-midas/index.mjs` + `create-midas/lib/**` | `npm test` |
| Docs | `docs/*`, `INSTALL.md`, `SECURITY.md` | `mkdocs build --strict` (optional) |
| Version | never hand-edit pins | `npm run bump -- X.Y.Z` |

**Do not edit:** `.claude/`, `.agents/`, `.cursor/skills/`, `plugins/midas/`, `create-midas/template/`, adapter digests.

**Before commit (engine):** `npm run align` then `/midas-precommit` (overall ≥ 80).

Full map: [repository-architecture.md](./repository-architecture.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [precommit-gate.md](./precommit-gate.md).
