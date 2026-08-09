# Rule: Cursor safety hooks (always-on when installed)

Mechanical **fail-closed** guardrails for Cursor installs — separate from Harness **Trace**
(observe-only, fail-open per [ADR-010](../../docs/adr/ADR-010-harness-trace-observe.md)). When
`tools` includes `cursor`, the installer merges safety hook entries into `.cursor/hooks.json`
via `cli/lib/steps/safety-hooks.mjs` (marker `safety/`); Trace entries are merged independently
per [ADR-011](../../docs/adr/ADR-011-harness-trace-installs.md) and [ADR-012](../../docs/adr/ADR-012-muninn-adaptations.md).

> **Trace ≠ enforcement.** Agents must **not** treat Trace hooks (`scripts/trace-hook.mjs`) as
> deny/allow gates. Trace always exits 0 and records spans only. Safety hooks may block shell
> commands or prompt submission when configured rules fire.

## Wiring (Cursor + `tools` includes `cursor`)

| Hook event | Script | Role |
|---|---|---|
| `beforeSubmitPrompt` | `secrets-prompt.mjs` | Block prompts matching secret/credential patterns |
| `beforeShellExecution` | `gate-commits.mjs` | Require one-shot commit/push receipt (see below) |
| `beforeShellExecution` | `destructive-shell.mjs` | Deny destructive shell patterns (force-push, `rm -rf`, …) |

Safety entries use `failClosed: true` and invoke `.harness/scripts/safety/*.mjs` on installs
(engine contributors: `scripts/safety/*.mjs`). Uninstall/update strips only Midas-marked safety
entries — same family isolation as Trace.

**Hook output contracts (Cursor):** `beforeSubmitPrompt` → stdout `{"continue": true}` or
`{"continue": false, "user_message": "…"}` — **not** `permission` (that shape is for
`beforeShellExecution` only). `secrets-prompt.mjs` implements the prompt contract.

## Commit/push receipt (one-shot)

When safety hooks are installed, `gate-commits.mjs` allows `git commit` / `git push` (and close
equivalents) only when a fresh receipt exists at **`{paths.cache}/session/commit-approved.json`**
(gitignored; engine repo: `runs/cache/session/commit-approved.json`).

- **`schema_version`:** `2` (v1 and empty markers are rejected).
- **Who writes:** the agent **only after** the human explicitly requests commit or push in the
  session — never prophylactically. CLI:
  `node <paths.scripts>/commit-receipt.mjs write --operation commit`
  (install: `node .harness/scripts/commit-receipt.mjs write --operation commit`).
- **Consume:** hooks read the receipt once on allow, then delete or invalidate it; a later
  commit needs a new receipt bound to the current diff fingerprint.

Declarative floor remains [`git-commits.md`](./git-commits.md) (no agent-initiated push); this
receipt is the mechanical twin when Cursor safety hooks are present.

## Checklist

- [ ] Trace and safety hook families are not conflated.
      **CHECK:** `manual:` when `.cursor/hooks.json` lists both Trace and safety commands, agents
      and docs treat Trace as observe-only (exit 0) and safety as optional fail-closed enforcement;
      citing Trace spans as proof that a destructive command was blocked is a fail.
- [ ] Commit/push runs only with explicit human request and a valid receipt when hooks are installed.
      **CHECK:** `manual:` if `gate-commits.mjs` is wired, session evidence shows the human asked
      to commit/push before the command ran and `{paths.cache}/session/commit-approved.json`
      was written with `schema_version: 2` immediately prior; reuse across unrelated diffs is a fail.
- [ ] This rule is present and checkable.
      **CHECK:** `harness/rules/cursor-safety-hooks.md` (or `<paths.engine>/rules/cursor-safety-hooks.md`)
      contains at least one `**CHECK:**` and a dated `## Amendment` section.

## Amendment

- **2026-08-10** — Document `beforeSubmitPrompt` stdout uses `continue` (not `permission`); fixes
  fail-closed "no output" when Cursor rejects shell-shaped JSON from `secrets-prompt.mjs`.
- **2026-08-09** — P0 docs: Trace observe ≠ Cursor safety deny; receipt path
  `{paths.cache}/session/commit-approved.json` schema v2; hook events and one-shot consume contract
  per ADR-012.
- **2026-08-09** — Document agent CLI: `commit-receipt.mjs write --operation commit` after human
  asks to commit/push (installs: `.harness/scripts/commit-receipt.mjs`).
