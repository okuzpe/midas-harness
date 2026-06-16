---
name: midas-verify
description: End-to-end / UI verification of a sprint via the Playwright MCP. Drive a real browser to exercise the active sprint's acceptance criteria (navigate, fill, click, assert, screenshot), check the rendered UI against the design tokens, and freeze a per-claim pass/fail verdict with evidence to .harness/verifications/verify-NN.md. Use after a UI-touching sprint lands, before /close-sprint. Hard-skips non-UI sprints (Playwright is expensive).
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: build
recommended-model: claude-sonnet-4-6
mcp-required: [playwright]
argument-hint: "[sprint-NN] [--scope ui|api|all]"
---

# midas-verify — End-to-End / UI Verification (Playwright)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; there must be a sprint whose work has **landed** (tasks done, tests
> run) and that **touches UI**. If no such sprint exists, report and stop.

Behavioral proof that a sprint's **acceptance criteria actually hold in a running app** — not that the
code reads correctly. `/close-sprint` audits the diff against frozen *rules*; this skill audits the
*living UI* against the sprint's *acceptance criteria* by driving a real browser. The two are
complementary: verify produces the behavioral evidence; `/close-sprint` consumes failures as drift.

## HARD GATE — only run for UI-touching sprints

The Playwright MCP loads ~114k tokens of browser tooling per task. **Do not pay that cost blindly.**

1. Read the active `product/sprints/NN-*.md` acceptance criteria and the sprint diff.
2. Decide **UI-touching** = the sprint renders or changes any user-facing surface (pages, components,
   styles, flows) **and** `--scope` is `ui` or `all` (default infer from the sprint).
3. **If the sprint is not UI-touching** (pure API/lib/infra, or `--scope api`): **do not load Playwright.**
   Say so explicitly — *"Sprint NN touches no UI; Playwright skipped (saved ~114k tokens)."* — and verify
   any API/behavioral criteria with the **existing test runner** (`npm test`/`pytest`/…) or
   `@playwright/cli` request testing, then freeze that lighter verdict (same record, no browser evidence).
4. **Prefer the cheapest tool that proves the claim.** Existing E2E/component tests or `@playwright/cli`
   first; spin up the **full Playwright MCP browser only** when a claim genuinely needs a rendered,
   interactive page (visual layout, real clicks, design-token inspection). Record which tool proved each claim.

## Procedure

### 1. Read state + acceptance criteria (read first)
Load `harness/state.yaml`, the active `product/sprints/NN-*.md` (its **acceptance criteria** are the
claims under test), `product/design-system.md`, and `harness/design-system/tokens.json` +
`tokens.css`. Resolve the target sprint (`sprint-NN` arg or the active one) and `--scope`. Determine the
app's run/preview command from `product/architecture.md` (dev server URL, build, or storybook).

### 2. Bring up the app
Start the app/preview in the background (the project's dev or preview command). Confirm it serves before
driving it. Prefer an ephemeral/test profile; never point Playwright at production or a real user account.

### 3. Exercise each acceptance criterion in a real browser
For **each** acceptance criterion, script a Playwright flow that proves it end-to-end:
**navigate → fill → click → assert → screenshot**. Use accessible, stable selectors (role/label/test-id),
not brittle CSS. Capture for every criterion: the **selector(s)** touched, the **assertion** result, and
a **screenshot** as evidence. Cover the happy path **and** at least one failure/edge path where the
criterion implies one (empty state, validation error, unauthorized).

### 4. Check rendered UI against the design tokens
On the key screens, inspect computed styles and assert the UI **references the design system**
(`harness/design-system/tokens.css` `--ds-*` vars / `tokens.json` values): colours, spacing on the 8px
grid, type scale, focus ring. **Flag hardcoded values** that bypass tokens (e.g. a raw hex not traceable
to a `--ds-*` token) as a fail with the offending selector + computed value. Spot-check **AA contrast**
and the **focus-visible** ring on interactive elements, and dark mode if `[data-theme="dark"]` is in scope.

### 5. Render a per-claim VERDICT with evidence
For each criterion render `pass | fail | blocked` with: the selector(s), the asserted vs actual value,
and the screenshot path. A claim with no runnable evidence is `blocked` (not a silent pass). Token
violations and contrast/focus failures are first-class **fails**, severity-tagged
(CRIT/HIGH/MED/LOW). **"All criteria pass" is a valid, honest verdict — do not invent failures**; equally,
never mark a criterion pass without on-disk evidence.

### 6. Freeze the verification record (write last)
Write `.harness/verifications/verify-NN.md` (NN = sprint id), **frozen and immutable**, mirroring the
`audit-NN.md` / `debate-NN.md` idiom: the gate-parseable tally line, the per-criterion table with
evidence, the design-token findings, and the screenshots (committed under
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
Ran: <YYYY-MM-DD> · Tier: build (claude-sonnet-4-6) · Tool: <playwright-mcp | @playwright/cli | test-runner>
App under test: <url / preview command>

## Verdict tally
PASS: n  ·  FAIL: n (CRIT a · HIGH b · MED c · LOW d)  ·  BLOCKED: n
MIDAS_VERIFY_RESULT: fails=X criticals=Y        # gate-parseable line

## Per-criterion results
| # | Acceptance criterion | Tool | Selector(s) | Expected | Actual | Verdict | Evidence (screenshot) |
|---|----------------------|------|-------------|----------|--------|---------|-----------------------|

## Design-token findings
| Screen | Property | Token expected | Computed value | Verdict |
|--------|----------|----------------|----------------|---------|
- Hardcoded-value violations, AA-contrast spot checks, focus-ring + dark-mode notes.

## Failures → /close-sprint (drift)
- <criterion> (<severity>): <what failed> → fix-task for the next sprint
```

## Exit gate (verification complete)
- [ ] **Hard gate honoured**: Playwright loaded only for UI-touching scope; non-UI sprints skipped with a logged reason.
- [ ] **Every acceptance criterion** has a `pass | fail | blocked` verdict backed by on-disk evidence (screenshot + selector); none silently passed.
- [ ] **Rendered UI checked against the design tokens**; hardcoded-value, contrast, and focus violations recorded as fails.
- [ ] `.harness/verifications/verify-NN.md` frozen with the `MIDAS_VERIFY_RESULT` tally line; screenshots committed beside it.
- [ ] `state.yaml` **stage NOT advanced**, no gate marked passed; failures routed to `/close-sprint`.

## Tier & cost
Scripting the flows, driving the browser, and writing the record → **build** (Sonnet). Reading state /
extracting acceptance criteria + selectors → **scout** (Haiku). The pass/fail verdict and ship-relevant
severity call belong to the **orchestrate** audit (`/close-sprint`) that consumes this record — verify
**produces evidence, it does not pass the gate**. Cost discipline: **skip Playwright unless UI is in
scope** (~114k tokens/task); prefer the existing test runner or `@playwright/cli` whenever a full,
rendered browser isn't required. Respect `state.yaml.cost_profile`.
