# Verification verify-NN — sprint NN — scope: <ui|api|all>
Ran: <YYYY-MM-DD> · Tier: build (claude-sonnet-4-6) · Tools: <playwright-mcp | chrome-devtools-mcp | @playwright/cli | test-runner>
App under test: <url / preview command>

## Verdict tally
PASS: n  ·  FAIL: n (CRIT a · HIGH b · MED c · LOW d)  ·  BLOCKED: n
MIDAS_VERIFY_RESULT: fails=X criticals=Y runtime_errors=Z   # gate-parseable line (runtime_errors roll into fails/criticals)

## Per-criterion results
| # | Acceptance criterion | Tool | Selector(s) | Expected | Actual | Verdict | Evidence (screenshot) |
|---|----------------------|------|-------------|----------|--------|---------|-----------------------|

## Runtime health (Chrome DevTools)
| Screen | Console errors | Failed requests | CWV (LCP/CLS/INP) | Verdict |
|--------|----------------|-----------------|-------------------|---------|
- Uncaught console errors and failed happy-path requests are CRIT/HIGH fails; perf notes are advisory unless a budget exists.

## Design-token findings
| Screen | Property | Token expected | Computed value | Verdict |
|--------|----------|----------------|----------------|---------|
- Hardcoded-value violations, AA-contrast spot checks, focus-ring + dark-mode notes.

## Failures → /close-sprint (drift)
- <criterion> (<severity>): <what failed> → fix-task for the next sprint
