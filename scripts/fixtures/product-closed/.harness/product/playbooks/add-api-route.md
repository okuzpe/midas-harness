# Playbook: Add an API route

| Field | Value |
|---|---|
| **Use when** | Adding a new endpoint under `src/app/api/` |
| **Trigger** | any added/changed `src/app/api/**/route.ts` |
| **Owner tier** | build |

## Steps

1. Create `src/app/api/<resource>/route.ts`.
2. Authenticate before business logic.
3. Add or extend `route.test.ts` at the HTTP boundary.
