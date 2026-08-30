# Rule: Acceptance criteria (EARS) (always-on)

Sprint acceptance criteria must be **testable** — vague goals fail Phase 8 because the auditor cannot map
them to evidence.

## Format

Prefer **EARS** (Easy Approach to Requirements Syntax):

| Pattern | When to use |
|---|---|
| `WHEN <trigger>, the system SHALL <response>` | Event-driven behaviour |
| `WHILE <state>, the system SHALL <response>` | State-dependent behaviour |
| `IF <condition> THEN the system SHALL <response>` | Conditional behaviour |
| `The system SHALL <response>` | Unconditional invariant |

One observable behaviour per line. A criterion no test could prove is a **goal**, not a criterion —
rewrite it before `/close-sprint`.

## Tests

Mirror each criterion with a test titled `given / when / then` so the Phase-8 audit maps every criterion
to a passing test (see `testing.md` for suite requirements).

- [ ] Each acceptance criterion in the active sprint file is a single EARS-shaped, observable statement.
      **CHECK:** `grep -nE "When |THEN |SHALL |WHEN " {product}/sprints` — any acceptance line that is a goal, not an observable behaviour, is a fail. Missing `{product}/sprints` → skip.
- [ ] Every acceptance criterion has a corresponding test or `/midas-verify` row at audit time.
      **CHECK:** `node <paths.scripts>/gates/test-gate.mjs` exits 0; cross-read sprint acceptance vs tests/`{runs}/verifications/` — an uncovered criterion is a fail.

## Amendments

Extracted from `harness/conventions.md` § Acceptance criteria (EARS) during repo audit Phase C.
