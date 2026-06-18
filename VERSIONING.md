# Versioning

Midas's harness ENGINE follows [Semantic Versioning 2.0.0](https://semver.org/).

---

## What is the "engine"?

The engine is the **harness itself** — the skill contracts, phase taxonomy, adapter-generation
contract, state schema, and command namespace — not any product built with the harness.  
Products built with Midas maintain their own version numbers independently.

---

## Version scheme: `MAJOR.MINOR.PATCH`

### Pre-1.0 (current)

Pre-1.0 treats **MINOR as the breaking lever**:

| Increment | Meaning |
|---|---|
| `0.MINOR` bump | Breaking change to the engine contract (see below). Installs must migrate. |
| `0.x.PATCH` bump | Additive or wording-only change. Safe to absorb without migration. |

Once 1.0.0 is declared (stable public API), the standard SemVer semantics below apply.

### Post-1.0

| Increment | Meaning |
|---|---|
| `MAJOR` | Breaking change to the engine contract. |
| `MINOR` | Additive, backward-compatible change. |
| `PATCH` | Backward-compatible wording, typo, or clarification — no behavioral change. |

---

## What counts as a BREAKING change (MAJOR post-1.0 / MINOR pre-1.0)?

A change is breaking if an existing install would need a migration step to stay functional:

- **Renamed or removed skill / command** — e.g. `/start-sprint` renamed to `/sprint-start`; any
  invocation in docs, habits, or CI scripts breaks.
- **Phase taxonomy change** — adding, removing, reordering, or renaming a stage enum value in
  `harness/state.yaml`; existing state files reference the old names.
- **Adapter-generation contract change** — changes to the sections that `render-adapters.mjs` writes
  into `CLAUDE.md`, `.cursor/rules/`, or `.windsurf/rules/` that break the downstream tool's parsing.
- **State schema incompatibility** — removing or renaming a required field in `harness/state.yaml`;
  existing state files would fail validation.
- **Frontmatter contract change** — changing required SKILL.md or agent frontmatter keys such that
  existing skill files become invalid.
- **Convention rule removal or semantic inversion** — removing a named rule that existing `product/`
  artifacts reference, or inverting its meaning.

### What does NOT count as breaking?

- Adding a new optional SKILL.md frontmatter key with a documented default.
- Adding a new phase-N pipeline playbook file (`harness/pipeline/0N-*.md`) when the stage enum is
  unchanged and the new phase is opt-in.
- Wording improvements to methodology, conventions, or docs that do not change checkable behavior.
- New example files under `examples/`.
- New `harness/rules/*.md` files that are additive (existing audits pass without the new rule).

---

## Version stamp in `harness/state.yaml`

Every `harness/state.yaml` carries:

```yaml
midas_version: 0.5.6   # engine version that wrote or last migrated this file
```

`/midas-init` writes `midas_version` on first install.  
`/midas-doctor` checks whether `midas_version` matches the installed engine and warns if they diverge.

---

## Migration: `/midas-update`

When upgrading across a breaking version boundary:

1. Run `/midas-update` — it reads `midas_version` from `harness/state.yaml`, diffs it against the
   target version's migration notes, and proposes the minimal set of file edits required.
2. Review the diff. Confirm before any writes.
3. `/midas-update` bumps `midas_version` in `state.yaml` on success.

Migration notes for each breaking version live in `harness/migrations/vX.Y.md` (created when the
version is cut). For pre-1.0 minor bumps, migration notes live in the relevant `CHANGELOG.md` entry
under a `### Migration` subsection.

---

## Release checklist (maintainers)

1. Update `CHANGELOG.md` — move items from `[Unreleased]` to the new version section.
2. Bump `harness/VERSION` (the single canonical engine version). `package.json`,
   `create-midas/package.json`, and `gemini-extension.json` mirror it; `scripts/test.mjs` asserts they all match.
3. Tag: `git tag v0.X.Y && git push origin v0.X.Y`.
4. If breaking: add `harness/migrations/v0.X.md` before tagging.
5. Update the `[Unreleased]` diff link in `CHANGELOG.md`.
