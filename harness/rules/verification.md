# Rule: Verification (always-on)

Verification rules apply from Phase 7 (Sprint Execution) onward and are re-audited each Phase 8.
They answer one question: **how does the agent prove the code it just wrote actually works** — not
that it reads correctly. The producer runs the cheap rungs of this ladder in its **per-task inner
loop** (Phase 7); the orchestrate-tier audit grades the whole ladder at sprint close (Phase 8).

> **Every item carries a `**CHECK:**`** — the concrete condition the Phase-8 audit evaluates: a
> command/grep where one exists, or a `manual:` observable when judgment is required (the auditor
> records pass/fail with the command output, test name, screenshot, or `file:line` as evidence).

## The ladder — cheapest tool that proves the claim, first

Climb only as far as the change demands: a pure-logic change stops at tests; a UI change goes to the
browser. **Never skip a cheaper rung to reach a dearer one** (don't drive a browser to catch a type
error the compiler would have caught for free). Each rung is a gate for the next.

### 1. Static gate (free, deterministic — runs first)
- [ ] The change typechecks, lints, and builds/compiles cleanly before anything is run.
      **CHECK:** the project's typecheck, lint, and build commands (`tsc --noEmit` / `mypy`, the
      linter, the build) each exit 0 with zero new errors on the sprint diff.

### 2. Behavioural tests (cheap — the specification)
- [ ] Every behaviour change ships with a passing test that asserts the observable behaviour
      (see [`testing.md`](./testing.md) for the coverage + quality contract this rung enforces).
      **CHECK:** the project test command (`npm test` / `pytest` / …) exits 0; a behaviour change
      with no new/updated test in the same diff range is a fail.

### 3. Runtime smoke (cheap — does it actually run?)
- [ ] After it compiles and tests pass, the app/CLI/service is **actually started** and observed to
      come up without a fatal error (imports resolve, no unhandled exception at boot, basic command
      or health endpoint responds).
      **CHECK:** `manual:` the project's run/preview/start command boots and stays up; an uncaught
      exception, failed import, or crash-on-launch is a fail (record the command + the observed output).

### 4. Browser / mobile verification — UI-touching changes only (drive + inspect)

**Scope:** web verification via **`agent-browser` CLI** (preferred) or Playwright MCP (fallback) plus optional
Chrome DevTools MCP for runtime health (`/midas-verify --scope web|all`). **Responsive mobile web** uses
agent-browser device profiles (`iPhone 14`, `Pixel 7`, …) in the same `verify-NN.md` record. **Native
mobile** (React Native, Flutter, Capacitor) uses Maestro MCP with inline YAML (`/midas-verify --scope
mobile|all`) — evidence in the **`## Mobile (native)`** section of the same record, not a separate filename.

UI journeys do **not** require committed `e2e/` files in `{product}/` when a frozen verify record exists.
Unit/integration tests in `{product}/` still apply per [`testing.md`](./testing.md).

Load browser MCPs **only** when agent-browser is absent and a rendered page is required — they are expensive.
- [ ] **Drive** each acceptance-criterion web flow (navigate → fill → click → assert) and capture a
      screenshot, using stable selectors. Prefer **agent-browser**; fall back to Playwright MCP.
      **CHECK:** a `/midas-verify` record (`{runs}/verifications/verify-NN.md`) exists with a
      per-criterion `pass | fail | blocked` verdict backed by a selector + screenshot; an uncovered
      acceptance-criterion journey is a fail.
- [ ] **Device profiles:** key screens checked at desktop and at least one mobile viewport; overflow
      asserted (`scrollWidth <= clientWidth`).
      **CHECK:** verify record **`## Device profiles`** table is filled for UI sprints; missing mobile
      profile on a mobile-first screen is a fail.
- [ ] **Native mobile** (when `architecture.md` declares a native/hybrid client): Maestro MCP exercises
      each native criterion or rows are explicitly `blocked` with reason (unwired emulator/MCP).
      **CHECK:** `manual:` for mobile-client sprints, `## Mobile (native)` section exists or every native
      criterion is proven another way; silent skip is a fail.
- [ ] **Inspect** runtime health: no uncaught console errors and no failed happy-path network requests.
      **CHECK:** runtime-health table in verify record; Chrome DevTools, agent-browser, or Playwright
      fallback documented per row.
- [ ] No horizontal overflow at narrow viewport; UI references design tokens per `{product}/design-system.md`.
      **CHECK:** `manual:` no horizontal overflow on key screens (see `accessibility.md` § layout overflow);
      `/midas-verify` automates where wired.
- [ ] Each criterion names the **tool** that proved it (canonical values in `harness/templates/sprint-progress.md`
      § Tool column: `agent-browser`, `agent-browser-ios`, `playwright-mcp`, `chrome-devtools-mcp`,
      `maestro-mcp`, `test-runner`, `@playwright/cli`). A UI sprint may use **agent-browser without any
      browser MCP** when the record documents it.
      **CHECK:** `manual:` every acceptance-criterion row has a non-empty Tool value; undocumented fallback is a fail.

### 5. Independent review before the gate (producer never grades its own homework)
- [ ] The sprint's conformance verdict is rendered by an **independent** reviewer — the orchestrate-tier
      audit (`/close-sprint`), an installed code-review specialist, or a separate reviewer agent — not
      by the agent that wrote the code. For high-stakes or whole-project doubt, escalate to the
      adversarial debate (`/midas-tribunal`).
      **CHECK:** the sprint's `{runs}/audits/audit-NN.md` exists and was produced by the auditor tier,
      not the producer; its `MIDAS_AUDIT_RESULT` tally shows `unresolved=0 verdict=pass`.

### The spec ledger — `{product}/features.json` (the passing/failing gate)
The sprint's machine-checkable spec (`{product}/features.json`, seeded at Phase-6 planning from the MVP
scope) is the ledger this ladder feeds: a feature flips to `status: passing` **only** when the rungs its
acceptance criteria demand are green, with the proof recorded in its `evidence`. The build agent edits
**only** `status`/`evidence`, never the spec fields (see `harness/templates/features.json.tmpl`).
- [ ] Every `passing` feature carries `evidence`; every shipped behaviour has a feature entry.
      **CHECK:** in `{product}/features.json`, a `status: "passing"` with empty `evidence`, or a shipped
      behaviour with no feature entry, is a fail; Phase 8 grades the file against the verification records.

## Cost & escalation
- The per-task inner loop runs rungs **1–3 always**, and rung **4 when the task is UI-touching** — fix
  and re-run until green before the task is checked off, with a bounded number of self-fix rounds
  (then surface to the human). Rung **5** runs once per sprint at close.
- Browser MCPs and the heavier verifiers are **opt-in and cost-gated**: prefer the cheapest tool that
  proves the claim; reach for Chrome DevTools / Lighthouse / a multi-agent debate only when the
  evidence genuinely requires it. Respect `state.yaml.cost_profile`.
- A claim with **no runnable evidence is `blocked`, never a silent pass**; equally, "all rungs pass"
  is a valid, honest verdict — do not invent failures.
