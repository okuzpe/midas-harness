# Engine precommit quality gate

**Scope:** midas-harness **engine repository only** (`package.json` `name: midas-harness`).
Product installs must **not** run this gate — use `/midas-align` + `/midas-doctor` instead.

**Skill:** `/midas-precommit`  
**Mechanical floor:** `node scripts/precommit-eval.mjs`  
**Skill linter (canonical):** `node scripts/skill-quality-check.mjs` — mechanical checks on `harness/skills/` and `harness/agents/` (not ESLint). Precommit uses `--staged --strict-warns` only; full-engine scan (0 warns) runs in CI via `scripts/test.mjs`.  
**Pass bar:** overall weighted score **≥ 80**. Below 80 → `verdict=fail` → **do not commit**.

---

## Contributor ladder

| When | Command |
|------|---------|
| Before commit (fast) | `npm run precommit` |
| Staged skills/agents only | `node scripts/skill-quality-check.mjs --staged --strict-warns` |
| Before PR / release | `npm run verify` (`test` + `build` + `doctor`) |
| Qualitative bar ≥ 80 | `/midas-precommit` (agent scorecard + mechanical floor) |

Optional git hook: see [CONTRIBUTING.md](../CONTRIBUTING.md) § Git hooks.

---

## Dimensions (score each 1–100)

Equal weight. Overall = arithmetic mean, rounded to nearest integer.

| ID | Dimension | What to judge |
|---|---|---|
| `architecture` | Architecture | State spine, installer layers, mirror ownership, autonomy boundaries |
| `security` | Security | MCP/secrets, installer trust, autonomy authz, supply-chain pins |
| `agentic_design` | Agentic design | Tiers, producer≠auditor, side-effect guards, delegation honesty |
| `testing` | Testing | `scripts/test.mjs` coverage, CI, behavioral vs structural balance |
| `reliability` | Reliability | Rollback, fail-closed paths, race/lease honesty, release workflows |
| `documentation` | Documentation | INSTALL/SECURITY/VERSIONING accuracy, catalog, contributor truth |
| `simplicity` | Simplicity | Lean ladder, duplication, unfinished refactors, ceremony weight |
| `developer_experience` | Developer experience | Install/diagnose UX, contributor friction, orientation skills |
| `code_quality` | Code quality | Correctness footguns, error contracts, split-brain implementations |
| `maintainability` | Maintainability | Module size, dead code paths, single execute path, test modularity |
| `change_propagation` | Change propagation | Align ladder, mirror drift, version single-source, template fidelity |
| `methodology_fitness` | Methodology fitness | 9-phase completeness, fixture honesty (product-closed), gate mechanization |

---

## Scoring guidance (anchors)

| Band | Meaning |
|------|---------|
| 90–100 | Exemplary; few residual risks; mechanized where it matters |
| 80–89 | Solid production bar — **minimum to commit** when overall ≥ 80 |
| 70–79 | Usable but material gaps; must not pass overall if they pull mean &lt; 80 |
| &lt; 70 | Structural debt or unsafe path — call out as blocking findings |

**Auto-fail (overall = fail regardless of mean):**

1. Mechanical floor failed (`precommit-eval` exit ≠ 0).
2. Any **Critical** security finding (committed secret, default high-privilege MCP, unauthenticated RCE on default path).
3. Not engine repo (skill must abort).

---

## Modes

| Mode | When | Method |
|------|------|--------|
| `--quick` (default) | Everyday commit | One agent pass over diff + mechanical floor; score all 12 dims |
| `--full` | Release / large refactor | Fan out cheap scout/build subagents per cluster; then synthesize |

---

## Required tally

```text
MIDAS_PRECOMMIT_RESULT: overall=N threshold=80 verdict=pass|fail mechanical=ok|fail dims_below_80=N
```

`verdict=pass` only when `mechanical=ok` **and** `overall >= 80` **and** no Critical security finding.
