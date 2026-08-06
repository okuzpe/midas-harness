# Sprint progress — NN-<slug>

> **STM (session memory).** Copy this template to `{runs}/sprints/NN-progress.md` when the sprint
> goes `active` (Phase 7). Update after each task or significant decision so a fresh session can resume
> without re-reading the whole repo. See `harness/research/memory-model.md`.

**Sprint:** NN — <!-- title -->  
**Last updated:** <!-- ISO date -->

## Done

| Task | Proof | Tool | Route |
|---|---|---|---|
| <!-- task id or title --> | <!-- test name / command / screenshot ref --> | <!-- context7 \| test-runner \| agent-browser \| agent-browser-ios \| playwright-mcp \| chrome-devtools-mcp \| maestro-mcp \| @playwright/cli \| smoke --> | <!-- inline \| delegated \| plan-first — required when the task cluster spans ≥4 files; see organic-routing.md --> |

<!-- One row per completed task this cycle. Tool = which MCP or runner proved the work (git-visible traceability). Route = implementation route from `<paths.engine>/rules/organic-routing.md`. -->

### Tool column — canonical values

Use these strings in the **Tool** column (and in verify records). They map to `state.yaml → mcp:` /
`.mcp.json` server keys where applicable:

| Tool value | Meaning |
|---|---|
| `test-runner` | Project test command (`npm test`, `pytest`, …) |
| `context7` | Context7 MCP doc fetch |
| `agent-browser` | [agent-browser](https://github.com/vercel-labs/agent-browser) CLI — preferred web driver (viewport/device emulation) |
| `agent-browser-ios` | agent-browser `-p ios` — real Mobile Safari (macOS + Xcode + Appium) |
| `playwright-mcp` | Playwright MCP (`playwright` in state / `.mcp.json`) — fallback when agent-browser absent |
| `chrome-devtools-mcp` | Chrome DevTools MCP (`chrome-devtools` in state / `.mcp.json`) |
| `maestro-mcp` | Maestro MCP (`maestro mcp`) — native/hybrid mobile (`--scope mobile`) |
| `@playwright/cli` | Playwright CLI request testing without full browser MCP |
| `smoke` | Runtime boot / manual smoke (non-UI) |

## Next

<!-- The single next task or blocker — one line. -->

## Observations (What / Why / Where / Learned)

Use one subsection per significant decision or surprise. Protocol inspired by structured agent memory
(What happened · Why · Where in the repo · What we learned) — stored as markdown, not a hidden DB.

### YYYY-MM-DD — <!-- short title -->

| Field | Content |
|---|---|
| **What** | <!-- what changed or was decided --> |
| **Why** | <!-- rationale --> |
| **Where** | <!-- path:line or artifact --> |
| **Learned** | <!-- takeaway for the next session --> |

<!-- Add more dated observations above this line (newest first). -->

## Do not re-read

<!-- Paths the next session can skip — already summarized above or unchanged this sprint. -->
