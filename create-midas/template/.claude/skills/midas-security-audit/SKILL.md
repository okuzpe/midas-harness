---
name: midas-security-audit
description: Deep, standalone security audit grounded in OWASP ASVS 5.0 + the OWASP Top 10 — and the OWASP LLM Top 10 + Agentic AI Top 10 when the product uses AI. STRIDE-threat-models the architecture, runs the installed SAST/SCA/secret scanners (Semgrep, npm/pip audit, gitleaks) as real evidence and recommends them with exact commands when absent, prefers an installed security specialist, and freezes a per-finding severity+evidence+fix report to .harness/security/security-NN.md. Informational and non-advancing — it informs; /close-sprint and the human decide. Run on any product with a UI/API/data surface, especially before ship.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
argument-hint: "[--level L1|L2|L3] [--scope code|deps|secrets|design|all]"
---

# midas-security-audit — Deep Security Audit (OWASP ASVS + Top 10 + LLM/Agentic)

> **Run only when the user explicitly invokes this command.** If you arrived here by inference, STOP.
> First read `harness/state.yaml`; this is an advanced, non-advancing audit — never auto-run it.

A standalone, standard-grounded security audit — the security analog of `/midas-tribunal`. It does **not**
reinvent a scanner: it **orchestrates** a recognized standard as the checklist, runs the project's real
tools for evidence, and freezes a ranked findings report. It **complements** (does not replace):
- `harness/rules/security.md` — the always-on floor `/close-sprint` grades every Phase 8;
- `/midas-tribunal security` — the debate-style security lens.
Use this when you want a **deep, before-ship** audit against the current industry standard.

## What it grounds against (the standard, not vibes)
- **OWASP ASVS 5.0** (2025) — the verification checklist, at the level matched to the product's risk:
  **L1** (basic, public / low-risk), **L2** (most apps — the default), **L3** (high-value: payments,
  health, auth providers). `--level` overrides; otherwise **recommend** the level from data sensitivity.
- **OWASP Top 10** — the classic web risk lenses (broken access control, injection, crypto failures, SSRF…).
- **OWASP LLM Top 10 (2025) + Agentic AI Top 10** — added **automatically when the product uses an
  LLM / agent / RAG / tool-use**: prompt injection, system-prompt leakage, RAG/embedding poisoning,
  **excessive agency** (functionality / permissions / autonomy), insecure output handling, overreliance.
Fetch the current control text via Context7 / the OWASP site — never audit a standard from memory.

## Inputs (read first, write last)
- `harness/state.yaml`, `product/architecture.md` (attack surface + trust boundaries),
  `product/business-plan.md` (data sensitivity → the ASVS level), `harness/rules/security.md`.
- The codebase: UI / API / data / auth surfaces, dependency manifests, CI config, `.mcp.json` / agent config.

## Procedure

### 1. Scope + pick the ASVS level (recommend-don't-wall)
Resolve `--scope` (default `all`: code + deps + secrets + design) and `--level`. If `--level` is absent,
**recommend** L1/L2/L3 from the data the product handles (PII / payments / health → L3; typical SaaS → L2;
public read-only → L1) and proceed at the recommendation — the human can override. Decide whether the
product is **AI-bearing** (LLM / agent / RAG / tool-use in the architecture); if so, add the LLM/Agentic lenses.

### 2. Threat-model the design (STRIDE)
Over `product/architecture.md`'s components and trust boundaries, walk **STRIDE** (Spoofing, Tampering,
Repudiation, Information disclosure, Denial of service, Elevation of privilege). Record each credible threat
with the boundary it crosses and the ASVS control that should cover it. This catches design-level risk the
scanners cannot.

