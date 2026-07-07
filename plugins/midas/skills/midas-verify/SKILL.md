---
name: midas-verify
description: End-to-end / UI verification of a sprint. DRIVE flows with agent-browser CLI (preferred) or Playwright MCP fallback; INSPECT runtime health (Chrome DevTools MCP); exercise mobile viewports and native apps (Maestro MCP inline YAML) per --scope; freeze per-claim verdicts to {runs}/verifications/verify-NN.md. Use after a UI-touching sprint lands, before /close-sprint. Hard-skips non-UI sprints.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
mcp-recommended: [playwright, chrome-devtools, maestro]
argument-hint: "[sprint-NN] [--scope web|mobile|api|all] [--profile ios-safari]"
---

# midas-verify — End-to-End / UI Verification (agent-browser + Playwright + Maestro)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read the state file at **`paths.state`**; there must be a sprint whose work has **landed** (tasks done, tests
> run) and that **touches UI** (or `--scope mobile` for native). If no such sprint exists, report and stop.

> **Paths:** Engine = `<paths.engine>/`; scripts = `<paths.scripts>/`; `{runs}/` = `paths.runs`. See `AGENTS.md` § Path resolution.

Behavioral proof that a sprint's **acceptance criteria actually hold in a running app** — not that the
code reads correctly. `/close-sprint` audits the diff against frozen *rules*; this skill audits the
*living UI* against the sprint's *acceptance criteria*. Verify produces evidence; `/close-sprint` consumes
failures as drift. This skill is rung 4 of the verification ladder in `<paths.engine>/rules/verification.md`.

**Taxonomy (no E2E folder in product):** unit/integration tests live in `{product}/`; UI journeys are
proven here and frozen in **`{runs}/verifications/verify-NN.md`** (+ screenshots). The agent runs ephemeral
flows — it does not commit `e2e/` suites to the product repo.

## Tool ladder — cheapest that proves each claim

| Priority | Tool | When |
|---|---|---|
| 1 | `test-runner` / `@playwright/cli` | API-only criteria; request testing without a rendered page |
| 2 | **`agent-browser` CLI** | Web UI: navigate, fill, click, assert, screenshot; mobile viewports (`set device` / `set viewport`) |
| 3 | **Playwright MCP** | Fallback when `agent-browser` is not installed and a rendered page is required |
| 4 | **Chrome DevTools MCP** | Runtime health on desktop (console, network, CWV) — optional |
| 5 | **Maestro MCP** | `--scope mobile` or `all` when `{product}/architecture.md` declares native/hybrid (`react-native`, `flutter`, `capacitor`) |
| 6 | **`agent-browser -p ios`** | `--profile ios-safari` on macOS for real Mobile Safari (not Windows) |

### Pre-check `agent-browser` (cross-platform)

Before driving web UI, detect the CLI:

```bash
# POSIX
command -v agent-browser >/dev/null 2>&1 && echo ready || echo missing

# Windows PowerShell
Get-Command agent-browser -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name

# Windows cmd
where.exe agent-browser 2>nul
```

If **ready**: use `agent-browser` for all web drive steps. If **missing**: log the reason in the verify
record and fall back to Playwright MCP (if wired) or mark UI rows `blocked`.

**agent-browser web flow:** `open <url>` → `set device "iPhone 14"` or `set viewport 390 844` →
`snapshot -i` → `click @e1` / `fill @e2 "text"` → `screenshot path.png`.

## HARD GATE — scope and cost

Browser/native automation is expensive. **Do not pay that cost blindly.**

1. Read the active `{product}/sprints/NN-*.md` acceptance criteria, the sprint diff, and
   `{product}/architecture.md` (`client` type).
2. Resolve `--scope`:
   - **`api`** — no browser; test runner / `@playwright/cli` only.
   - **`web`** (default for web-only products) — agent-browser / Playwright for rendered surfaces.
   - **`mobile`** — Maestro MCP for native/hybrid criteria only; skip web unless architecture also has web.
   - **`all`** — web + mobile sections in one record.
3. **Non-UI sprints** (`--scope api` or sprint touches no UI): skip browser MCPs; say so explicitly;
   verify API criteria with the test runner; freeze the lighter verdict (same `verify-NN.md`, no screenshots).
4. **Prefer the cheapest tool** per claim; record the **Tool** column for every row.

## Procedure

### 1. Read state + acceptance criteria (read first)
Load **`paths.state`**, the active `{product}/sprints/NN-*.md`, `{product}/design-system.md`,
`{product}/architecture.md`, and `<paths.engine>/design-system/tokens.json` + `tokens.css`.
Resolve sprint id (`sprint-NN` arg or active), `--scope`, and `--profile`. Determine run/preview command
and URL from architecture.

