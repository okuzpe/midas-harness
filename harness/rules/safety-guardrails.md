# Rule: Safety guardrails (always-on)

Midas-native **careful / freeze / guard** (inspired by gstack). Behavioral floor for every
agent session — host hooks may harden further but are **not** required for Phase-8. Complements
[`security.md`](./security.md) (secrets, injection) and [`git-commits.md`](./git-commits.md)
(no agent-initiated force-push).

> **Every item carries a `**CHECK:**`**. Modes are session policies the agent must honour when
> active; careful applies to irreversible ops even without an explicit mode name.

## Modes

### Careful — pause before irreversible ops
Before running any of the following (or close equivalents), **stop and get explicit human OK**
for that exact command in this turn — unless the human already typed/approved it:

- Destructive filesystem: `rm -rf`, `Remove-Item -Recurse -Force` on non-tmp paths
- Destructive data: `DROP TABLE` / `TRUNCATE`, production DB migrations that delete data
- Destructive git: `git push --force`, `git reset --hard`, `git clean -fd`, branch delete on
  shared remotes
- Prod blast radius: unscoped `kubectl delete`, terraform/cloud destroy, mass revoke

Safe exceptions: deleting paths the human named this turn; tmp/fixture cleanup the test already
owns; soft resets the human requested.

### Freeze — edit boundary
When the human asks to freeze/lock edits to a path, or `{paths.cache}/session/freeze-dir.txt` exists
(one absolute or repo-relative directory, trailing slash optional):

- Create/edit/delete **only** under that root
- Refuse writes outside it and name the boundary
- Lift only on explicit **unfreeze** / clearing the freeze file / end of session

### Guard — careful + freeze
When the human asks for guard / full safety / lock it down: enable **both** careful and freeze
(ask for the freeze root if missing). Use for prod-adjacent work and high-stakes debugging.

## Checklist

- [ ] Irreversible commands are not run silently.
      **CHECK:** `manual:` the sprint/session evidence shows no unauthorized force-push, hard reset,
      recursive delete of non-tmp project paths, or production destroy; if such a command ran, the
      human's explicit OK for that command is recorded in the session or PR notes — otherwise fail.
- [ ] An active freeze boundary is respected.
      **CHECK:** `manual:` when `{paths.cache}/session/freeze-dir.txt` exists (or the human named a freeze
      root still in force), every path in the working-tree diff for that session lies under that
      root; any write outside is a fail.
- [ ] Guard requests activate both protections.
      **CHECK:** `manual:` when the human asked for guard/full-safety mode, the session both (a)
      paused on careful-class commands and (b) had a named freeze root before further edits —
      missing either is a fail.
- [ ] This rule is present and checkable.
      **CHECK:** `harness/rules/safety-guardrails.md` (or `<paths.engine>/rules/safety-guardrails.md`)
      contains at least one `**CHECK:**` and a dated `## Amendment` section.

## Amendment

- **2026-08-10** — Freeze file path moved to `{paths.cache}/session/freeze-dir.txt` (ADR-012
  ephemeral session artifacts under cache; do not reintroduce `{runs}/session/` as SoT).
- **2026-08-07** — Adopted gstack careful/freeze/guard as always-on behavioral rule (no mandatory
  host hooks). Optional freeze-dir file records the freeze root for audit.
