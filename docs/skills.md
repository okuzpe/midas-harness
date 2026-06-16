# Skills reference

Every skill is a markdown file under `.claude/skills/<name>/SKILL.md`. Skills are read natively by
Claude Code, Cursor, Copilot, Codex, Windsurf, and Gemini — no per-tool copies.

---

## Phase skills

| Command | Phase | One-line description | Tier |
|---|---|---|---|
| `/idea-intake` | 0 | Capture the raw product idea and initialize `harness/state.yaml`. | orchestrate |
| `/contextualize` | 1 | Gap loop — generate and rank blocking questions until zero blockers remain. | orchestrate |
| `/market-research` | 2 | Validate the idea against the real market; synthesize competitor matrix + differentiation thesis. | orchestrate |
| `/business-plan` | 3 | Turn the validated opportunity into a go/no-go business case with measurable success metrics. | orchestrate |
| `/choose-architecture` | 4 | Pin the tech stack and write `product/architecture.md` plus one ADR per decision. | orchestrate |
| `/define-conventions` | 5 | Freeze architecture-as-rules and design system; re-render tool adapters. THE keystone. | orchestrate |
| `/plan-sprints` | 6 | Decompose the MVP into a dependency-ordered roadmap and per-sprint plans. | orchestrate |
| `/start-sprint` | 7 | Kick off a sprint — pre-audit living code against frozen rules, emit the working plan. | orchestrate |
| `/close-sprint` | 8 | Per-sprint conformance audit; resolve drift, freeze verdict, select next sprint or declare ship. | orchestrate |

---

## Lifecycle and utility skills

| Command | Role | One-line description | Tier |
|---|---|---|---|
| `/midas-init` | Setup | Conversational installer — asks ~8 questions, writes state and adapters. Run once per project. | orchestrate |
| `/midas-status` | Navigation | Read-only — print current phase, gate status, and single next action. | scout |
| `/midas-adopt` | Brownfield | Adopt Midas into an existing project — inventory, reverse-engineer rules, baseline audit. | orchestrate |
| `/midas-doctor` | Maintenance | Re-derive generated adapters from `harness/conventions.md`, diff against disk, re-render. | build |
| `/midas-tribunal` | Audit | Whole-project adversarial debate — Defense vs Prosecution vs Catfish; Opus judges per claim. | orchestrate |

---

## Skill properties

Each `SKILL.md` frontmatter declares:

- `harness-tier` — the cost tier (`orchestrate` / `build` / `scout`).
- `recommended-model` — the canonical model ID for that tier.
- `disable-model-invocation: true` — side-effecting or irreversible skills that must only run on
  explicit user invocation. They open with a guard block that stops inference-triggered execution.
- `mcp-required` — MCPs the skill depends on (`context7`, `sequential-thinking`, etc.).

---

## Notes

- Skills with `disable-model-invocation: true` include a guard: if the skill was reached by
  inference rather than explicit invocation, the agent stops and reports.
- The Brownfield doctrine applies to `/midas-adopt` and `/define-conventions`: no pre-existing
  `AGENTS.md` / `CLAUDE.md` / source is modified without a dry-run diff and explicit confirm.
- Run `/midas-doctor` after editing `harness/conventions.md` or any rule file to re-sync the
  generated tool adapters.
