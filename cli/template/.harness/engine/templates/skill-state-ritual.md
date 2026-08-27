# Skill state ritual (shared — cite, do not restate)

Every Midas skill that touches lifecycle state follows this protocol. Skill bodies **cite this
file**; they do not restate stage enums, path substitution, or the read/write order.

## Invocation

- Run only when the user **explicitly** invokes the slash command (`disable-model-invocation`).
  Arrived by inference → **STOP**. See `AGENTS.md` § Safety.

## Paths & schema

1. Read **`paths.state`** first (`layout` + `paths`, or infer from disk if the file is missing).
2. Resolve `{runs}/`, `{product}/`, engine, and scripts via `AGENTS.md` § Path resolution.
3. Stage enum, `stage_status`, and field meanings live only in
   `<paths.engine>/state.schema.md` — **cite, never copy**.
4. Stage → next-command map (runtime): `<paths.engine>/stage-command-table.yaml` (same file
   `/midas-status` / `/midas-help` read). In the engine repo the YAML is generated from
   `STAGE_ROWS` in `scripts/stage-command-table.mjs` — do not hand-edit it.
   When `track: lite`, overlay Next per `<paths.engine>/pipeline/lite.md` (`resolveStatusNext` in
   that script): **never** `/market-research` or `/business-plan`; leftover `idea_intake` …
   `architecture_rules` → `/midas-init` or `/plan-sprints`.

## Read first, write last

1. Wrong **skill-specific** precondition (stage / sprint status) → report expected state + the
   single next command; **stop**.
2. Writers: **read-modify-write** only the fields this skill owns. Never blind-overwrite the file.
3. Do **not** self-advance `stage` or set `gate: passed` unless this skill’s Does table explicitly
   owns that advance (phase gates and `/close-sprint` do; most standing rituals do not).
4. Secrets never land in state — only `${ENV_VAR}` in MCP / env config.

## Tallies

Parseable `MIDAS_*_RESULT` lines:
`<paths.engine>/templates/audit-checklists.md` § Parseable tally lines.

**Phase / gate result contract** (status, summary, on-disk artifact paths, risks, next):
`<paths.engine>/templates/phase-result.md`. Gate and audit freezes that claim `verdict=pass` must
list existing artifact paths (or embed an equivalent Artifacts table) — do not advance on prose alone.

## Skill header (canonical cite)

Side-effecting skills open with:

```markdown
> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Precondition:** <skill-specific stage or sprint check only>.
```

Read-only routers (`/midas-status`, `/midas-help`, `/midas-recall`, `/midas-reconcile`) may omit the
write-last rules and keep a one-line paths cite instead.
