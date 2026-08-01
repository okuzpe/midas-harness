---
name: midas-qa
description: Ad-hoc branch/PR QA — map diff to routes/screens, drive with agent-browser (web) or Maestro MCP (native), report in chat; optional {runs}/qa/qa-adhoc-*.md. Use during Phase 7 inner loop; does not replace /midas-verify before /close-sprint.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
mcp-recommended: [maestro]
argument-hint: "[PR number | branch name | current] [--port PORT]"
---

# midas-qa — Ad-hoc branch QA

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).

Quick QA on **what changed** — not the formal sprint gate. **`/midas-verify`** remains required before **`/close-sprint`** for UI sprints.

## Does / Does not

| Does | Does not |
|---|---|
| Smoke-test routes/screens touched by the diff | Write tests to `{product}/` |
| Optional evidence in `{runs}/qa/qa-adhoc-*.md` | Emit `MIDAS_VERIFY_RESULT` (not gate-parsed) |
| Report pass/fail/skip + console errors in chat | Auto-fix failures or pass Phase 8 |

## Prerequisites

- Dev server running (or user starts after port detect)
- **Web:** [agent-browser](https://github.com/vercel-labs/agent-browser) CLI
- **Native** (diff touches `android/`, `ios/`, `app/`): Maestro MCP + emulator/simulator

Pre-check (cross-platform):

```bash
command -v agent-browser >/dev/null 2>&1 && echo ready || echo missing   # POSIX
Get-Command agent-browser -ErrorAction SilentlyContinue                  # PowerShell
where.exe agent-browser                                                  # cmd
```

Missing → report install instructions and stop (web QA cannot run).

## Procedure

### 1. Determine scope

- **PR:** `gh pr view <n> --json files -q '.files[].path'`
- **Current/empty:** `git diff --name-only main...HEAD`
- **Named branch:** `git diff --name-only main...<branch>`

### 2. Map files → routes/surfaces

| Pattern | Surface |
|---------|---------|
| `src/app/**`, `app/**` | URL paths |
| `src/pages/**` | Page routes |
| `src/components/**`, `components/**` | Pages importing them |
| `android/**`, `ios/**`, `app.json` | Native — Maestro `list_devices` + `launchApp` |
| Layout/global CSS | Homepage + one inner page minimum |

### 3. Port and server

Default port from `package.json` / `.env` / architecture (usually `3000`). If not listening, ask user to start (no auto-start without confirm). `agent-browser open http://localhost:<PORT>`.

### 4. Test each surface

Per route/screen:

```bash
agent-browser open "http://localhost:<PORT>/<route>"
agent-browser set device "iPhone 14"    # optional mobile spot-check
agent-browser snapshot -i
agent-browser screenshot qa-<route>.png
```

Interact with changed flows. Note console errors.

**Native:** Maestro `inspect_screen` → inline `run { yaml }` for changed flow only.

### 5. Optional record (non-gate)

If user wants on-disk evidence, write `{runs}/qa/qa-adhoc-<YYYY-MM-DD>-<slug>.md`:

```markdown
# Ad-hoc QA — <branch or PR> — <date>
Scope: <files or routes> · Tools: agent-browser | maestro-mcp

| Route / screen | Verdict | Notes | Screenshot |
```

**Do not** add `MIDAS_VERIFY_RESULT`.

### 6. Summary in chat

Pages tested, pass/fail/skip, console errors, screenshot paths. Failures are fix tasks — no auto-fix (producer/auditor separation).

## vs `/midas-verify`

| | `/midas-qa` | `/midas-verify` |
|---|---|---|
| When | Any time during sprint | Before `/close-sprint` |
| Scope | Git diff / PR | Sprint acceptance criteria |
| Record | Optional `{runs}/qa/` | Required `{runs}/verifications/verify-NN.md` |
| Gate | No | Feeds Phase 8 |

## Tier & cost

Build tier. Prefer agent-browser over browser MCPs. Respect `state.yaml.cost_profile`.
