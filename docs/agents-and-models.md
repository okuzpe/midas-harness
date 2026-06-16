# Agents & models — the single bump point

**All model IDs in Keel live here.** Skills and rules reference *tier names* (`orchestrate`,
`build`, `scout`), not literal model IDs, wherever possible. When a new model ships, update this
file and the three agent files in `.claude/agents/` — nowhere else.

## Tiers (the balanced default)

| Tier | Role | Default model ID | Use for |
|---|---|---|---|
| `orchestrate` | think / plan / audit / decide | `claude-opus-4-8` | Phase 1 gap loop, Phase 4 stack choice, Phase 8 audit, code-review, security-review — the ~6 irreversible decisions |
| `build` | implement / write artifacts | `claude-sonnet-4-6` | Phase 7 implementation, writing docs/ADRs/sprint files, tests |
| `scout` | search / extract / mechanical / status | `claude-haiku-4-5` | Context7 fetches, file/status extraction, `/keel-status` |

## Cost profiles

| Profile | orchestrate | build | scout |
|---|---|---|---|
| `balanced` (default) | `claude-opus-4-8` | `claude-sonnet-4-6` | `claude-haiku-4-5` |
| `max_savings` | `claude-sonnet-4-6` (only escalates to Opus on Phase 4/8 audits) | `claude-sonnet-4-6` | `claude-haiku-4-5` |
| `max_quality` | `claude-opus-4-8` | `claude-opus-4-8` (Sonnet for bulk) | `claude-haiku-4-5` |

The active profile is recorded in `harness/state.yaml -> routing`.

## First-party agents (self-contained, zero external dependency)

`.claude/agents/keel-orchestrator.md` (`model: claude-opus-4-8`),
`.claude/agents/keel-builder.md` (`model: claude-sonnet-4-6`),
`.claude/agents/keel-scout.md` (`model: claude-haiku-4-5`).

These always work on a clean install. The built-in `Explore` agent (Haiku, read-only) is a valid
substitute for `keel-scout` on research tasks.

## Optional enrichment (only if installed)

If the user has these packs, skills may prefer the matching specialist; otherwise they degrade to
the first-party agents above. **Never depend on them; never mutate vendor files** — wrap with a
thin agent if a vendor's pinned model disagrees with the desired tier.

| Need | Preferred specialist (if present) | Falls back to |
|---|---|---|
| Architecture review | `voltagent-qa-sec:architect-reviewer`, official `feature-dev:code-architect` | `keel-orchestrator` |
| Code review | `voltagent-qa-sec:code-reviewer`, `/code-review` | `keel-orchestrator` |
| Security review | `voltagent-qa-sec:security-auditor` | `keel-orchestrator` |
| Backend / frontend build | `voltagent-core-dev:backend-developer` / `frontend-developer` | `keel-builder` |
| UI / design system | `voltagent-core-dev:ui-designer`, `frontend-design` | `keel-builder` |
| Research | built-in `Explore`, `/deep-research` | `keel-scout` |

## Non-Claude tools

Cursor / Copilot / Windsurf lack per-subagent model tiering. There, the tiers collapse to **prose
intent** in `AGENTS.md` ("use your fastest model for research, your strongest for architecture").
Methodology and MCP are fully preserved; only automatic cost-routing is lost.
