# Skills reference

Every skill is a markdown file under `.claude/skills/<name>/SKILL.md`. **Claude Code** reads them
natively (as skills + subagents); Cursor, Copilot and Codex read them via the Agent Skills standard
where supported. See the [tools matrix](../README.md#supported-tools) for the honest per-tool picture.

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
| `/midas-init` | Setup | Adaptive intake — scans the project (code + README/docs), classifies maturity (E0–E3), pre-fills what it can infer, asks only the gaps, places you at the right phase. Run once per project. | orchestrate |
| `/midas-status` | Navigation | Read-only — print current phase, gate status, and single next action. | scout |
| `/midas-adopt` | Brownfield | Adopt Midas into an existing project — inventory, reverse-engineer rules, baseline audit. | orchestrate |
| `/midas-doctor` | Maintenance | Re-derive generated adapters from `harness/conventions.md`, diff against disk, re-render. | build |
| `/midas-tribunal` | Audit | Whole-project adversarial debate — Defense vs Prosecution vs Catfish; Opus judges per claim. | orchestrate |
| `/midas-monorepo` | Scale | Set Midas up across a monorepo — nested `AGENTS.md` per package, per-package rules. | orchestrate |
| `/midas-verify` | Audit | Playwright-gated E2E/UI verification (UI sprints only) — per-claim verdict + screenshots. | build |
| `/midas-security-audit` | Audit | Deep security audit — OWASP ASVS 5.0 + Top 10 + LLM/Agentic Top 10, STRIDE threat model, runs Semgrep/SCA/gitleaks (recommends if absent), freezes a ranked findings report. Non-advancing. | orchestrate |
| `/midas-update` | Maintenance | Migrate an install to the current engine — dry-run + diff-confirm, bump version stamp. | build |
| `/midas-capture` | Learning | Crystallize a recurring request/correction into the right artifact (rule / playbook / convention) via a rubric. The agent proposes it on ~2-3 repeats (asks first); also invokable manually. | build |

---

## Skill properties

Each `SKILL.md` frontmatter declares:

- `harness-tier` — the cost tier (`orchestrate` / `build` / `scout`).
- `recommended-model` — the canonical model ID for that tier.
- `disable-model-invocation: true` — side-effecting or irreversible skills that must only run on
  explicit user invocation. They open with a guard block that stops inference-triggered execution.
- `mcp-recommended` — MCPs the skill suggests (`context7`, `sequential-thinking`, etc.) — advisory, not required.

---

## Notes

- Skills with `disable-model-invocation: true` include a guard: if the skill was reached by
  inference rather than explicit invocation, the agent stops and reports.
- The Brownfield doctrine applies to `/midas-adopt` and `/define-conventions`: no pre-existing
  `AGENTS.md` / `CLAUDE.md` / source is modified without a dry-run diff and explicit confirm.
- Run `/midas-doctor` after editing `harness/conventions.md` or any rule file to re-sync the
  generated tool adapters.
