---
name: midas-verify
description: End-to-end / UI verification of a sprint. DRIVE a real browser (Playwright MCP) to exercise the active sprint's acceptance criteria (navigate, fill, click, assert, screenshot) AND INSPECT the running app's runtime health (Chrome DevTools MCP) — console errors, failed network requests, Core Web Vitals — then check the rendered UI against the design tokens and freeze a per-claim pass/fail verdict with evidence to .harness/verifications/verify-NN.md. Use after a UI-touching sprint lands, before /close-sprint. Hard-skips non-UI sprints (browser MCPs are expensive).
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
mcp-required: [playwright]
mcp-recommended: [chrome-devtools]
argument-hint: "[sprint-NN] [--scope ui|api|all]"
---

# midas-verify — End-to-End / UI Verification (Playwright + Chrome DevTools)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; there must be a sprint whose work has **landed** (tasks done, tests
> run) and that **touches UI**. If no such sprint exists, report and stop.

Behavioral proof that a sprint's **acceptance criteria actually hold in a running app** — not that the
code reads correctly. `/close-sprint` audits the diff against frozen *rules*; this skill audits the
*living UI* against the sprint's *acceptance criteria* by driving a real browser. The two are
complementary: verify produces the behavioral evidence; `/close-sprint` consumes failures as drift.
This skill is rung 4 of the verification ladder in `harness/rules/verification.md`.

**Two complementary browser tools — drive and inspect.** Use the cheapest that proves each claim:
- **Playwright MCP — *drive* the flow.** Navigate, fill, click, assert the DOM / accessibility tree,
  screenshot. Cross-browser, deterministic refs, cheap text snapshots. This proves *the flow works*.
- **Chrome DevTools MCP — *inspect* runtime health.** Console errors, failed network requests,
  performance / Core Web Vitals, Lighthouse. Chrome-only, ~17k tokens on load. This proves *it's
  healthy under the hood* — things Playwright is blind to. **If it isn't installed, fall back to
  Playwright's console/network capture (`--caps=network`, console level) and record which tool proved
  the claim.**

## HARD GATE — only run for UI-touching sprints

Browser MCPs are expensive — Playwright ~114k tokens/task, Chrome DevTools ~17k on load. **Do not pay
that cost blindly.**

1. Read the active `product/sprints/NN-*.md` acceptance criteria and the sprint diff.
2. Decide **UI-touching** = the sprint renders or changes any user-facing surface (pages, components,
   styles, flows) **and** `--scope` is `ui` or `all` (default infer from the sprint).
3. **If the sprint is not UI-touching** (pure API/lib/infra, or `--scope api`): **do not load any
   browser MCP.** Say so explicitly — *"Sprint NN touches no UI; browser MCPs skipped (saved ~114k+
   tokens)."* — and verify any API/behavioral criteria with the **existing test runner**
   (`npm test`/`pytest`/…) or `@playwright/cli` request testing, then freeze that lighter verdict
   (same record, no browser evidence).
4. **Prefer the cheapest tool that proves the claim.** Existing E2E/component tests or `@playwright/cli`
   first; spin up the **full Playwright MCP browser only** when a claim genuinely needs a rendered,
   interactive page (visual layout, real clicks, design-token inspection); add **Chrome DevTools MCP**
   only when a claim needs runtime introspection (console/network/perf). Record which tool proved each claim.

## Procedure

### 1. Read state + acceptance criteria (read first)
Load `harness/state.yaml`, the active `product/sprints/NN-*.md` (its **acceptance criteria** are the
claims under test), `product/design-system.md`, and `harness/design-system/tokens.json` +
`tokens.css`. Resolve the target sprint (`sprint-NN` arg or the active one) and `--scope`. Determine the
app's run/preview command from `product/architecture.md` (dev server URL, build, or storybook).

