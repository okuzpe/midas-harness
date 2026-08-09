# Rule: Session cookies (fixture overlay)

Session cookies must set `httpOnly`, `secure` in production, and an explicit `sameSite` value.

## CHECK

- **CHECK:** `manual:` session cookie options are set explicitly in auth code.
