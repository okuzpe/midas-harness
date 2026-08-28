# Sandbox — real skill dry-run lab (engine contributors only)

This folder is **not** a product, not a CI fixture, and not shipped to installs. It exists so a
contributor can dispatch `/midas-sandbox` and watch a **real, unmodified** skill from
`harness/skills/*` run end-to-end against a small nested example product, on a cheap Cursor model,
with a traced decision log — before that skill/rule change ships to real users.

See [`harness/skills/midas-sandbox/SKILL.md`](../harness/skills/midas-sandbox/SKILL.md) for the
procedure, and [`docs/adr/ADR-015-sandbox-skill-testing.md`](../docs/adr/ADR-015-sandbox-skill-testing.md)
for why this exists and what it deliberately does not do.

First command (creates the working copy from the seed):

```bash
node scripts/sandbox-run.mjs reset
node scripts/sandbox-run.mjs env
```

`env` must exit 0 before any skill run. Non-zero means isolation failed — stop; do not trust findings.

## Structure

```
sandbox/
  README.md                  # this file (subagent contract below)
  seed/                      # committed snapshot (product-root tree)
    .harness/state.yaml
    .harness/product/idea.md
  example-product/           # generated working copy (gitignored) — copy of seed/
  findings/
    README.md                # format + retention
    <date>-<mode>.md           # one per /midas-sandbox run (committed, curated)
```

## Subagent contract (isolation)

Cursor Task has no cwd pin. The parent (`/midas-sandbox`) must run `sandbox-run env` first. The
subagent's **first Read** must be:

`sandbox/example-product/.harness/state.yaml`

Then:

1. If `name` is not `sandbox-example` → **STOP** (`isolation-bug`). That file is not the fixture
   (you probably opened the engine repo's `harness/state.yaml`).
2. Treat `sandbox/example-product/` as the product root. Resolve `{product}/`, `{runs}/`,
   `paths.state` from **that** state file only.
3. Never write `harness/state.yaml`, `docs/product/`, or anything under `harness/skills/` /
   `harness/rules/` except reading skill bodies.
4. `paths.engine` / `paths.scripts` in the fixture point at this repo's real `harness/` and
   `scripts/` (`../../harness`, `../../scripts`). Real product installs must never do this.

## Cost rules (non-negotiable)

1. **Model pin:** every sandbox subagent runs on Cursor's `composer-2.5` — **never**
   `composer-2.5-fast`. This mirrors the "forbidden fast worker model" gap flagged in
   [`docs/muninn-comparison.md`](../docs/muninn-comparison.md) §7.
2. **Default to one skill.** `/midas-sandbox --all` requires an explicit `AskQuestion` cost
   confirmation. Precommit prefers `--smoke` (touched skill + next stage command).
3. **Reuse the fixture.** `example-product/` is reset from `seed/`, not recreated as a new tree.
4. Findings are always **proposals**. Nothing under `harness/skills/*` or `harness/rules/*` is
   edited by a sandbox run.

## Finding classes

Each issue in `sandbox/findings/*.md` must be one of:

| Class | Meaning | Next step |
|---|---|---|
| `harness-gap` | Skill text is ambiguous, contradictory, or the AskQuestion default is bad | Candidate for `/midas-capture` or a skill patch |
| `model-miss` | `composer-2.5` skipped a step that is written | Do not patch the harness |
| `fixture-limit` | Toy product / cheap model / stage mismatch cannot produce that signal | Do not extract a product rule |
| `isolation-bug` | Touched engine state or resolved the wrong `paths.state` | Lab failure, not a skill finding |

## Scope note

Sandbox runs validate **procedure fidelity** — steps, files, `**CHECK:**`s — not business or
architecture *judgment*. Phases 2–4 on `--all` are `fixture-limit` unless a procedure bug is
obvious. A stage mismatch (e.g. running `/close-sprint` while the fixture is still `idea_intake`)
is a precondition/STOP robustness check: `fixture-limit` unless the abort text is missing or
misleading (`harness-gap`).
