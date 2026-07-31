# Skills reference

Every skill is a markdown file under `.claude/skills/<name>/SKILL.md`. **Claude Code** reads them
natively (as skills + subagents); Cursor, Copilot and Codex read them via the Agent Skills standard
where supported. See the [tools matrix](https://github.com/okuzpe/midas-harness#supported-tools) for the honest per-tool picture.

---

## Phase skills

| Command | Phase | One-line description | Tier |
|---|---|---|---|
| `/idea-intake` | 0 | Capture the raw product idea and initialize `.harness/state.yaml`. | orchestrate |
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
| `/midas-init` | Setup | Adaptive intake — scans the project, classifies maturity (E0–E3), pre-fills artifacts, places you at the right phase. Optional **`--monorepo`** wires nested `AGENTS.md` per package (Phase F). | orchestrate |
| `/midas-status` | Navigation | Read-only router — phase, gate status, single next action; includes a when-to-use-which-command table. | scout |
| `/midas-help` | Navigation | Interactive intent→command guide (AskQuestion); complements `/midas-status`, does not replace it. | scout |
| `/midas-reconcile` | Navigation | Read-only — install/setup/version/cwd check; single next CLI or slash command. | scout |
| `/midas-recall` | Navigation | Read-only context pack — ~15 priority paths + brief for resuming mid-phase/sprint. | scout |
| `/midas-explore` | Navigation | Ad-hoc investigation session outside the pipeline — notes under `{runs}/explore/`; `--end` may propose `/midas-capture`. | scout |
| `/midas-progress` | Phase 7 | Write STM — update `{runs}/sprints/NN-progress.md` after tasks (Done/Learned/Next). | build |
| `/midas-adopt` | Brownfield | Adopt Midas into an existing project — inventory, reverse-engineer rules, baseline audit. | orchestrate |
| `/midas-doctor` | Maintenance | Re-derive generated adapters from `harness/conventions.md`, diff against disk, re-render. | build |
| `/midas-align` | Maintenance | Full propagation pass — matrix + `npm run align` / doctor ladder + gap report (sources → bundles → versions → docs). | build |
| `/midas-tribunal` | Audit | Whole-project adversarial debate — Defense vs Prosecution vs Catfish; Opus judges per claim. | orchestrate |
| `/midas-monorepo` | Scale | **Deprecated** — use `/midas-init --monorepo`. Alias kept for backward compatibility. | build |
| `/midas-verify` | Audit | Sprint UI verification — **agent-browser** CLI (preferred) or Playwright MCP; Chrome DevTools runtime health; **Maestro MCP** for native (`--scope web\|mobile\|all`); device profiles; single `verify-NN.md` record (no `e2e/` in product). | build |
| `/midas-qa` | Phase 7 | Ad-hoc branch/PR QA — diff → routes; agent-browser / Maestro; optional `{runs}/qa/` record (non-gate). | build |
| `/midas-security-audit` | Audit | Deep security audit — OWASP ASVS 5.0 + Top 10 + LLM/Agentic Top 10, STRIDE threat model, runs Semgrep/SCA/gitleaks (recommends if absent), freezes a ranked findings report. Non-advancing. | orchestrate |
| `/midas-sweep` | Maintenance | Hygiene & dead-flow detection — orphan code, unreachable routes, stale docs, playbook/zombie triggers, `features.json` drift; optional `--fix` with explicit confirm. Freezes to `.harness/sweeps/`. | build |
| `/midas-update` | Maintenance | Migrate an install to the current engine — dry-run + diff-confirm, bump version stamp. | build |
| `/midas-capture` | Learning | Crystallize a recurring request/correction into the right artifact (rule / playbook / convention) via a rubric. The agent proposes it on ~2-3 repeats (asks first); also invokable manually. | build |
| `/midas-bundle` | Maintenance | Export/import portable JSON via `node .harness/scripts/bundle.mjs` — product knowledge, rules, evidence (no secrets). Skill wraps the script for agent-guided subset export. | build |

---

## Which command when? (router)

Use **`/midas-status`** for the single next lifecycle step. Use this table when you are unsure *which*
skill fits:

| Situation | Command |
|---|---|
| Install confusion (missing, wrong cwd, version behind) | `/midas-reconcile` |
| Where am I in the pipeline? | `/midas-status` |
| Unsure which command fits my intent | `/midas-help` |
| Resuming after a break | `/midas-recall` |
| Ad-hoc investigation outside the pipeline | `/midas-explore` |
| One-time setup (+ optional monorepo) | `/midas-init` [`--monorepo`] |
| Edited `harness/conventions.md` or rules | `/midas-doctor` |
| Edited engine / installer / skills | `/midas-align` |
| Sprint UI proof (gate evidence) | `/midas-verify` |
| Quick PR/branch smoke test | `/midas-qa` |
| Dead code / ledger drift | `/midas-sweep` |
| Export/import knowledge | `node .harness/scripts/bundle.mjs` |

**Audits** (shared fragments: `harness/templates/audit-checklists.md`):

| Need | Command | Advances gates? |
|---|---|---|
| Sprint conformance (Phase 8) | `/close-sprint` | **Yes** |
| Were decisions right? | `/midas-tribunal` | No |
| Deep security (OWASP/STRIDE) | `/midas-security-audit` | No |

---

## Skill properties

Each `SKILL.md` frontmatter declares:

- `harness-tier` — the cost tier (`orchestrate` / `build` / `scout`).
- `recommended-model` — the canonical model ID for that tier.
- `disable-model-invocation: true` — side-effecting or irreversible skills that must only run on
  explicit user invocation. They open with a guard block that stops inference-triggered execution.
- `mcp-recommended` — MCPs the skill suggests (`playwright`, `chrome-devtools`, `maestro`, `context7`, …) — advisory.
- `mcp-required` — MCPs the skill needs to run. If the server is not wired in `.mcp.json`, the skill must
  document a fallback or stop with a clear message — never silently skip. `node scripts/doctor.mjs` warns
  via `mcp:skill-required` (and `mcp:declared-vs-wired` for `state.yaml → mcp:` intent).

---

## Authoring quality

After creating or materially changing a skill, score it with the
[skill quality gate](skill-quality-gate.md) (10 dimensions /40; emit the required score block).
Always-on rule: `harness/rules/skill-quality.md` (engine) or `<paths.engine>/rules/skill-quality.md`
(install). Say `skill-quality <name>` (or Spanish equivalent) to score an existing skill without editing.

---

## Notes

- Skills with `disable-model-invocation: true` include a guard: if the skill was reached by
  inference rather than explicit invocation, the agent stops and reports.
- The Brownfield doctrine applies to `/midas-adopt` and `/define-conventions`: no pre-existing
  `AGENTS.md` / `.claude/CLAUDE.md` / source is modified without a dry-run diff and explicit confirm.
- Run `/midas-doctor` after editing `harness/conventions.md` or any rule file to re-sync the
  generated tool adapters.
- After substantive engine edits (skills, installer, VERSION, bundles), run `/midas-align` or
  `npm run align` — see `harness/rules/change-propagation.md`.
