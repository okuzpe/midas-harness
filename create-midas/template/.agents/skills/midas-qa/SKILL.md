---
name: midas-qa
description: "Lightweight ad-hoc QA on the current branch or PR — map changed files to routes/screens, drive with agent-browser (web) or Maestro MCP (native), report in chat and optionally freeze a non-gate record to {runs}/qa/qa-adhoc-*.md. Inner-loop during Phase 7; does not replace /midas-verify before /close-sprint."
metadata:
  midas-argument-hint: "[PR number | branch name | current] [--port PORT]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-mcp-recommended: "[maestro]"
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
---
# midas-qa — Ad-hoc branch QA (agent-browser / Maestro)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.

Quick QA on **what changed** in the current branch — not the formal sprint gate. Use during Phase 7
inner loop; **`/midas-verify`** remains required before **`/close-sprint`** for UI sprints.

**Does not write tests** to `{product}/`. Optional evidence: `{runs}/qa/qa-adhoc-<slug>.md` — **no**
`MIDAS_VERIFY_RESULT` line (doctor does not gate-parse this folder).

## Prerequisites

- Dev server running (or start it after detecting port — see below)
- **Web:** [agent-browser](https://github.com/vercel-labs/agent-browser) CLI installed
- **Native** (if diff touches `android/`, `ios/`, `app/`): Maestro MCP wired and emulator/simulator up

### Pre-check agent-browser (cross-platform)

```bash
# POSIX
command -v agent-browser >/dev/null 2>&1 && echo ready || echo missing

# Windows PowerShell
Get-Command agent-browser -ErrorAction SilentlyContinue

# Windows cmd
where.exe agent-browser
```

If missing, report install instructions and stop (web QA cannot run).

## Procedure

### 1. Determine scope

**PR number:** `gh pr view <n> --json files -q '.files[].path'`

**Current branch / empty arg:** `git diff --name-only main...HEAD` (or default branch)

**Named branch:** `git diff --name-only main...<branch>`

### 2. Map files to routes / surfaces

| Pattern | Route / surface |
|---------|-----------------|
| `src/app/**`, `app/**` (Next.js) | Corresponding URL paths |
| `src/pages/**` | Page routes |
| `src/components/**`, `components/**` | Pages importing those components |
| `android/**`, `ios/**`, `app.json` | Native — use Maestro `list_devices` + `launchApp` |
| Layout / global CSS | Homepage + one inner page minimum |

Build the URL list (web) or app id (native).

### 3. Port and server

1. From `package.json` scripts, `.env`, or architecture — default port `3000`
2. If server not listening, ask user to start it (do not auto-start unless user confirms)
3. `agent-browser open http://localhost:<PORT>`

### 4. Test each affected surface

Per route/screen:

```bash
agent-browser open "http://localhost:<PORT>/<route>"
agent-browser set device "iPhone 14"    # optional mobile spot-check
agent-browser snapshot -i
agent-browser screenshot qa-<route>.png
```

Interact with changed flows (click, fill). Note console errors if visible.

**Native (Maestro MCP):** `inspect_screen` → inline `run { yaml }` for the changed flow only.

### 5. Optional record (non-gate)

If the user wants on-disk evidence, write `{runs}/qa/qa-adhoc-<YYYY-MM-DD>-<slug>.md`:

```markdown
# Ad-hoc QA — <branch or PR> — <date>
Scope: <files or routes>
Tools: agent-browser | maestro-mcp

| Route / screen | Verdict | Notes | Screenshot |
|----------------|---------|-------|------------|
```

**Do not** add `MIDAS_VERIFY_RESULT`.

### 6. Summary in chat

Report: pages tested, pass/fail/skip, console errors, screenshots paths. Failures are **fix tasks** —
this skill does not auto-fix (producer/auditor separation).

## vs `/midas-verify`

| | `/midas-qa` | `/midas-verify` |
|---|---|---|
| When | Any time during sprint | Before `/close-sprint` |
| Scope | Git diff / PR | Full sprint acceptance criteria |
| Record | Optional `{runs}/qa/` | Required `{runs}/verifications/verify-NN.md` |
| Gate | No | Feeds Phase 8 audit |

## Tier & cost
Build tier. Prefer agent-browser over browser MCPs. Respect `state.yaml.cost_profile`.
