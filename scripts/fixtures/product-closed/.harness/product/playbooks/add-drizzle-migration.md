# Playbook: Add a Drizzle migration

| Field | Value |
|---|---|
| **Use when** | Changing database schema |
| **Trigger** | any change to `src/lib/db/schema.ts` |
| **Owner tier** | build |

## Steps

1. Edit `src/lib/db/schema.ts`.
2. Generate and review migration SQL before commit.
