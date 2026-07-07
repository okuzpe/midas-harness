# Verification verify-NN — sprint NN — scope: <web|mobile|api|all>
Ran: <YYYY-MM-DD> · Tier: build (claude-sonnet-4-6) · Tools: <agent-browser | agent-browser-ios | playwright-mcp | chrome-devtools-mcp | maestro-mcp | @playwright/cli | test-runner>
App under test: <url / preview command / bundle id>

> One record per sprint (`verify-NN.md` only). Web, device profiles, and native mobile sections live here.
> Ad-hoc QA during the sprint uses `{runs}/qa/qa-adhoc-*.md` (no `MIDAS_VERIFY_RESULT`).

## Verdict tally
PASS: n  ·  FAIL: n (CRIT a · HIGH b · MED c · LOW d)  ·  BLOCKED: n
MIDAS_VERIFY_RESULT: fails=X criticals=Y runtime_errors=Z   # gate-parseable line (runtime_errors roll into fails/criticals)

## Per-criterion results
| # | Acceptance criterion | Tool | Selector(s) | Expected | Actual | Verdict | Evidence (screenshot) |
|---|----------------------|------|-------------|----------|--------|---------|-----------------------|

## Device profiles (web / responsive)
| Screen | Profile | Viewport | Overflow (scrollWidth ≤ clientWidth) | Verdict | Evidence |
|--------|---------|----------|--------------------------------------|---------|----------|
| | desktop (1280×720) | | | | |
| | iPhone 14 | 390×844 | | | |
| | Pixel 7 | 412×915 | | | |

Minimum profiles: **desktop** + at least **one** mobile (`iPhone SE`, `iPhone 14`, or `Pixel 7`) per key screen.

## Mobile (native)
| # | Criterion | Surface | Tool | Device | Verdict | Evidence |
|---|-----------|---------|------|--------|---------|----------|
| | | native \| webview | maestro-mcp | | | |

Use Maestro MCP with inline `{ yaml }` — no files in `{product}/`. Optional stable flows:
`{runs}/verifications/verify-NN/mobile-flows/*.yaml`.

## Runtime health (Chrome DevTools / agent-browser / Playwright)
| Screen | Console errors | Failed requests | CWV (LCP/CLS/INP) | Verdict |
|--------|----------------|-----------------|-------------------|---------|
- Uncaught console errors and failed happy-path requests are CRIT/HIGH fails; perf notes are advisory unless a budget exists.

## Design-token findings
| Screen | Property | Token expected | Computed value | Verdict |
|--------|----------|----------------|----------------|---------|
- Hardcoded-value violations, AA-contrast spot checks, focus-ring + dark-mode notes.

## Failures → /close-sprint (drift)
- <criterion> (<severity>): <what failed> → fix-task for the next sprint
