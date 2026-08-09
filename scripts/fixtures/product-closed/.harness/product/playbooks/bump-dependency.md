# Playbook: Bump a dependency

| Field | Value |
|---|---|
| **Use when** | Upgrading a pinned dependency |
| **Trigger** | any change to `package.json` or lockfile |
| **Owner tier** | build |

## Steps

1. Fetch current docs for the target version before code changes.
2. Re-run tests and update stack rules if APIs changed.
