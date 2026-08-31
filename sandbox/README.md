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
# capture-only idea-intake (blank template, not the filled Chorechip seed):
node scripts/sandbox-run.mjs reset --profile capture
# nested vendor install (reconcile/update — not pipeline oracles):
node scripts/sandbox-run.mjs reset --profile install
node scripts/sandbox-run.mjs env --profile install
```

Every `/midas-sandbox` invocation **always resets first** (dirty working copies are not reused),
then `env` must exit 0. Non-zero after a fresh reset means the seed is broken — stop; do not
trust findings. Copy the `MIDAS_TRACE_ROOT:` line into the Task: every `trace-write` subprocess
needs that env. `start-run` binds it only for its own process. `reset` / `env` / `start-run` also
write `{work}/.harness/cache/sandbox-env.json` so the Task can Read the value (Cursor Task does
not inherit env).

After the Task, grade the **disk** (composer does not self-score). Grade **immediately after
each skill**, before the next one — not once at the end of `--smoke` / `--all`:

```bash
node scripts/sandbox-run.mjs grade --skill idea-intake --ledger
```

`finish` after the last grade must exit 0. `no-active-run` is an isolation fail (exit 1),
not a quiet JSON line. The runner writes `sandbox/findings/_active-run.json` on `start-run`
so a missing `current.json` still names the last session.

After `reset`, that command **must fail** (`stage` still `idea_intake`, no phase artifacts).
A pass without a Task means the oracle is grading the seed, not the skill.
`reset --profile capture` also leaves `<!-- TODO:` markers in `{product}/idea.md`, so `pitch-not-todo`
fails until `/idea-intake` actually captures. Default `reset` keeps the filled Chorechip idea
(gate-advance lab). `--skill /idea-intake` is the same JSON. `--smoke` / `--all` next skills without an oracle
YAML: `--missing skip` (broken JSON is still a fail).

Do not run `doctor --fix` or edit `harness/skills/` / `harness/rules/` between `reset` and
the last `grade` — isolation hashes those trees.

Oracles live in [`oracles/`](./oracles/). `MIDAS_SANDBOX_ORACLE: verdict=fail` forces the sandbox
verdict to fail.

## Structure

```
sandbox/
  README.md                  # this file (subagent contract below)
  seed/                      # committed snapshot (product-root tree)
    .harness/state.yaml
    .harness/product/idea.md
  oracles/                   # deterministic disk checks (grade)
  example-product/           # generated pipeline working copy (gitignored) — copy of seed/
  example-install/           # generated nested install (gitignored) — `reset --profile install`
  findings/
    README.md                # format + retention
    <date>-<mode>.md           # one per /midas-sandbox run (committed, curated)
```

## Subagent contract (isolation)

Cursor Task has no cwd pin. The parent (`/midas-sandbox`) must `reset` then `env` first. The
subagent's **first Read** must be:

`sandbox/example-product/.harness/state.yaml`

Then:

1. If `name` is not `sandbox-example` → **STOP** (`isolation-bug`). That file is not the fixture
   (you probably opened the engine repo's `harness/state.yaml`).
2. Treat `sandbox/example-product/` as the product root. Resolve `{product}/`, `{runs}/`,
   `paths.state` from **that** state file only. `sandbox-run env` fails if those paths resolve
   outside the working copy.
3. Never write `harness/state.yaml`, `docs/product/`, or anything under `harness/skills/` /
   `harness/rules/` except reading skill bodies.
4. `paths.engine` / `paths.scripts` in the fixture point at this repo's real `harness/` and
   `scripts/` (`../../harness`, `../../scripts`). Real product installs must never do this.
5. Execute the target skill **in this Task**. Do not spawn a nested Task or `midas-builder` on
   another model. Pass `MIDAS_TRACE_ROOT` from `env` into every `trace-write` subprocess.
   If the host did not inherit that env, Read `{work}/.harness/cache/sandbox-env.json`.

## Cost rules (non-negotiable)

1. **Model pin:** every sandbox subagent runs on Cursor's `composer-2.5` — **never**
   `composer-2.5-fast`. This mirrors the "forbidden fast worker model" gap flagged in
   [`docs/muninn-comparison.md`](../docs/muninn-comparison.md) §7.
2. **Default to one skill.** `/midas-sandbox --all` requires an explicit `AskQuestion` cost
   confirmation. Precommit prefers `--smoke` (touched skill + next stage command).
3. **Reset every invocation.** `example-product/` is wiped from `seed/` at the start of default,
   `--smoke`, and `--all` (then `--all` reuses that one copy for the batch).
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
