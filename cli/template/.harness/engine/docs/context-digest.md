# Context digest (opt-in)

Optional, cache-only workspace file index for manual cost control — see [ADR-012](./adr/ADR-012-muninn-adaptations.md) P2 (F-034–036).

Run `node scripts/context-digest.mjs refresh` to write `runs/cache/context/digest.json` (engine repo) or `.harness/cache/context/digest.json` (installed projects). Query with `node scripts/context-digest.mjs query <substring>`.

**Off by default:** not wired to `sessionStart` hooks and never auto-injected into `AGENTS.md`. This digest does **not** replace authored `{product}/architecture.md` ([ADR-003](./adr/ADR-003-project-memory-model.md)).
