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

## Parseable tally lines

Each frozen record ends with a machine-readable summary for `/midas-doctor`:

```
# close-sprint
MIDAS_AUDIT_RESULT: rules_failed=X unresolved=Y amended=Z verdict=pass|blocked

# midas-tribunal
MIDAS_DEBATE_RESULT: upheld=X struck=Y dissent=Z verdict=proceed|revisit|blocked

# midas-security-audit
MIDAS_SECURITY_RESULT: critical=X high=Y medium=Z low=W verdict=pass|remediate|blocked
```

`unresolved=0` (audit) or equivalent open criticals (security) before treating a sprint gate as pass.

## Hygiene hook (close-sprint + optional others)

When `mode: brownfield`, Phase 8 requires a sweep record for the sprint cycle **or**
`sweep: skipped — <reason>` in the audit. See `<paths.engine>/rules/hygiene.md`.

Recommended optional sweeps (surfaced by `/midas-status`, never forced):

- Post-adopt, before wiring
- Pre-`plan-sprints` (ledger vs reality)
- Pre-`close-sprint` on large diffs

## Record templates

- Sprint gate: `<paths.engine>/templates/audit-record.md`
- Tribunal: `<paths.engine>/templates/debate-record.md`
- Security: inline in `/midas-security-audit` skill (§ Freeze)
