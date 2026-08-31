# Skills reference

Every skill is a markdown file under **`harness/skills/<name>/SKILL.md`** (canonical). `npm run build`
renders host discovery trees; **which** tree appears at a repo root follows [ADR-008](adr/ADR-008-thin-root-allowlist.md)
(cursor-only install → `.cursor/skills/`; `claude-code` → `.claude/skills/`; portable peers →
`.agents/skills/`). The engine repo (tools include `claude-code` + portable hosts) keeps
`.claude/skills` + `.agents/skills` — not a root `.cursor/skills`. Internal and deprecated skills are
omitted from host mirrors ([ADR-013](adr/ADR-013-skill-user-surface.md)). **Claude Code** reads
`.claude/skills` natively; Cursor, Copilot and Codex via the Agent Skills standard where supported.
See the [tools matrix](https://github.com/okuzpe/midas-harness#supported-tools).

> **Canonical router.** `/midas-status` and `/midas-help` **cite this file** — they do not maintain a
> parallel situation→command table. Product installs: `<paths.engine>/docs/skills.md`.

## Surfaces (UX layers — ADR-013)

Orthogonal to **Delegator** (path-readability). Frontmatter `user-surface`:

| Surface | Meaning | Count |
|---|---|---|
| **primary** | Listed in this catalog’s primary tables and `/midas-help` options | 28 |
| **internal** | Path-pass under orchestrators (`/start-sprint`, `/close-sprint`, Phase 7 body); power-user may still type the slash | 5 |
| **deprecated** | Alias stubs — help must not list | 0 |
| **engine-only** | Engine-repo contributors (`/midas-precommit`, `/midas-sandbox`); omitted from product installs | 2 |

**v1+ host discovery:** mirrors (`.cursor` / `.claude` / `.agents`) omit `internal` + `deprecated`
skills (ADR-013). Bodies remain under `<paths.engine>/skills/` for path-pass.

### Layer map

| Layer | Job | Skills |
|---|---|---|
| **A Orient** | Where am I / what next / resume / install confusion | `/midas-status`, `/midas-help`, `/midas-recall`, `/midas-reconcile` |
| **B Lifecycle** | Setup + audited phase gates 0→8 | `/midas-init`, `/midas-adopt`, `/idea-intake` … `/close-sprint` |
| **C Sync** | Adapters / propagation / engine bar | `/midas-doctor`, `/midas-align`, `/midas-precommit` *(engine only)*, `/midas-sandbox` *(engine only)* |
| **D Autonomy** | Continuous evolve + ADR-009 checklist guide | `/midas-auto-pilot` |
| **E On-demand** | Audits, design, debug, hygiene, portability | `/midas-tribunal`, `/midas-security-audit`, `/midas-design`, `/midas-capture`, `/midas-investigate`, `/midas-explore`, `/midas-bundle`, `/midas-verify`, `/midas-retro`, `/midas-hygiene` |
| **Internal (delegated)** | Sprint rituals owned by parents | `/midas-progress`, `/midas-qa`, `/midas-diff-gates`, `/midas-lean-review`, `/midas-sweep` |

---

## Skill registry (machine index)

Human catalog (this file) uses slash-names. Agents that **delegate** use the generated path index:

| Layout | Path |
|---|---|
| Engine source | `harness/skill-registry.md` |
| Installs | `<paths.engine>/skill-registry.md` |

- **Refresh:** `node <paths.scripts>/skill-registry.mjs` or `npm run align` / `doctor --fix` (recompute-and-compare; no cache sidecar).
- **Columns:** Skill · Trigger/description · Scope · **Delegator** · **Surface** · Path.
- **Delegator contract:**
  - `yes` — parent may pass `<paths.engine>/<Path>` so a builder/scout **reads** the skill body. Does **not** bypass `disable-model-invocation` (still no Skill-tool / auto slash).
  - `orchestrator-only` — phase gates, install/sync, high-stakes audits; human slash / stage table only — never free-picked.
- **Surface contract:** see § Surfaces above — do not confuse with Delegator.
- **Never** dump the whole registry into a prompt — pass a matched subset only.
- **v1 scope:** Midas-owned engine skills only (no project/user overlays yet).
- Implementation size/ambiguity routing: `<paths.engine>/rules/organic-routing.md` (complements model-routing).
- Phase-7 tip: parents **path-pass** matching `internal` / `Delegator: yes` procedures (`midas-progress`, `midas-diff-gates`, `midas-qa`, `midas-lean-review`, `midas-sweep`) — read the body; do not Skill-tool invoke.

Catalog size: **28 primary** + **5 internal** + **0 deprecated** + **2 engine-only** (`/midas-precommit`, `/midas-sandbox`). Counts must match `harness/skill-registry.md` (recomputed by `npm run align`).

For entry → decision → state → handoff, see [Skill flows](skill-flows.md).

---

## Pipeline (phases 0–8) — primary

| Command | Phase | One-line description | Tier |
|---|---|---|---|
| `/idea-intake` | 0 | Capture the raw product idea and initialize state. | orchestrate |
| `/contextualize` | 1 | Gap loop until zero blocking open questions. | orchestrate |
| `/market-research` | 2 | Competitor matrix + differentiation + demand verdict. | orchestrate |
| `/business-plan` | 3 | Go/no-go business case with measurable success metrics. | orchestrate |
| `/choose-architecture` | 4 | Pin stack; write architecture + ADRs. | orchestrate |
| `/define-conventions` | 5 | Freeze rules + design system; re-render adapters. Keystone. | orchestrate |
| `/plan-sprints` | 6 | MVP → dependency-ordered roadmap and sprint plans. | orchestrate |
| `/start-sprint` | 7 | Kick off sprint — pre-audit living code vs frozen rules; set sprint and roadmap Status `active`. | orchestrate |
| `/close-sprint` | 8 | Conformance audit; set roadmap Status `done`; next sprint or ship. | orchestrate |

Stage → command map (runtime): `<paths.engine>/stage-command-table.yaml` (generated from
`STAGE_ROWS` in `scripts/stage-command-table.mjs`).

---

## Orient — primary

| Command | One-line description | Tier |
|---|---|---|
| `/midas-status` | Pipeline PC — phase, gate status, **single** next command. | scout |
| `/midas-help` | Interactive intent → one **primary** command (AskQuestion). | scout |
| `/midas-recall` | Context pack (~15 paths + brief) to resume after a break. | scout |
| `/midas-reconcile` | Install/setup/version/cwd check → one next CLI or slash command. | scout |

---

## Sprint day — primary

| Command | One-line description | Tier |
|---|---|---|
| `/midas-design` | Product-authentic redesign — 3 directions → pick → spec → one slice; `{runs}/design/`. | orchestrate |
| `/midas-verify` | Sprint UI/API gate evidence → `verify-NN.md` (incl. authenticity; before close). | build |
| `/midas-explore` | Investigation outside the pipeline → `{runs}/explore/`. | scout |
| `/midas-investigate` | Root-cause before bug fixes (Iron Law + 3 strikes) → `{runs}/investigate/inv-NN.md`. | build |
| `/midas-capture` | Recurring pattern → rule / playbook / convention (asks first). | build |
| `/midas-auto-pilot` | Unified autonomy — ask evolve vs sprint checklist; PR\|code or CLI setup/status/tick; arms `/loop` for evolve. | build |
| `/midas-retro` | Sprint retrospective freeze → `{runs}/retros/retro-NN.md` (non-advancing). | build |
| `/midas-hygiene` | Product-repo cleanup — path-passes sweep (`product`) + optional lean-review; not adapter/doctor sync. | build |

---

## Delegated procedures — internal (not in `/midas-help` primary options)

Parents **path-pass** these `SKILL.md` bodies (read + execute steps in the same run). Power-users may still type the slash. **Not** Skill-tool / auto-slash.

| Command | Natural parent | One-line description | Tier |
|---|---|---|---|
| `/midas-progress` | `/start-sprint` + Phase 7 body | Write STM — `{runs}/sprints/NN-progress.md` after tasks. | build |
| `/midas-qa` | Phase 7 inner loop / status | Ad-hoc branch/PR smoke (non-gate); does **not** replace verify. | build |
| `/midas-diff-gates` | `/close-sprint` Step 0.5 | Diff-scoped test/quality receipts → `{paths.cache}/gates/<run>/`. | build |
| `/midas-lean-review` | `/close-sprint` / fat-diff | Over-engineering delete-list (stdlib/native/yagni/shrink). | build |
| `/midas-sweep` | `/close-sprint`, `/midas-adopt`, status | Dead flows, orphans, ledger drift; optional `--fix`. | build |

---

## Autonomy commands (one slash)

| Goal | Command | What it does |
|---|---|---|
| **Unified entry** (ask evolve vs sprint vs stop) | `/midas-auto-pilot` | Mode gate Ask when bare; then PR\|code or ADR-009 CLI guide. |
| **Discover and fix** on a schedule | `/midas-auto-pilot` → Continuous evolve | Ask PR\|code once; local `/loop`; journal at `{runs}/auto-pilot/`. |
| Cursor cloud scheduler (optional) | `/midas-auto-pilot cloud` | Emits runbook for Cursor `/automate` / cursor.com/automations. |
| Stop the local loop | `/midas-auto-pilot stop` | Kills the armed `/loop` for this project. |
| **Next sprint checklist line** (policy/budget/lease) | `/midas-auto-pilot` → Sprint checklist · or `/midas-auto-pilot setup` | Guide to ADR-009 CLI (`midas-autopilot.mjs`). Needs `--autonomy`. |

**Anti-typo (do not confuse):**

| Token | Role |
|---|---|
| `/midas-auto-pilot` | Canonical unified autonomy guide |
| `midas-autopilot.mjs` | ADR-009 controller CLI (npm bin — **unchanged**) |

**Not the same:** Cursor’s native `/automate` is the Automations editor; `/midas-auto-pilot` is the Midas runbook + caps (+ sprint CLI guide). History: `/midas-automate` → `/midas-auto-pilot` (≤2.6.0) → `/midas-improve-loop` (2.6.1) → `/midas-auto-pilot` reclaimed (2.8.2) → unified with sprint guide (2.9.5).
---

## Maintain + audit + setup — primary

| Command | Role | One-line description | Tier |
|---|---|---|---|
| `/midas-init` | Setup | Onboarding entry — diagnose then install tip / adaptive intake / `update` tip; optional `--monorepo`. | orchestrate |
| `/midas-adopt` | Brownfield | Inventory, reverse-engineer rules, baseline audit. | orchestrate |
| `/midas-hygiene` | Hygiene | Product-repo dead flows, ledger/doc drift, optional lean delete-list. | build |
| `/midas-doctor` | Sync | Adapter drift + install health; re-render adapters. | build |
| `/midas-align` | Sync | Full propagation matrix (engine/product) + gap report. | build |
| `/midas-precommit` | **Engine only** | Harness fitness scorecard; overall ≥ 80 required before commit. Not shipped to installs. | orchestrate |
| `/midas-sandbox` | **Engine only** | Real-skill dry-run on `composer-2.5` (never `-fast`) against `sandbox/example-product/`; traced findings. Not shipped to installs. | build |
| `/midas-bundle` | Portability | Export/import knowledge JSON via `bundle.mjs`. | build |
| `/midas-tribunal` | Audit | Adversarial debate — decisions right? (non-advancing). | orchestrate |
| `/midas-security-audit` | Audit | OWASP/STRIDE deep scan (non-advancing). | orchestrate |

Hygiene / lean / progress / qa / diff-gates / sweep live under **Delegated procedures** (parents path-pass) except primary `/midas-hygiene`.

---

## Which command when? (canonical router)

Use **`/midas-status`** for the single next lifecycle step. Use this table when unsure *which* skill.
Prefer **primary** slash names; internals are noted as parent-owned.

| Situation | Command |
|---|---|
| Install confusion (missing, wrong cwd, version behind) | `/midas-init` (or `/midas-reconcile` read-only) |
| Where am I in the pipeline? | `/midas-status` |
| Unsure which command fits my intent | `/midas-help` |
| Resuming after a break | `/midas-recall` |
| Ad-hoc investigation outside the pipeline | `/midas-explore` |
| Root-cause debug before fixing a bug | `/midas-investigate` |
| One-time setup / engine refresh tip (+ optional monorepo) | `/midas-init` [`--monorepo`] |
| Existing codebase, no Midas yet | `/midas-adopt` (or `/midas-init` which may call it) |
| Edited conventions/rules | `/midas-doctor` |
| Edited engine / installer / skills / VERSION | `/midas-align` then `/midas-precommit` (engine) |
| Before commit on midas-harness | `/midas-precommit` (overall ≥ 80) |
| Dry-run a skill/rule change against a real fixture before committing | `/midas-sandbox` (engine) |
| Sprint UI proof (gate evidence) | `/midas-verify` |
| Production diff test/quality receipts (before close) | `/close-sprint` (path-passes `/midas-diff-gates`) |
| Redesign / improve UI (think before JSX) | `/midas-design` |
| Quick PR/branch smoke test | Phase 7 path-pass `/midas-qa` (or type it) |
| Dead code / ledger drift | `/midas-hygiene` (or `/close-sprint` Step 0) |
| Over-engineered diff / what can we delete? | `/midas-hygiene lean` (or close path-pass lean-review) |
| Bounded sprint ticks (one checklist task per tick) | `/midas-auto-pilot` (Sprint checklist / `setup`) → `node .harness/autonomy/bin/midas-autopilot.mjs setup` |
| Continuous improve (discover → one fix → PR or local code) | `/midas-auto-pilot` (Continuous evolve; arms `/loop`) · `cloud` for Cursor Automations |
| Sprint retrospective (learnings freeze) | `/midas-retro` |
| Export/import knowledge | `/midas-bundle` or `node <paths.scripts>/bundle.mjs` |
| Mid-sprint STM write | Phase 7 / `/start-sprint` path-pass `/midas-progress` |

**Audits** (shared fragments: `<paths.engine>/templates/audit-checklists.md`):

| Need | Command | Advances gates? |
|---|---|---|
| Sprint conformance (Phase 8) | `/close-sprint` | **Yes** |
| Sprint retrospective (learnings) | `/midas-retro` | No |
| Root-cause investigation (Iron Law) | `/midas-investigate` | No |
| Were decisions right? | `/midas-tribunal` | No |
| Deep security (OWASP/STRIDE) | `/midas-security-audit` | No |

---

## Skill properties

Each `SKILL.md` frontmatter declares:

- `harness-tier` — `orchestrate` / `build` / `scout`
- `recommended-model` — canonical model id for that tier
- `disable-model-invocation: true` — side-effecting; user-typed only (or parent path-pass read)
- `user-surface` — `primary` \| `internal` \| `deprecated` (default `primary`; see ADR-013)
- `mcp-recommended` / `mcp-required` — advisory vs hard need (doctor warns)

State ritual (shared): `<paths.engine>/templates/skill-state-ritual.md`.

---

## Authoring quality

Score material skill changes with the [skill quality gate](skill-quality-gate.md).
Rule: `harness/rules/skill-quality.md`. Mechanical: `npm run skill-quality`.

---

## Notes

- Brownfield doctrine: `/midas-adopt` and `/define-conventions` never modify pre-existing
  `AGENTS.md` / adapters / source without dry-run diff + confirm.
- After conventions/rules edits → `/midas-doctor`. After engine/skills/VERSION edits → `/midas-align`.
- Naming: phase gates are unprefixed (`/idea-intake`); utilities are `/midas-*`. Intentional.
- **Lean ladder** (`<paths.engine>/rules/lean-ladder.md` + internal `/midas-lean-review`) is Midas-native.
  Optional: install [Ponytail](https://github.com/DietrichGebert/ponytail) for host hooks /
  `lite|full|ultra` — prefer one always-on voice (see the rule's compose note).
- UX demote ≠ merge audits — see [ADR-013](adr/ADR-013-skill-user-surface.md) and [ADR-004](adr/ADR-004-audit-skill-surface.md).
