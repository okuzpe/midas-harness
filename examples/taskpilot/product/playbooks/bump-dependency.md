# Playbook: Bump a dependency

| Field | Value |
|---|---|
| **Use when** | Upgrading a pinned dependency — especially a framework/runtime **major** (Next 15→16, a Postgres major, Drizzle minor that changes an API) |
| **Trigger** | any change to `product/package.json` dependency versions or to `package-lock.json` |
| **Stack** | next.js@15.3.x · drizzle-orm@0.40.x · @neondatabase/serverless — Context7-verified |
| **Owner tier** | build |

## Steps

1. **Re-fetch current docs at the NEW version** before changing any code — `resolve-library-id` →
   `get-library-docs` at the target version (`harness/rules/context7-usage.md`). Never carry the old
   idiom forward from memory.
2. **Re-check the affected stack rule.** If the bump touches an idiom a `harness/rules/*` encodes (e.g.
   the Next cookies API behind `session-cookies.md`, or Drizzle query shape behind `tenant-isolation.md`),
   update that rule's body + its `docs: <lib>@<version>` provenance line to the new version, or confirm it
   still holds. A stale rule encoding a deprecated idiom is the failure mode this step prevents.
3. **Re-run SCA** on the updated lockfile (`npm audit --audit-level=high`) — the bump must not introduce a
   new high/critical CVE, and ideally clears any that prompted it.
4. Run the full suite (`npm test`) + `npm run typecheck`; a major bump that breaks a type or test is fixed
   in the same change, never merged red.

## Must honor

- **Rules:** pinned-exact versions + committed lockfile (`harness/rules/code-quality.md`,
  `harness/rules/security.md` dependencies + per-sprint SCA); any affected stack rule's provenance is
  refreshed (`harness/rules/*`).
- **Context7:** fetch the **new** version's docs before editing — never bump-and-pray
  (`harness/rules/context7-usage.md`).

## Done when

- [ ] New version's docs were fetched and any affected `harness/rules/*` body + `docs:` line updated.
- [ ] `npm audit --audit-level=high` is clean on the updated lockfile (or remaining items logged in an ADR).
- [ ] `npm test` + `npm run typecheck` pass on the bumped version.
- [ ] All applicable `harness/rules/*` still pass (audited in Phase 8).
