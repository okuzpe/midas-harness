---
name: midas-verify
description: "Sprint UI/API verification — drive flows, inspect runtime health, freeze per-claim verdicts to {runs}/verifications/verify-NN.md. Use after a UI-touching sprint lands, before /close-sprint; hard-skips non-UI sprints."
metadata:
  midas-argument-hint: "[sprint-NN] [--scope web|mobile|api|all] [--profile ios-safari]"
  midas-disable-model-invocation: true
  midas-harness-tier: build
  midas-mcp-recommended: "[playwright, chrome-devtools, maestro]"
  midas-model: inherit
  midas-recommended-model: claude-sonnet-4-6
  midas-user-invocable: true
  midas-user-surface: primary
---
# midas-verify — end-to-end / UI verification

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> **Precondition:** landed sprint that touches UI (or `--scope mobile` for native). Else report and stop.
> Tally shape: `<paths.engine>/templates/audit-checklists.md` § Parseable tally lines.

## Does / Does not

| Does | Does not |
|---|---|
| Prove acceptance criteria in a **running** app | Advance `stage` or set `gate: passed` |
| Freeze evidence to `{runs}/verifications/verify-NN.md` | Commit `e2e/` suites to `{product}/` |
| Feed `fail` rows to `/close-sprint` as drift | Run browser automation on API-only sprints |

Behavioral proof against sprint acceptance criteria — rung 4 of `<paths.engine>/rules/verification.md`. `/close-sprint` audits diff vs rules; this audits the living UI. **Tool ladder, pre-checks, and fallback order:** that rule §4 + `<paths.engine>/templates/verify-record.md` § Tool column — do not duplicate here.

## HARD GATE — scope and cost

Browser/native automation is expensive. **Do not pay blindly.**

1. Read `{product}/sprints/NN-*.md` acceptance criteria, sprint diff, `{product}/architecture.md` (`client` type).
2. Resolve `--scope`:
   - **`api`** — test runner / `@playwright/cli` only; no browser.
   - **`web`** (default for web products) — agent-browser preferred; Playwright MCP fallback.
   - **`mobile`** — Maestro MCP for native/hybrid only.
   - **`all`** — web + mobile sections in one record.
3. Non-UI sprint → skip browser MCPs; say so; freeze lighter record (same filename, no screenshots).
4. **Cheapest tool per claim**; non-empty **Tool** column every row.

## Procedure

### 1. Read state + criteria
Load `paths.state`, sprint file, `{product}/design-system.md`, **`{product}/design-direction.md`**, `{product}/architecture.md`, token files. Resolve sprint id, `--scope`, `--profile`. Determine run/preview command + URL.

### 2. Bring up the app
Start dev/preview in background; confirm serving. Ephemeral/test profile only — never production.

### 3. Web (`--scope web` or `all`)
Per web criterion:
1. **Desktop** — drive flow; screenshot.
2. **Mobile viewport** — ≥1 profile per key screen (`iPhone SE`, `iPhone 14`, `Pixel 7` via `set device` / `set viewport`).
3. Assert `scrollWidth <= clientWidth` at ~320–375px.
4. Record selector, assertion, screenshot path.

**`--profile ios-safari` (macOS only):** `agent-browser -p ios` against local URL. Windows/Linux → `blocked` + viewport emulation substitute.

**Playwright MCP fallback** when agent-browser missing — document reason in record.

### 3b. Runtime health (desktop key screens)
Chrome DevTools MCP or agent-browser/Playwright console+network. Uncaught errors + failed happy-path requests = **fail**.

### 3c. Mobile native (`--scope mobile` or `all`)
When architecture declares `react-native`, `flutter`, `capacitor`, or `hybrid`:
1. Maestro MCP wired (`maestro` + `args: ["mcp"]`) — else native rows **`blocked`**.
2. `list_devices` → pick emulator/simulator.
3. Per criterion: `inspect_screen` → inline YAML → `run` → `take_screenshot`. **No YAML in `{product}/`**; optional promotion to `{runs}/verifications/verify-NN/mobile-flows/`.
4. Hybrid: native via Maestro; WebView via agent-browser. Column **Surface:** `native | webview`.

### 4. Design tokens + direction + authenticity
Assert `--ds-*` usage; flag hardcoded values. Spot-check AA contrast + focus. Generic UI vs `{product}/design-direction.md` = MED finding.
Run **Product authenticity** CHECKs from `<paths.engine>/rules/visual-design.md` on each key marketing/landing screen (SaaS-stack smell, logo-swap test, product evidence above the fold, one job per section). Failures → record under **`## Product authenticity`** with severity; logo-swap **Yes** (still generic) is at least MED. If authenticity fails hard and no `{runs}/design/design-NN.md` exists for this surface, note: *consider `/midas-design` before more UI churn*.

### 5. Per-claim VERDICT
Each criterion: `pass | fail | blocked` with evidence. No silent passes.

### 6. Freeze (write last)
One **`{runs}/verifications/verify-NN.md`** (NN = sprint id only). Template: `<paths.engine>/templates/verify-record.md`. Sections: `## Per-criterion results`, `## Device profiles`, `## Mobile (native)` (when in scope), `## Runtime health`, `## Design-token findings`, `## Product authenticity` (marketing/landing), single **`MIDAS_VERIFY_RESULT`** tally. Screenshots under `{runs}/verifications/verify-NN/`. After a successful freeze, **always** set `last_verification: { n, at }` in `paths.state` (read-modify-write). **Never advance `stage`.**

### 7. Feed failures back
Route each `fail` to `/close-sprint`.

**Optional — lifecycle journal:** after freezing `verify-NN.md`,
`node <paths.scripts>/lifecycle-journal.mjs verify --detail "verify-NN"` (fail-open).

## Exit gate (verification complete)
- [ ] Scope honoured; non-UI/API-only skips logged.
- [ ] Every criterion `pass | fail | blocked` with on-disk evidence.
- [ ] Web: agent-browser when installed; fallback documented.
- [ ] Mobile viewports: ≥1 device profile per key screen (web scope).
- [ ] Native (when in scope): Maestro inline or `blocked` with reason.
- [ ] Runtime health recorded; token/overflow checks done.
- [ ] Single `verify-NN.md` frozen with `MIDAS_VERIFY_RESULT`.
- [ ] `paths.state` stage NOT advanced.

## Tier & delegation
**Build** drives flows + writes record; **scout** reads criteria. Respect `cost_profile`. Skip browser MCPs when `--scope api`.
