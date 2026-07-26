# Deprecated templates (do not use for adapter rendering)

`cursor-rule.mdc.tmpl` and `windsurf-rule.md.tmpl` in this directory are **legacy copies** from an
older install flow. **Adapter rendering uses `harness/conventions.md` + `scripts/render-adapters.mjs`**
into the repo-root `CLAUDE.md`, `.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`, and
`GEMINI.md` — not these per-project `.tmpl` files.

They remain in the create-midas template tree for backward compatibility only. New work must edit
`harness/conventions.md` and run `/midas-doctor` or `npm run align`.

**Removal target:** post-1.0 once no installer references these paths (tracked in repo audit Phase A).