### 2. Bring up the app
Start dev/preview in the background. Confirm it serves. Prefer ephemeral/test profile; never production.

### 3. Web — exercise criteria (drive — agent-browser preferred)

For each **web** acceptance criterion under `--scope web` or `all`:

1. **Desktop** (default viewport): drive the flow; screenshot.
2. **Mobile viewport** — at least one profile per key screen:
   - `iPhone SE` (375×667), `iPhone 14` (390×844), or `Pixel 7` (412×915)
   - Use `agent-browser set device "<name>"` or `set viewport W H`
3. Assert overflow: `scrollWidth <= clientWidth` at narrow width (~320–375px).
4. Capture selector(s), assertion, screenshot path per criterion.

**iOS Safari real (`--profile ios-safari`, macOS only):**

```bash
agent-browser -p ios --device "iPhone 16 Pro" open https://localhost:PORT/path
agent-browser -p ios snapshot -i
agent-browser -p ios tap @e1
agent-browser -p ios screenshot verify-NN/ios-safari.png
```

On Windows/Linux: mark ios-safari rows **`blocked`** with reason; use viewport emulation as substitute.

**Playwright MCP fallback** (when agent-browser missing): same flows via Playwright MCP tools.

### 3b. Runtime health (inspect — Chrome DevTools)
On key **desktop** screens, attach Chrome DevTools MCP (or agent-browser/Playwright console+network capture).
Record runtime-health table: console errors, failed requests, CWV (advisory unless budget in architecture).
Uncaught errors and failed happy-path requests are **first-class fails**.

### 3c. Mobile native — Maestro MCP (`--scope mobile` or `all`)

When architecture declares `react-native`, `flutter`, `capacitor`, or `hybrid`:

1. Ensure Maestro MCP is wired (`maestro` + `args: ["mcp"]` in `.mcp.json`) — if not, native rows are **`blocked`**, not silent pass.
2. `list_devices` → pick Android emulator (Windows) or iOS simulator (macOS).
3. Per criterion: `inspect_screen` → build inline YAML → `run { yaml: "..." }` → `take_screenshot`.
4. **Do not write YAML to `{product}/`** — inline only; optional promotion of stable flows to
   `{runs}/verifications/verify-NN/mobile-flows/` for CI reuse.
5. **Hybrid:** native shell via Maestro; WebView content via `agent-browser` against local URL.
   Use column **Surface:** `native | webview` in the mobile table.

### 4. Design tokens + design direction
On key screens (web), assert `--ds-*` token usage; flag hardcoded values. Spot-check AA contrast and
focus ring. Judge against `{product}/design-direction.md` (generic UI = MED finding).

### 5. Per-claim VERDICT
Each criterion: `pass | fail | blocked` with evidence. No silent passes.

### 6. Freeze verification record (write last)
Write **one** `{runs}/verifications/verify-NN.md` (NN = sprint id only — never `verify-mobile-NN.md`).
Use `<paths.engine>/templates/verify-record.md`. Sections:

- `## Per-criterion results` (web + API)
- `## Device profiles` (viewport / device name / overflow verdict)
- `## Mobile (native)` (when scope includes mobile)
- `## Runtime health`, `## Design-token findings`
- Single **`MIDAS_VERIFY_RESULT`** tally line for the whole record

Screenshots under `{runs}/verifications/verify-NN/`. You **MAY** set `last_verification` in `state.yaml`.
**Never advance `stage` or set `gate: passed`.**

### 7. Feed failures back
Route each `fail` to `/close-sprint` as behavioral drift.

## Output format

Use `<paths.engine>/templates/verify-record.md`. Keep `MIDAS_VERIFY_RESULT` exactly as in the template.

## Exit gate (verification complete)
- [ ] Scope honoured; non-UI/API-only skips logged.
- [ ] Every criterion has `pass | fail | blocked` with on-disk evidence.
- [ ] Web UI: agent-browser used when installed; fallback documented otherwise.
- [ ] Mobile viewports: at least one device profile per key screen (web scope).
- [ ] Native (when in scope): Maestro inline or `blocked` with reason.
- [ ] Runtime health recorded; token/overflow checks done.
- [ ] Single `verify-NN.md` frozen with `MIDAS_VERIFY_RESULT`.
- [ ] `state.yaml` stage NOT advanced.

## Tier & cost
Build tier drives flows and writes the record; scout tier for reading criteria/selectors. Respect
`state.yaml.cost_profile`. Prefer agent-browser over Playwright MCP; skip browser MCPs when `--scope api`.
