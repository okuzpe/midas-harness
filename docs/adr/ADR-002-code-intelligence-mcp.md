# ADR-002 — Optional code-intelligence MCP (code-graph) for the scout tier

| Field | Value |
|---|---|
| **Status** | **rejected** (2026-06-29) |
| **Date** | 2026-06-29 |
| **Deciders** | maintainer + orchestrate tier |
| **Context7 verified** | n/a (process/engine decision; no third-party API coded here) |

> Engine-level ADR (decision about the Midas repository itself). Builds on the Context7 pattern from
> `harness/rules/context7-usage.md`: **mandate the habit, wire the vendor only as opt-in.**

## Rejection rationale (2026-06-29)

**Rejected — not worth the install complexity for a markdown-first, dependency-free harness.** Unlike
Context7 (a remote HTTP URL that wires "link-style", already shipped free/no-key in v0.5.20),
`codebase-memory-mcp` is a **per-OS native binary** the user must download, install, and restart their
agent to use. Auto-wiring it during install would break Midas's core "only adds files / no binaries /
dependency-free" principle and add Windows-signing and vendor-tracking burden. The analysis below remains
on record; if the scout-tier token cost ever becomes a top pain point, this ADR can be reopened and gated
on the **Phase 0 evidence** it already specifies. **No engine changes were made.**

## Context

Midas's most repetitive runtime cost is **file-by-file code exploration** by the `scout` tier:
`grep` + `read` cycles to inventory a repo, build evidence packs, and grade rule CHECKs. This shows up
in at least four places:

- `/midas-adopt` (Phase 0b inventory) — walks the tree to infer the as-built architecture.
- `/close-sprint` (Phase 8) — greps the diff against every frozen rule (boundary, dead-code, naming).
- `/midas-tribunal` (Round 0) — scout assembles `file:line` evidence packs per lens.
- The `midas-scout` agent generally — its whole job is search/extract.

A **code-intelligence MCP** (e.g. `DeusData/codebase-memory-mcp`) indexes a repo into a persistent
knowledge graph (tree-sitter + a lightweight type-resolution layer) and answers structural queries —
`get_architecture`, `trace_path`, `detect_changes` (git-diff blast radius + risk), `query_graph`
(read-only openCypher), dead-code detection — in one call instead of dozens of grep/read cycles. It is a
**single local static binary, no API key, no telemetry, MIT-licensed** — the same "free, local, no key"
profile we just standardized for Context7.

This is **not** a competitor to Midas. Midas is a *methodology* engine (markdown phases, rules, audits);
a code-graph MCP is a *structural-analysis backend*. They are complementary: Midas decides what to build
and audits it; the graph answers "where is the code and how is it connected".

The hard constraint (same as Context7): Midas is tool-agnostic and **recommend-don't-wall**. It must not
*depend* on any binary. Any adoption is opt-in, with the existing grep/read path as the always-available
fallback.

## Decision

We will adopt a code-intelligence MCP as an **optional, recommended** integration, mirroring the
Context7 pattern exactly:

1. **Optional MCP entry** — a commented `{{!code-graph}}` block in `harness/templates/mcp.json.tmpl`
   (local command, no auth, no key). Off by default; the user uncomments to wire it.
2. **A habit rule** — `harness/rules/code-intelligence.md` (always-on, with a `**CHECK:**`): *for
   structural exploration of an existing/large codebase, prefer a code-graph query when a
   code-intelligence MCP is wired; otherwise fall back to grep/read.* The rule mandates the **habit**
   (cheap structural discovery first), not the vendor — identical framing to `context7-usage.md`.
3. **Integration notes** (prose only, no behavioural lock-in) in `/midas-adopt`, `/close-sprint`,
   `/midas-tribunal`, and the `midas-scout` agent: prefer a graph query when the MCP is present.

We will **not** replace Midas's git-committed `product/adr/*` with the MCP's `manage_adr`, and we will
**not** make any skill require the MCP. The graph is ephemeral/local; the ADRs and rules stay the
versioned source of truth.

## Viability

| Dimension | Assessment |
|---|---|
| **Licensing** | MIT — compatible with shipping a recommendation. No legal blocker. |
| **Cost** | Free, 100% local, no API key, no telemetry. Matches the Context7 free-tier-only stance (ADR set in v0.5.20). |
| **Install footprint** | Single static binary per OS (macOS/Linux/Windows). Heavier than "plain markdown", but **opt-in** — only users who want it pay the cost. |
| **Windows** | Native binary launches cleanly (avoids the `npx` → `cmd /c` issue Midas patches for stdio MCPs). Install/SmartScreen caveat documented. |
| **Engine changes** | Small and additive: one commented MCP block, one new rule, prose notes. No script/renderer/test contract changes required for the opt-in path. |
| **Reversibility** | High. Remove the commented block + rule; nothing else depends on it. |
| **Vendor risk** | A single third-party binary. Mitigated by: optional, fallback-to-grep always present, and the rule naming the *capability* (any code-graph MCP), not the vendor. |
| **Claims to verify** | Vendor's headline numbers (repo-in-ms, 99% fewer tokens, 83% answer quality) are **unverified marketing** from a scraped README. **Must be validated on a real repo before any docs recommend it.** |

