# ADR-014: Adapter CHECK digest on demand

## Status

Accepted — 2026-08-27

Supersedes the **adapter digest** clause of [ADR-005](ADR-005-agents-md-generation.md) (engine
`AGENTS.md` remains a curated summary; that half of ADR-005 is unchanged).

## Context

Cursor's generated always-on adapter (`.cursor/rules/00-midas.mdc`, `alwaysApply: true`) is the
default install shape ([ADR-008](ADR-008-thin-root-allowlist.md)). Measured on 2026-08-27 in this
engine repo:

| Surface | Characters | Approx. tokens (chars/4) |
|---|---:|---:|
| `.cursor/rules/00-midas.mdc` total | 51 472 | ~12 868 |
| CHECK digest section (`## Always-on rules`) | 41 735 (81%) | ~10 434 |
| `GEMINI.md` / Windsurf adapter (same body) | ~51 k each | ~12.8k each |
| `CLAUDE.md` (pointer only; Claude reads `rules/` natively) | 726 | ~182 |

`scripts/render-adapters.mjs` `computeChecksIndex` tags every structured CHECK `phase: 8`. The
2026-08-27 `harness/checks.json` snapshot has **232 CHECKs**, all `phase: 8`, **235** `**CHECK:**`
lines inlined in the adapter. Phase-8 audit criteria therefore occupy the always-on budget of
Phases 0–7 and of work that is not a Midas audit.

ADR-005 Option A kept the full digest inline. Option B (title-only digest + links) was deferred
explicitly as “token savings vs audit visibility.” Option B would have **dropped CHECK bodies**,
so auditors would lose the text they grade against unless they opened each rule file.

The 2026-08-27 engine audit found a third option that ADR-005 did not consider: keep the **full**
CHECK bodies, but load them only when the host can route them (Cursor `alwaysApply: false` +
description; Windsurf on-demand trigger when the docs support it). Gemini CLI has no on-demand
rule file — `GEMINI.md` is always project memory — so Gemini cannot use the same split.

Project overlays (`<paths.rules>/`) already merge into the same digest via `readRulesDigest`.
Those overlay CHECKs are also Phase-8 audit material.

## Decision

**Option C (on-demand full digest)** is the active adapter strategy:

1. **Cursor** — split into two generated files:
   - `.cursor/rules/00-midas.mdc` — `alwaysApply: true` — conventions + Context7 section only.
   - `.cursor/rules/01-midas-checks.mdc` — `alwaysApply: false` — full CHECK digest (base rules
     **and** project overlays). Description must name Phase-8 / conformance audit so the host
     can attach it when the agent is auditing.
2. **Windsurf** — same split when the current Windsurf rule-file docs document an on-demand
   trigger (fetch before coding; note the version at the call site). If no on-demand trigger
   exists, keep the digest inline in the Windsurf `always_on` file (Cursor + Gemini still
   optimise).
3. **Gemini** — do **not** inline the digest in `GEMINI.md`. Point at `<paths.engine>/checks.json`
   and `<paths.engine>/rules/` (plus `<paths.rules>/` overlays). Gemini has no deferred-load
   surface.
4. **Claude Code** — unchanged: managed `CLAUDE.md` stays a short pointer; Claude reads
   `rules/` natively.
5. Overlay CHECKs travel with the digest (on-demand file), not with the always-on conventions
   file. Splitting by origin (base always-on / overlay always-on) would duplicate load criteria
   without a Phase-8 benefit.

Option B (title-only) remains rejected: it trades away the audit text. Option A (full inline) is
superseded for Cursor/Gemini (and Windsurf when on-demand is documented).

## Considered alternatives

| Alternative | Pros | Cons | Reason rejected |
|---|---|---|---|
| Option A — keep full digest always-on | Maximum audit visibility with zero extra attach | ~10.4k tokens every Cursor/Gemini/Windsurf turn; default `--tools=cursor` install pays it | Cost is the default product shape, not a niche |
| Option B — title-only digest + links | Smaller always-on file | Auditors lose CHECK bodies unless they open every rule | Same trade-off ADR-005 deferred; weaker than Option C on visibility |
| Filter digest by stack (drop visual-design if no UI) | Partial savings while staying always-on | Heuristics miss UI-later projects; still loads 200+ CHECKs on non-audit turns | Incomplete vs split |
| Keep overlay CHECKs always-on, base digest on-demand | Project policy always in context | Two load rules; overlay CHECKs are still Phase-8 | Rejected; overlays follow the digest |

## Consequences

### Positive

- Default Cursor sessions drop ~10k always-on tokens while **keeping** the 232 CHECK bodies for
  Phase-8 / doctor / conformance work.
- `harness/checks.json` stays the structured index; Gemini points at it instead of duplicating
  prose.
- Overlay rules remain visible to auditors (same digest file).

### Negative / trade-offs

- Cursor must **attach** `01-midas-checks.mdc` for a thorough rule audit. Description +
  `/close-sprint` / `/midas-doctor` path-pass are the mitigation.
- Gemini never had on-demand files; auditors there must open `checks.json` / `rules/`.
- Windsurf may stay on Option A if docs do not name an on-demand trigger.
- Installer allowlist, orphan prune, uninstall, ownership, CI smokes, and `GATE_ROWS` gate-05
  evidence must list the extra Cursor (and possibly Windsurf) path — omitting it fails
  `layout:root-allowlist` and leaves orphans.

### Risks

- `selectedPaths` in `render-adapters.mjs` filters by exact path. A new file added to `allFiles`
  but not to the selected-path set is silently not written. Tests must assert Cursor emits both
  paths.
- Agents may skip the on-demand file. Mitigation: description names Phase 8; close-sprint /
  doctor skills name the path; conventions still always-on.

## Context7 verification log

```
Library: n/a (host adapter layout; Windsurf trigger fetched in implementation Phase 2a)
Resolved ID: n/a
Version: n/a
Docs fetched: 2026-08-27 (measurement); Windsurf trigger TBD at implementation
Key finding: Cursor alwaysApply false is the documented on-demand mechanism; Gemini has none.
```
