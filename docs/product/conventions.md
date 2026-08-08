# Product conventions — midas-harness engine

Overrides for the engine repository (not product installs).

- **Skill source of truth:** `harness/skills/` — run `npm run build` to refresh mirrors.
- **Before commit:** `npm run align` then `/midas-precommit` (overall ≥ 80).
- **Version bumps:** only via `npm run bump -- X.Y.Z`.
- **No parallel standards layer** — base law is `harness/conventions.md` + `harness/rules/`.

Folder structure for engine scripts: kebab-case under `scripts/`; installer modules under
`cli/lib/{cli,core,runtime,steps,workflow}/` (npm package name `create-midas`).
