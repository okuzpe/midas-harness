<!-- Phase 5 generated stack rule (TaskPilot). Session-cookie hardening (audited as R-12; amendment A-01). -->

# Rule: Session cookie hardening (Next.js cookies API)

> docs: next.js@15.3.x via Context7

The session cookie set in `lib/auth/session.ts` MUST be hardened against theft and CSRF.

## Requires

- `httpOnly: true` (no JS access), `secure: true` in production, and an **explicit** `sameSite`
  (never rely on the browser default).
- `sameSite: "lax"` is the Sprint-1 baseline (blocks cross-site POST CSRF while allowing the top-level
  invite-accept navigation). `sameSite: "strict"` is **deferred to Sprint 3** (amendment A-01) — the
  Sprint-3 closing audit MUST verify the final policy before pilot launch.

## CHECK

- **CHECK:** `grep -nE "httpOnly|secure|sameSite" product/src/lib/auth/session.ts` shows all three set
  explicitly on the session cookie.
- **CHECK:** `session.test.ts` asserts `httpOnly:true` and an explicit `sameSite`.

## Linter form (the machine-readable CHECK)

- `manual-only` — verified by the grep above + `session.test.ts` in CI; tracked as R-12 at Phase 8.
