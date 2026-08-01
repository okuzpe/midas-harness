---
name: midas-align
description: Propagation alignment pass — maps what changed to downstream surfaces (adapters, bundles, version stamps, docs, tests), runs the cheapest verify ladder, and reports gaps before merge or sprint close. Use after editing skills, rules, conventions, installer, VERSION, or any generated tree source. Complements /midas-doctor (adapters only) with full repo/product sync per <paths.engine>/rules/change-propagation.md.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
argument-hint: "[--scope engine|product|auto] [--fix]"
---

# midas-align — keep sources, bundles, docs, and versions aligned

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> Full matrix: `<paths.engine>/rules/change-propagation.md`. Tally: `<paths.engine>/templates/audit-checklists.md`.

Runs the **propagation alignment pass** so a change does not leave generated adapters, distribution
bundles, version stamps, or user-facing docs behind. `/midas-doctor` covers adapter drift and install
health; **`/midas-align`** adds the full matrix from `change-propagation.md` and a single gap report.

## Detect context

Resolve `--scope` (default `auto`):

| Signal | Scope |
|---|---|
| `scripts/test.mjs` exists at repo root and mentions `midas test` | **engine** (midas-harness contributor tree) |
| Otherwise | **product** (installed Midas project) |

## Procedure

### 1. Inventory what changed
Read `git diff --name-only` (or the paths the user names). Map each file to row(s) in
`<paths.engine>/rules/change-propagation.md` § Propagation matrix. List **required downstream actions**
before running anything.

### 2. Run the alignment ladder

**Engine repo** (midas-harness):

```bash
npm run align
# equivalent: node scripts/render-adapters.mjs && npm run verify
```

`verify` = `test.mjs` → `build-plugin.mjs` → `build-create.mjs` → `doctor.mjs`.

If `--fix` and adapters drifted: `node scripts/render-adapters.mjs` then re-run `npm run verify`.

**Product install:**

1. If `<paths.engine>/conventions.md` or `<paths.engine>/rules/*` changed →
   `node <paths.scripts>/render-adapters.mjs` or `/midas-doctor --fix`
2. Always → `node <paths.scripts>/doctor.mjs`
3. If product code changed → project test command (from architecture / `AGENTS.md`)
4. If `harness/VERSION` or `midas_version` semantics changed → `/midas-update` (not in-place hand edits)

### 3. Version cascade (when `harness/VERSION` or release is in scope)
Engine repo: **must** run **`npm run bump -- <X.Y.Z>`** (`change-propagation.md` — never hand-scatter
pins). That writes VERSION, packages, state stamps, `INSTALL.md` pins, and rebuilds. Then confirm:

- `package.json`, `create-midas/package.json`, `gemini-extension.json` match `harness/VERSION`
- `INSTALL.md` is the only `#v…` copy-paste surface (skills/docs use `#v{VERSION}` or runtime reads)
- `CHANGELOG.md` has a dated section for the release (not `[Unreleased]` only)
- `harness/state.schema.md` example `midas_version` matches

`node scripts/test.mjs` `version:*` / `version-pin:*` checks are authoritative on the engine repo.
Product installs: `/midas-update` (not in-place hand edits of engine VERSION).

### 4. Docs and flow sanity (manual, quick)
When the diff touches skills, installer, layout, or pipeline:

- [ ] `INSTALL.md` / `docs/getting-started.md` / `docs/skills.md` mention new commands or flags
- [ ] `docs/repository-architecture.md` change-path table still accurate
- [ ] No ritual guard in `harness/skills/` still hardcodes a legacy state path

### 5. Gap report (required output)

```markdown
# midas-align — <YYYY-MM-DD> — scope: <engine|product>

## Changed (source)
- <path> → matrix row(s): …

## Ladder run
- <command> → <exit 0 | fail + summary>

## Verdict
MIDAS_ALIGN_RESULT: gaps=N verdict=aligned|gaps

## Gaps (if any)
| ID | Surface | Issue | Fix |
|----|---------|-------|-----|
```

`verdict=aligned` only when the ladder is green **and** no matrix row is left unaddressed.
Do **not** advance `stage` or mark gates passed — this is maintenance only.

## Exit gate
- [ ] Propagation matrix rows identified for every changed source path.
- [ ] Alignment ladder run to completion (engine: `npm run align`; product: doctor + tests as applicable).
- [ ] Version mirrors verified when `VERSION` / release is in scope.
- [ ] `MIDAS_ALIGN_RESULT` line printed with honest `gaps` count.
- [ ] User told the single next action if `verdict=gaps` (fix list, not vague "check things").

## Tier & cost
Diff inventory + matrix mapping → **scout** (Haiku). Running scripts + interpreting failures →
**build** (Sonnet). Release/version judgment → **orchestrate** (Opus) only when the user is cutting a
version boundary and asks for migration notes.
