---
name: midas-security-audit
user-surface: primary
description: Deep security audit — OWASP ASVS 5.0 + Top 10 (+ LLM/Agentic when AI-bearing), STRIDE threat model, SAST/SCA/secret scanners as evidence; freeze to {runs}/security/security-NN.md. Non-advancing. Use before ship on any UI/API/data surface.
user-invocable: true
disable-model-invocation: true
model: inherit
harness-tier: orchestrate
recommended-model: claude-opus-4-8
mcp-recommended: [context7]
argument-hint: "[--level L1|L2|L3] [--scope code|deps|secrets|design|all]"
---

# midas-security-audit — Deep Security Audit

> **Guard + state:** `<paths.engine>/templates/skill-state-ritual.md` (+ `AGENTS.md` § Safety / Path resolution).
> Read **`paths.state`** first. Advanced, non-advancing audit — never auto-run.

> **Paths:** Read `layout` + `paths` from **`paths.state`**. Substitute `{runs}/` → `paths.runs`, `{product}/` → `paths.product`. See `AGENTS.md` § Path resolution.

Standalone security audit (analog of `/midas-tribunal`): orchestrate a recognized standard, run real tools for evidence, freeze ranked findings. Complements `<paths.engine>/rules/security.md` (Phase 8 floor) and `/midas-tribunal security` (debate lens).

**Shared fragments:** `<paths.engine>/templates/audit-checklists.md` (gate semantics, `MIDAS_SECURITY_RESULT` tally).

## Does / Does not

| Does | Does not |
|---|---|
| STRIDE + ASVS/Top10/LLM checklist with `file:line` evidence | Advance `stage` or set `gate: passed` |
| Run installed scanners; recommend exact commands when absent | Block on missing tools |
| Freeze `{runs}/security/security-NN.md` | Invent severity when `critical=0 high=0` |
| Bridge findings → sprint tasks / ADR / `open-questions.md` | Replace `/close-sprint` gate decision |

## Standards (fetch current — never from memory)

- **OWASP ASVS 5.0** — L1 (public/low-risk), **L2** (default SaaS), L3 (payments/health/auth providers). `--level` overrides; else recommend from data sensitivity.
- **OWASP Top 10** — broken access control, injection, crypto failures, SSRF, etc.
- **OWASP LLM Top 10 + Agentic AI Top 10** — when product uses LLM/agent/RAG/tool-use: prompt injection, excessive agency, insecure output, etc.

## Inputs

- **`paths.state`**, `{product}/architecture.md`, `{product}/business-plan.md`, `<paths.engine>/rules/security.md`
- Codebase: UI/API/data/auth, manifests, CI, `.mcp.json` / agent config

## Procedure

### 1. Scope + ASVS level (recommend-don't-wall)
`--scope` default `all`. If `--level` absent, recommend L1/L2/L3 from data handled; proceed at recommendation (human may override). Flag **AI-bearing** products for LLM/Agentic lenses.

### 2. STRIDE threat model
Walk Spoofing/Tampering/Repudiation/Info disclosure/DoS/Elevation over architecture trust boundaries. Record credible threats + ASVS control that should cover each.

### 3. Run tools; recommend missing (evidence, not vibes)
**Build** tier runs installed tools; absent → exact add command (never block). Context7 for current usage.

- **SAST** — `semgrep --config auto` (or repo config); absent → recommend `semgrep`
- **SCA** — `npm audit` / `pnpm audit` / `pip-audit` / stack equivalent
- **Secrets** — `gitleaks detect`; enforce secrets via `${ENV_VAR}` only

Per tool: **ran** (count) or **recommended-with-command**. Skipped tools logged, never silently dropped.

### 4. Verify checklist
For chosen ASVS level (+ Top 10 + LLM/Agentic when AI): evaluate controls with evidence (`file:line`). Map tool findings + STRIDE threats. Each result pass / fail / N-A (recorded, not skipped).

### 5. Triage + rank
Severity (Critical/High/Medium/Low) × exploitability × blast-radius. Cap LOW nits. Each finding: control/lens, evidence, one action (`fix` · `mitigate` · `accept-with-rationale` · `defer`). **`critical=0 high=0` is valid.**

### 6. Freeze report + bridge
Write `{runs}/security/security-NN.md` (NN monotonic): tally, ranked table, STRIDE notes, tools list, action bridge. On user go-ahead:

- `fix`/`mitigate` → task at next `/start-sprint`
- `accept` → rationale (+ ADR if architectural)
- `defer` → `OQ-NN` in `{product}/open-questions.md`

MAY set `last_security: { n, critical, high, at }` in `paths.state` (read-modify-write). **Never advance `stage`.**

## Output format (`{runs}/security/security-NN.md`)

```markdown
# Security audit security-NN — level: <L1|L2|L3> — scope: <scope> — AI-lenses: <yes|no>
Run: <YYYY-MM-DD> · Auditor: midas-orchestrator (claude-opus-4-8) · cost_profile: <profile>

## Tally
CRIT a · HIGH b · MED c · LOW d   ·   tools_run: semgrep,npm-audit,gitleaks   ·   ASVS: L2
MIDAS_SECURITY_RESULT: level=L2 critical=a high=b medium=c low=d verdict=pass|findings

## Ranked findings (severity × confidence)
| ID | Lens | Severity | Conf | Issue | Evidence | Action |

## STRIDE threat model
- <boundary>: <threat> → <control> → <covered|gap>

## Tools
- semgrep: ran (N) | gitleaks: ran (0) | codeql: recommended (`<cmd>`)

## Action bridge
- <id> fix → next /start-sprint · accept → rationale (+ ADR) · defer → OQ-NN
```

## Safeguards

1. **Evidence-or-struck** — no `file:line` or tool output → struck.
2. **Standard-grounded** — map to ASVS/Top10/LLM/STRIDE, fetched current.
3. **Exploitability-weighted** — rank by blast-radius; cap LOW nits.
4. **Clean is valid** — never invent severity.
5. **No hard dependency** — absent tools recommended, never block.
6. **Non-advancing** — informs only.

## Exit gate

- [ ] Scope + ASVS level resolved; AI lenses iff AI-bearing.
- [ ] STRIDE recorded against trust boundaries.
- [ ] Each tool ran or logged recommended-with-command.
- [ ] Findings ranked with evidence + one action; clean tally allowed.
- [ ] `{runs}/security/security-NN.md` frozen with `MIDAS_SECURITY_RESULT`.
- [ ] `stage` NOT advanced; no gate marked passed.

## Tier & delegation

Scope/ASVS/triage/freeze → **orchestrate**. Scanners → **build**. Context7 fetches → **scout**. Prefer `security-auditor` / `penetration-tester` / `/security-review` if installed; else `midas-orchestrator` / `midas-builder`.