**Verdict: viable as an opt-in.** No blocker; the only gate is empirical verification of the token/latency
benefit before we put a recommendation in front of users.

## Impact

### Where it pays off (highest → lowest)

1. **`midas-scout` exploration cost** — the core win. Structural questions ("who calls X", "what does the
   `ui/` layer import", "dead code") become one graph query instead of N grep/read cycles. Directly lowers
   the token bill on the cheapest-but-most-frequent tier.
2. **`/close-sprint` rule CHECKs** — boundary and dead-code CHECKs (`folder-structure.md`,
   `code-quality.md`) become deterministic `query_graph` calls with `file:line` evidence — *stronger* audit
   evidence, not just cheaper.
3. **`/midas-adopt` inventory** — `get_architecture` replaces a slow tree-walk for the as-built map.
4. **`/midas-tribunal` evidence packs** — Round-0 scout assembles citations faster and more completely.

### What does NOT change

- Methodology, phases, gates, rules-as-law — untouched.
- `product/adr/*` stay git-committed markdown (the MCP's ADR store is not adopted).
- Tool-agnostic portability — projects without the MCP behave exactly as today (grep/read fallback).

### Risks / costs

- **Adds an optional binary dependency** for those who enable it.
- **Unverified vendor claims** — do not parrot them; verify first.
- **Graph staleness** — auto-sync mitigates, but `/close-sprint` must treat the graph as a *hint*, with
  the diff + tests as the authority.
- **Scope creep** — easy to over-integrate. Keep it to: optional MCP + habit rule + prose notes.

## Considered alternatives

| Alternative | Pros | Cons | Reason rejected |
|---|---|---|---|
| **Do nothing** | Zero work, zero dependency | Scout keeps burning tokens on grep/read | The cost is real and recurring |
| **Mandate the MCP in scout** | Maximal token savings | Breaks tool-agnostic / recommend-don't-wall; binary dependency | Violates core Midas philosophy |
| **Adopt its `manage_adr` too** | One ADR store | Ephemeral/local vs git-committed law; competes with `product/adr/*` | Conflicts with versioned-source-of-truth |
| **Build our own indexer** | No third-party | Huge scope; off-mission (Midas is markdown, not a C engine) | Not worth it |
| **Optional MCP + habit rule (chosen)** | No lock-in; opt-in cost; fallback intact; mirrors Context7 | Two doc-tool patterns to maintain | Accepted — bounded, reversible, on-philosophy |

## Plan (phased)

### Phase 0 — Validate the premise (blocking gate, no engine edits)
- Wire the MCP locally; index this repo (`harness/`, `scripts/`, `create-midas/`).
- Run a head-to-head on 2–3 real `scout` tasks (inventory, a boundary CHECK, a dead-code scan): record
  **tokens + wall-clock** for grep/read vs graph query.
- **Exit criterion:** a measurable, non-trivial token/latency win on at least one real Midas task. If not,
  stop here and keep the ADR as `rejected` with the evidence.

### Phase 1 — Land the opt-in surface (small, additive)
- `harness/templates/mcp.json.tmpl`: commented `{{!code-graph}}` block (local command, no auth).
- `harness/rules/code-intelligence.md`: always-on habit rule + `**CHECK:**` + grep fallback.
- Re-render adapters (`render-adapters.mjs`), rebuild bundles (`build-create.mjs`, `build-plugin.mjs`),
  add a `rule:code-intelligence:*` structural check to `scripts/test.mjs`.

### Phase 2 — Wire the habit into the flow (prose only)
- Integration notes in `/midas-adopt`, `/close-sprint`, `/midas-tribunal`, and the `midas-scout` agent:
  "prefer a graph query when a code-intelligence MCP is wired; the diff + tests remain the authority."
- Update `docs/faq.md` ("Do I need it? No — optional, free, local") and `INSTALL.md`.

### Phase 3 — Ship
- Version bump + CHANGELOG under a new release; pin docs.
- Recommendation in docs only **after** Phase 0 evidence is recorded.

## Consequences

### Positive
- Cuts the dominant scout-tier exploration cost; turns several grep-based CHECKs into deterministic,
  better-evidenced graph queries.
- Stays free/local/no-key — consistent with the Context7 stance just adopted.
- Fully reversible; non-adopters are unaffected.

### Negative / trade-offs
- A second optional doc/intel tool pattern to document and keep coherent with Context7.
- Introduces an optional binary dependency and a vendor to track.

### Risks
- Headline performance claims unverified → **Phase 0 gate is mandatory** before any user-facing rec.
- Graph staleness → the rule must state the diff/tests are authoritative; the graph is a hint.

---

*Engine-scoped. When accepted, link from `docs/repository-architecture.md`, register in `mkdocs.yml`,
and proceed only through the phased plan above (Phase 0 evidence first).*
