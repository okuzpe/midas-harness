# Agents & models — the single bump point

**All model IDs in Midas live here.** Skills and rules reference *tier names* (`orchestrate`,
`build`, `scout`), not literal model IDs, wherever possible. When a new model ships, update this
file and the three agent files in `.claude/agents/` — nowhere else.

## Tiers (the balanced default)

| Tier | Role | Default model ID | Use for |
|---|---|---|---|
| `orchestrate` | think / plan / audit / decide | `claude-opus-4-8` | Phase 1 gap loop, Phase 4 stack choice, Phase 8 audit, code-review, security-review — the ~6 irreversible decisions |
| `build` | implement / write artifacts | `claude-sonnet-4-6` | Phase 7 implementation, writing docs/ADRs/sprint files, tests |
| `scout` | search / extract / mechanical / status | `claude-haiku-4-5` | Context7 fetches, file/status extraction, `/midas-status` |

## Cost profiles

| Profile | orchestrate | build | scout |
|---|---|---|---|
| `balanced` (default) | `claude-opus-4-8` | `claude-sonnet-4-6` | `claude-haiku-4-5` |
| `max_savings` | `claude-sonnet-4-6` (only escalates to Opus on Phase 4/8 audits) | `claude-sonnet-4-6` | `claude-haiku-4-5` |
| `max_quality` | `claude-opus-4-8` | `claude-opus-4-8` (Sonnet for bulk) | `claude-haiku-4-5` |

The active profile is recorded in `harness/state.yaml -> routing`.

## Local & hybrid execution (where the tiers run)

`cost_profile` picks *which* Claude model a tier uses; **`execution_mode`** (in `state.yaml`) picks
*where* the tier runs. The two axes are orthogonal. Default `cloud` keeps every tier on Claude.

| `execution_mode` | orchestrate | build | scout | When |
|---|---|---|---|---|
| `cloud` (default) | Claude | Claude | Claude | Frontier quality everywhere; the baseline. |
| `hybrid` | **Claude (always)** | local *or* Claude | local *or* Claude | Run high-volume build/scout on a local open model; keep the ~6 irreversible decisions on Claude. |
| `local` | Claude (⚠ else un-attested) | local | local | Fully offline build/scout. A gate verdict produced without Claude is recorded `un-attested` — advisory, never gate-advancing. |

**Why `orchestrate` never goes local.** Independent 2026 evidence is consistent: local open-weight
models are weakest exactly at multi-step planning and audit — the work the `orchestrate` tier exists
to do — and benchmark rank does not predict real coding ability. So Phase 1/3/4/8 gate verdicts and
code/security review **always route to Claude cloud**, even under `hybrid`/`local`. This is enforced by
`harness/rules/model-routing.md`.

### What fits on consumer hardware (approximate, mid-2026 — verify before relying)
Local-model releases and quantization move monthly; treat exact sizes/throughput as rough anchors, and
validate any pick on a real repo task, not a leaderboard (models hit a "context cliff" well before
their advertised window).

| Host VRAM / unified memory | Realistic local tier | Example open model (Q4_K_M) | Notes |
|---|---|---|---|
| **8 GB** | `scout` only (assist) | a ≤9B model | Cannot usefully run 12–14B — agentic coding spills to CPU → single-digit tok/s. Route `build` to cloud. |
| **16 GB** | `scout` + light `build` | a 12–14B-class model | Workable for small features; watch the context cliff. |
| **24 GB** (GPU or Apple Silicon) | `scout` + `build` | a ~30B **MoE** coder, e.g. Qwen3-Coder 30B (≈17–18 GB) | The practical sweet spot. MoE (few active params) is *why* a 30B fits. Long context eats KV-cache — usable context is moderate, not the advertised window. |

**Runtime:** for single-user local coding use `llama.cpp` / Ollama / LM Studio. `vLLM` only pays off
serving many concurrent users on data-center GPUs — not this use case.

## First-party agents (self-contained, zero external dependency)

`.claude/agents/midas-orchestrator.md` (`model: claude-opus-4-8`),
`.claude/agents/midas-builder.md` (`model: claude-sonnet-4-6`),
`.claude/agents/midas-scout.md` (`model: claude-haiku-4-5`).

These always work on a clean install. The built-in `Explore` agent (Haiku, read-only) is a valid
substitute for `midas-scout` on research tasks.

## Optional enrichment (only if installed)

If the user has these packs, skills may prefer the matching specialist; otherwise they degrade to
the first-party agents above. **Never depend on them; never mutate vendor files** — wrap with a
thin agent if a vendor's pinned model disagrees with the desired tier.

| Need | Preferred specialist (if present) | Falls back to |
|---|---|---|
| Architecture review | `voltagent-qa-sec:architect-reviewer`, official `feature-dev:code-architect` | `midas-orchestrator` |
| Code review | `voltagent-qa-sec:code-reviewer`, `/code-review` | `midas-orchestrator` |
| Security review | `voltagent-qa-sec:security-auditor` | `midas-orchestrator` |
| Backend / frontend build | `voltagent-core-dev:backend-developer` / `frontend-developer` | `midas-builder` |
| UI / design system | `voltagent-core-dev:ui-designer`, `frontend-design` | `midas-builder` |
| Research | built-in `Explore`, `/deep-research` | `midas-scout` |

## Non-Claude tools

Cursor / Copilot / Windsurf lack per-subagent model tiering. There, the tiers collapse to **prose
intent** in `AGENTS.md` ("use your fastest model for research, your strongest for architecture").
Methodology and MCP are fully preserved; only automatic cost-routing is lost.
