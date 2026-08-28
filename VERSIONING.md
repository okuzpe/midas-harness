# Versioning

Midas's harness ENGINE follows [Semantic Versioning 2.0.0](https://semver.org/).

---

## What is the "engine"?

The engine is the **harness itself** — the skill contracts, phase taxonomy, adapter-generation
contract, state schema, and command namespace — not any product built with the harness.
Products built with Midas maintain their own version numbers independently.

---

## Version scheme: `MAJOR.MINOR.PATCH`

**Current line: 2.x** (stable public engine contract since `2.0.0`). Standard SemVer applies:

| Increment | Meaning |
|---|---|
| `MAJOR` | Breaking change to the engine contract (see below). Installs need migration. |
| `MINOR` | Additive, backward-compatible change. |
| `PATCH` | Backward-compatible wording, typo, or clarification — no behavioral change. |

### Pre-1.0 (historical)

Before `1.0.0`, **MINOR** was the breaking lever (`0.MINOR` = break, `0.x.PATCH` = safe). That
policy ended at 1.0. Do not use it for new releases.

### 1.x (historical)

`1.0.0` froze the hub-default install (ADR-006). `2.0.0` replaced that with the canonical
`.harness/` layout (ADR-007). Classic / compact / hub remain **read/migrate-only** inputs.

---

## What counts as a BREAKING change (MAJOR)?

A change is breaking if an existing install would need a migration step to stay functional:

- **Renamed or removed skill / command** — e.g. `/start-sprint` renamed to `/sprint-start`.
- **Phase taxonomy change** — adding, removing, reordering, or renaming a stage enum value in
  `paths.state`; existing state files reference the old names.
- **Adapter-generation contract change** — changes to the sections that `render-adapters.mjs` writes
  into managed adapters that break the downstream tool's parsing.
- **State schema incompatibility** — removing or renaming a required field in `paths.state`.
- **Frontmatter contract change** — changing required SKILL.md or agent frontmatter keys such that
  existing skill files become invalid.
- **Convention rule removal or semantic inversion** — removing a named rule that existing product
  artifacts reference, or inverting its meaning.
- **Writable install layout change** — replacing `.harness/` as the only writable layout (ADR-007).

### What does NOT count as breaking?

- Adding a new optional SKILL.md frontmatter key with a documented default.
- Adding a new phase-N pipeline playbook file when the stage enum is unchanged and the phase is opt-in.
- Wording improvements to methodology, conventions, or docs that do not change checkable behavior.
- New fixture files under `scripts/fixtures/` when adding CI gate or bundle coverage.
- New `harness/rules/*.md` files that are additive (existing audits pass without the new rule).
- Thin-root host-mirror pruning / default `--tools=cursor` (ADR-008) when existing multi-tool
  installs keep their `state.tools` until `--update --tools=…`.

---

## Version stamp in `paths.state`

Every install state file carries:

```yaml
midas_version: 2.0.0   # engine version that wrote or last migrated this file
```

`/midas-init` writes `midas_version` on first install.
`/midas-doctor` checks whether `midas_version` matches the installed engine and warns if they diverge.

---

## Migration: CLI `--update` and `--migrate`

- **Already on v2 (`.harness/`)** — `npx github:okuzpe/midas-harness#v{VERSION} update`
  (pin from `harness/VERSION`; optional `--tools=…` to prune hosts) **or** `/midas-init` when
  diagnose reports `version_behind` / `legacy_layout` (tips the same CLI — pick one, not both).
  Deprecated `/midas-update` forwards to `/midas-init`. CLI update is complete when it prints
  `verify: ok`.
- **Still on v1 classic/compact/hub** — `npx … --migrate` (preview) then `--migrate --apply`.
  `--update` never relocates a v1 tree (ADR-007).

Migration notes for breaking versions live in `harness/migrations/<slug>.md` when cut (see index in
`harness/migrations/README.md`).

---

## Surfaces frozen at 2.0

| Surface | Freeze criterion |
|---------|------------------|
| Writable install layout | `layout: harness` only (`.harness/`); classic/compact/hub = migrate inputs |
| Thin-root allowlist | ADR-008 — host discovery at root; engine under `.harness/` |
| Ownership roles | `vendor` / `generated` / `user` in `.harness/manifest.json` |
| `paths.state` schema | Required keys + stage enum stable; additive optional fields only in MINOR |
| Skill / command names | No renames without migration + MAJOR |
| Product / runs paths | Resolved via `paths.*` / `{product}/` / `{runs}/` tokens |
| Adapter managed regions | `<!-- midas:begin/end -->` contract unchanged |
| `MIDAS_*_RESULT` tally lines | Parseable gate format stable for `doctor.mjs` |

---

## 1.0.0 — shipped 2026-07-06 (historical)

Hub layout was the default install under `.midas/` (ADR-006). Superseded for **new** installs by
ADR-007 / `2.0.0`. Kept here for archaeology of 1.x installs.

---

## Engine repository layout (contributors)

The **midas-harness** repo is not a product install. Authoring lives in `harness/` + `scripts/`;
the installer package folder is `cli/` (npm name remains `create-midas`). Contributor Trace cache
is at `runs/cache/` (`paths.cache`). Product lifecycle evidence lives in installs under
`.harness/runs/` (ADR-007). Renaming `cli/` or moving path overrides in `harness/state.yaml` is
contributor-breaking for clones and CI — not a product
SemVer break unless installer behavior or install layout changes.

---

## Release checklist (maintainers)

> **Rule (engine repo):** publishing or bumping the engine version **must** use
> `npm run bump -- <X.Y.Z>`. Hand-editing version strings across packages / INSTALL / skills is a
> fail under `harness/rules/change-propagation.md`.

1. Update `CHANGELOG.md` — move items from `[Unreleased]` to the new version section (can draft first).
2. Run **`npm run bump -- <X.Y.Z>`** — writes **`harness/VERSION`** (sole source), runs
   `scripts/sync-version.mjs` to propagate mirrors, then `npm run build`.
3. Finish the CHANGELOG section + compare link row for the new version if not already done.
4. `npm test`, then `git tag vX.Y.Z && git push origin main vX.Y.Z`.
5. If breaking: add `harness/migrations/vX.Y.md` before tagging.

**Do not** hand-edit `#v…` pins in skills, SECURITY, FAQ, or installer help — those use `#v{VERSION}`
placeholders or read the bundled `VERSION` at runtime. `INSTALL.md` pins are **generated** by
`npm run sync-version` from `harness/VERSION`. `install.sh` / `install.ps1` read `harness/VERSION`
at runtime (local clone or `main` on GitHub).