### 3. Run the tools that exist; recommend the ones that don't (evidence, not vibes)
Use the **build** tier to run whatever is installed; for anything absent, emit the **exact command** to add
it (recommend-don't-wall — never block, never hard-depend). Fetch current usage via Context7.
- **SAST** — `semgrep --config auto` (or the repo's config). Absent → recommend `semgrep`; note CodeQL for
  deeper nightly analysis.
- **SCA (dependency CVEs)** — `npm audit` / `pnpm audit` / `pip-audit` / the stack's equivalent; note
  Dependabot / Renovate for ongoing PRs.
- **Secrets** — `gitleaks detect` (or `git secrets`); plus enforce Midas's "secrets only via `${ENV_VAR}`" rule.
- Record per tool: **ran** (with the finding count) **or** **recommended-with-command**. A skipped tool is
  logged, never silently dropped.

### 4. Verify the ASVS checklist + the risk lenses
For the chosen ASVS level (+ Top 10, + LLM/Agentic when AI), evaluate each applicable control against the
code with **evidence** (`file:line`). Map every tool finding and every STRIDE threat to its control. Each
result is pass / fail / N-A — an N-A is a recorded verdict, not a skip.

### 5. Triage + rank (severity × confidence, no theater)
Rank findings by **severity** (Critical / High / Medium / Low) weighted by real exploitability and
blast-radius — not volume. Cap LOW nits. Each finding carries the control/lens it violates, `file:line`
evidence, and **one action**: `fix · mitigate · accept-with-rationale · defer`. **"Nothing material found"
(`critical=0 high=0`) is a valid, honest verdict — do not invent severity.**

### 6. Freeze the report + bridge (non-advancing)
Write `.harness/security/security-NN.md` (NN monotonic) — frozen: the gate-parseable tally line, the ranked
table, the STRIDE notes, the tools ran/recommended list, and the action bridge. Then **propose** (and on the
user's go-ahead, apply) findings → action:
- `fix` / `mitigate` → a task surfaced at the next `/start-sprint`;
- `accept` → recorded with rationale (and an ADR if it's an architectural risk decision);
- `defer` → `OQ-NN` in `product/open-questions.md` (non-blocking, logged).
You MAY set `last_security: { n: NN, critical: X, high: Y, at: <date> }` in `state.yaml` (read-modify-write
the whole file per schema). **Never set `gate: passed` or advance `stage`** — this audit informs; the gates decide.

## Output format (`.harness/security/security-NN.md`)
```markdown
# Security audit security-NN — level: <L1|L2|L3> — scope: <scope> — AI-lenses: <yes|no>
Run: <YYYY-MM-DD> · Auditor: midas-orchestrator (claude-opus-4-8) · cost_profile: <profile>

## Tally
CRIT a · HIGH b · MED c · LOW d   ·   tools_run: semgrep,npm-audit,gitleaks   ·   ASVS: L2
MIDAS_SECURITY_RESULT: level=L2 critical=a high=b medium=c low=d verdict=pass|findings   # gate-parseable

## Ranked findings (severity × confidence)
| ID | Lens (ASVS/Top10/LLM/STRIDE) | Severity | Conf | Issue | Evidence (file:line) | Action |
|----|------------------------------|----------|------|-------|----------------------|--------|

## STRIDE threat model
- <component / boundary>: <threat> → <ASVS control> → <covered|gap>

## Tools
- semgrep: ran (N findings) | npm audit: ran (N) | gitleaks: ran (0) | codeql: recommended (`<cmd>`)

## Action bridge
- <id> fix     → task at next /start-sprint
- <id> accept  → rationale (+ ADR-00X if architectural)
- <id> defer   → product/open-questions.md OQ-NN
```

## Safeguards (avoid theater)
1. **Evidence-or-struck** — every finding cites `file:line` or a tool's output; no citation → struck.
2. **Standard-grounded** — every finding maps to an ASVS / Top 10 / LLM / STRIDE item, fetched current
   (Context7 / OWASP), never "from memory".
3. **Exploitability-weighted** — rank by real blast-radius, not count; cap LOW nits.
4. **"Clean is valid"** — `critical=0 high=0` is a legitimate recorded outcome; never invent severity.
5. **No hard dependency** — absent tools are recommended with the exact command, never block the audit.
6. **Non-advancing** — informs only; `/close-sprint` and the human own the gate decision.

## Exit gate (audit complete)
- [ ] Scope + ASVS level resolved (recommended or `--level`); AI lenses added iff the product is AI-bearing.
- [ ] STRIDE threat model recorded against the architecture's trust boundaries.
- [ ] Each in-scope tool ran (with counts) or is logged as recommended-with-command — none silently skipped.
- [ ] Findings ranked with `file:line` evidence + one action each; LOW nits capped; a clean tally is allowed.
- [ ] `.harness/security/security-NN.md` frozen with the `MIDAS_SECURITY_RESULT` tally line.
- [ ] `stage` NOT advanced and no gate marked passed (the audit only informs).

## Tier & cost
Scope/level decision + ASVS verification + triage + freeze → **orchestrate** (Opus, the judgment).
Running scanners + collecting tool output → **build** (Sonnet). Evidence packs + Context7 control/tool
fetches → **scout** (Haiku). Prefer an installed specialist if present
(`voltagent-qa-sec:security-auditor` / `penetration-tester`, Anthropic `/security-review`); otherwise the
first-party `midas-orchestrator` / `midas-builder`. Respect `state.yaml.cost_profile`.