### 2. Bring up the app
Start the app/preview in the background (the project's dev or preview command). Confirm it serves before
driving it. Prefer an ephemeral/test profile; never point a browser at production or a real user account.

### 3. Exercise each acceptance criterion in a real browser (drive — Playwright)
For **each** acceptance criterion, script a Playwright flow that proves it end-to-end:
**navigate → fill → click → assert → screenshot**. Use accessible, stable selectors (role/label/test-id),
not brittle CSS. Capture for every criterion: the **selector(s)** touched, the **assertion** result, and
a **screenshot** as evidence. Cover the happy path **and** at least one failure/edge path where the
criterion implies one (empty state, validation error, unauthorized).

### 3b. Inspect runtime health (inspect — Chrome DevTools)
While the same flows run, attach **Chrome DevTools MCP** to the running app and capture what Playwright
cannot see — record each as a row in the **runtime-health table** (screen · observed value · verdict):
- **Console:** zero **uncaught errors / unhandled rejections** on the happy path. A thrown error, failed
  assertion, or framework error-boundary trip is a **fail** (record the message + source-mapped stack).
- **Network:** zero **failed requests** (4xx/5xx, CORS, timeouts) on the happy path; flag slow calls.
- **Performance:** a Core Web Vitals / Lighthouse spot-check on the key screen — record LCP/CLS/INP and
  flag a regression against any budget in `product/architecture.md` (advisory MED unless a budget exists).

If Chrome DevTools MCP is unavailable, capture console + network via Playwright and note the lighter
tool in the record. Uncaught console errors and failed happy-path requests are **first-class fails**.

### 4. Check rendered UI against the design tokens AND the design direction
On the key screens, inspect computed styles and assert the UI **references the design system**
(`harness/design-system/tokens.css` `--ds-*` vars / `tokens.json` values): colours, spacing on the 8px
grid, type scale, focus ring. **Flag hardcoded values** that bypass tokens (e.g. a raw hex not traceable
to a `--ds-*` token) as a fail with the offending selector + computed value. Spot-check **AA contrast**
and the **focus-visible** ring on interactive elements, and dark mode if `[data-theme="dark"]` is in scope.
**Also judge it against `product/design-direction.md`:** does the screen match the referenced products /
mood, or does it look **generic** (default Tailwind/Bootstrap, stock gradients, rounded-everything)? Flag
generic-feeling screens as a design finding (MED), citing the direction it drifted from — consistency with
tokens is not the same as being on-direction.

**And assert NO overflow at a narrow viewport** (the deterministic containment detector): set the viewport to
~320–375px and assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` on each
key screen (no unexpected horizontal scrollbar), and spot-check that buttons/inputs/cards stay inside their
parent box. A page that scrolls horizontally at narrow width — or a control that escapes its container — is a
**HIGH** finding with a screenshot. This catches the classic "buttons/inputs overflow their parent" regression
that token checks alone miss.

### 5. Render a per-claim VERDICT with evidence
For each criterion render `pass | fail | blocked` with: the selector(s), the asserted vs actual value,
and the screenshot path. A claim with no runnable evidence is `blocked` (not a silent pass). Token
violations, contrast/focus failures, **and runtime-health failures (uncaught console errors, failed
happy-path requests)** are first-class **fails**, severity-tagged (CRIT/HIGH/MED/LOW). **"All criteria
pass" is a valid, honest verdict — do not invent failures**; equally, never mark a criterion pass without
on-disk evidence.

### 6. Freeze the verification record (write last)
Write `.harness/verifications/verify-NN.md` (NN = sprint id), **frozen and immutable**, mirroring the
`audit-NN.md` / `debate-NN.md` idiom: the gate-parseable tally line, the per-criterion table with
evidence, the runtime-health table, the design-token findings, and the screenshots (committed under
`.harness/verifications/verify-NN/`). Save screenshots beside the record; reference them by relative path.
You **MAY** set `last_verification: { n: NN, fails: X, at: <date> }` in `state.yaml` (read-modify-write the
whole file per schema). **Never set `gate: passed` or advance `stage`** — verify informs; `/close-sprint` decides.

### 7. Feed failures back
Surface each `fail` as a fix-task and route it to `/close-sprint` as behavioral **drift** (it already
treats failed checks as fix-now-or-amend). Critical fails block the sprint from closing; LOW nits are
capped and listed for later. The next ritual after verify is **`/close-sprint`**.

## Output format (`.harness/verifications/verify-NN.md`)

```markdown
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
```

## Exit gate (verification complete)
- [ ] **Hard gate honoured**: browser MCPs loaded only for UI-touching scope; non-UI sprints skipped with a logged reason.
- [ ] **Every acceptance criterion** has a `pass | fail | blocked` verdict backed by on-disk evidence (screenshot + selector); none silently passed.
- [ ] **Runtime health inspected** (Chrome DevTools or fallback): zero uncaught console errors and zero failed happy-path requests on the screens under test; a CWV/Lighthouse spot-check recorded.
- [ ] **Rendered UI checked against the design tokens**; hardcoded-value, contrast, and focus violations recorded as fails.
- [ ] **Key screens checked for horizontal overflow at a narrow viewport** (~320–375px): no unexpected scrollbar; buttons/inputs/cards stay contained.
- [ ] `.harness/verifications/verify-NN.md` frozen with the `MIDAS_VERIFY_RESULT` tally line; screenshots committed beside it.
- [ ] `state.yaml` **stage NOT advanced**, no gate marked passed; failures routed to `/close-sprint`.

## Tier & cost
Scripting the flows, driving the browser, and writing the record → **build** (Sonnet). Reading state /
extracting acceptance criteria + selectors → **scout** (Haiku). The pass/fail verdict and ship-relevant
severity call belong to the **orchestrate** audit (`/close-sprint`) that consumes this record — verify
**produces evidence, it does not pass the gate**. Cost discipline: **skip browser MCPs unless UI is in
scope** (Playwright ~114k tokens/task, Chrome DevTools ~17k on load); prefer the existing test runner or
`@playwright/cli` whenever a full, rendered browser isn't required. Respect `state.yaml.cost_profile`.
