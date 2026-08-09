# Rule: Tenant isolation (fixture overlay)

Workspace-owned reads and writes must filter by the caller's workspace id.

## CHECK

- **CHECK:** `manual:` integration tests assert cross-workspace access returns 404.
