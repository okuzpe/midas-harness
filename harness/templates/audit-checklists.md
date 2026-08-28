# Shared audit checklists (consumed by slash-commands — do not run standalone)

> **ADR-004:** Three audit commands share fragments here; each keeps its own gate semantics.
> Copy sections into frozen records — never merge the commands.

## Gate semantics

| Command | Advances stage? | Output | Question it answers |
|---|---|---|---|
| `/close-sprint` | **Yes** (Phase-8 gate) | `{runs}/audits/audit-NN.md` | Does the code **conform** to frozen rules and scope? |
| `/midas-tribunal` | No | `{runs}/debates/debate-NN.md` | Were the **decisions** right? |
| `/midas-security-audit` | No | `{runs}/security/security-NN.md` | What are the **security** findings vs OWASP/STRIDE? |

Optional audits **inform** gates; they never substitute for `/close-sprint`.

## Evidence rule (all three)

Every claim, pass, or fail cites **on-disk evidence** (`path:line`, artifact section, or scanner output).
Claims without evidence are **struck** or recorded as `BLOCKED` with the missing proof named.

## Common pre-reads

Before grading, load when present:

1. `paths.state` (`layout`, `paths`, `stage`, `sprints[]`, `mode`)
2. `<paths.engine>/rules/*` (especially `security.md`, `hygiene.md`, `verification.md`)
3. `{product}/architecture.md`, `{product}/business-plan.md`, `{product}/idea.md`
4. Active `{product}/sprints/NN-*.md` and latest `{runs}/verifications/verify-NN.md` (UI sprints)
5. Latest `{runs}/sweeps/sweep-NN.md` when brownfield or hygiene applies
6. Latest `{runs}/lean/lean-NN.md` when a lean-review was frozen this sprint (optional)

## Parseable tally lines

Each frozen record ends with a machine-readable summary for `/midas-doctor`. Skills **cite this
section** — they do not redefine the shape locally.

```
# close-sprint
MIDAS_AUDIT_RESULT: rules_failed=X unresolved=Y amended=Z verdict=pass|blocked

# midas-tribunal
MIDAS_TRIBUNAL_RESULT: criticals=X highs=Y

# midas-security-audit
MIDAS_SECURITY_RESULT: level=L2 critical=a high=b medium=c low=d verdict=pass|findings

# midas-sweep
MIDAS_SWEEP_RESULT: dead_flows=N orphans=N ledger_drift=N stale_docs=N harness_drift=N hygiene=N verdict=clean|report|fixed

# midas-retro
MIDAS_RETRO_RESULT: sprint=NN went_well=N hurt=N learned=N carry=N verdict=frozen|dry-run

# midas-investigate
MIDAS_INVESTIGATE_RESULT: id=NN hypotheses=N strikes=N verdict=frozen|dry-run|stop

# midas-lean-review
MIDAS_LEAN_RESULT: findings=N high=N net_lines=-N verdict=report|clean

# midas-verify (canonical shape — also in verify-record.md; doctor parses fails/criticals)
MIDAS_VERIFY_RESULT: fails=X criticals=Y runtime_errors=Z

# midas-align
MIDAS_ALIGN_RESULT: gaps=N verdict=aligned|gaps

# midas-sandbox (engine only)
MIDAS_SANDBOX_RESULT: skill=<name|list> mode=single|smoke|all verdict=pass|fail auto_decisions=N isolation=ok|fail
```

`unresolved=0` (audit) or equivalent open criticals (security) before treating a sprint gate as pass.

## Hygiene hook (close-sprint + optional others)

When `mode: brownfield`, Phase 8 requires a sweep record for the sprint cycle **or**
`sweep: skipped — <reason>` in the audit. See `<paths.engine>/rules/hygiene.md`.

Recommended optional sweeps (surfaced by `/midas-status`, never forced):

- Post-adopt, before wiring
- Pre-`plan-sprints` (ledger vs reality)
- Pre-`close-sprint` on large diffs

Recommended optional lean review (same surfacing):

- Pre-`close-sprint` on a fat feature/UI diff → `/midas-lean-review` [`--freeze`]

## Record templates

- Sprint gate: `<paths.engine>/templates/audit-record.md`
- Tribunal: `<paths.engine>/templates/debate-record.md`
- Security: inline in `/midas-security-audit` skill (§ Freeze)
