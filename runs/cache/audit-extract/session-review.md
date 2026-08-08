# Code review: installer refactor + hygiene session

## Verdict: **ready to continue** (with 2â€“3 targeted fixes first)

The refactor achieves its goal: shared preserve policy, separated copy/autonomy/uninstall modules, and a thinner `execute.mjs`. I found **no critical regressions** on `.mcp.json`, `AGENTS.md`, autonomy user files, or `--force` + `--update`. Full suite: **991 passed / 0 failed** on re-run (2 installer failures on an earlier run were **not reproducible** in isolation).

---

## High

*None.* No ship-blocking correctness or security defects with clear evidence.

---

## Medium

### M1 â€” Dry-run plan does not model execute-only vendor lifecycle

**Evidence:** `resetFreshVendorTrees` and `pruneStaleVendorTree` run only in execute (`applyPhaseCopy`), not in `plan-tree.mjs`.

```19:25:create-midas/lib/runtime/copy-tree.mjs
export function resetFreshVendorTrees(ctx) {
  if (ctx.update || ctx.migrate) return;
  for (const rel of ['.harness/engine', '.harness/scripts']) {
    rmSync(join(ctx.target, rel), { recursive: true, force: true });
  }
}
```

```237:249:create-midas/lib/runtime/execute.mjs
      async applyPhaseCopy() {
        mkdirSync(TARGET, { recursive: true });
        resetFreshVendorTreesLocal();
        copyTree(TEMPLATE, TARGET);
        // ...
        if (update) {
          pruneStaleVendorTree('.harness/engine', '.harness/engine');
          pruneStaleVendorTree('.harness/scripts', '.harness/scripts');
```

`planTemplateCopy` walks the template and emits skip/write/refresh ops but never models wipe-or-prune. On a **fresh install into a directory with leftover `.harness/engine`**, dry-run can show **skip** while execute **wipes and rewrites**.

**Risk:** Misleading `--dry-run` / JSON plan for brownfield re-installs. Not a write-path bug.

---

### M2 â€” Autonomy dry-run is metadata-only

**Evidence:** `plan-tree.mjs` adds a single `autonomy-capability` op; file-level autonomy copy/prune lives only in `autonomy-install.mjs`.

```61:72:create-midas/lib/steps/plan-tree.mjs
  if (autonomy) {
    const autonomySrc = join(template, '.optional', 'autonomy');
    if (existsSync(autonomySrc)) {
      ops.push({
        id: 'autonomy-capability',
        kind: 'autonomy',
        path: '.harness/autonomy',
```

**Risk:** Plan preview under-reports `--autonomy` work. Execute path is correct.

---

### M3 â€” No behavioral tests for new modules

**Evidence:** `scripts/test.mjs` only grep-checks preserve wiring:

```1051:1055:scripts/test.mjs
check(
  'mcp:installer-preserves-user-config',
  /\.mcp\.json/.test(installerPreserveSrc) && /alwaysPreservePath/.test(installerPreserveSrc) &&
    /alwaysPreservePath/.test(installerPlanTreeSrc) && /copy-tree\.mjs/.test(installerExecuteSrc),
```

No tests import or exercise `preserve-policy.mjs`, `copy-tree.mjs`, `autonomy-install.mjs`, or `runtime/uninstall.mjs` directly. Uninstall has integration tests (~L1527+); copy/preserve/autonomy do not.

**Risk:** Plan vs copy drift can reappear silently.

---

### M4 â€” Intermittent installer failures under full suite (resolved on re-run)

Earlier full run: `installer:update-tools-fixture-install` (ENOENT on `debate-method.md`) and `installer:update-tools-rewrites-and-prunes` (missing `model-profiles.mjs`). Isolated reproduction of the same install+update flow **passed**; full suite re-run **991/0**.

**Risk:** Possible Windows file-lock race while `build-create` rebuilds template at `test.mjs:423` during a long run. Not a logic bug, but worth watching in CI.

---

## Low

### L1 â€” `ensureAutonomyStatePointers` guard is easy to misread

```41:45:create-midas/lib/runtime/autonomy-install.mjs
export function ensureAutonomyStatePointers(ctx) {
  const stateFile = join(ctx.target, '.harness', 'state.yaml');
  if (!existsSync(stateFile)) return;
  const cur = ctx.readMaybe(stateFile);
  if (cur == null || /^autonomy:\s*$/m.test(cur)) return;
```

For normal YAML (`autonomy:` on its own line), this **correctly** no-ops. Inline `autonomy: â€¦` on one line would not match and could append a duplicate block. Rare.

**Recommendation:** Use `/^autonomy:/m.test(cur)` for clarity and edge-case safety.

---

### L2 â€” `state.yaml` doctor warnings (honest, not blocking)

```52:58:harness/state.yaml
last_audit:
  phase: audit
  sprint: "03"
  verdict: pass
  at: 2026-08-07
  record: .harness/audits/audit-03.md
  note: "sprint 02/03 audits un-attested until re-run via orchestrate /close-sprint"
```

`node scripts/doctor.mjs .` reports `audit:attestation-02/03` warns and `gate:phase-audit` warn. State documents this; strict `--strict` CI may surface warnings. Not a refactor defect.

---

### L3 â€” Stale `improve-cycle` references (acceptable)

Active skills/docs point to `auto-pilot-cycle.md`. Remaining `improve-cycle` mentions are in **CHANGELOG history** and **v2.8.2 migration tables** only â€” intentional.

---

## Audit checklist (requested areas)

| Area | Result |
|---|---|
| **1. Behavioral regressions** (`.mcp.json`, `AGENTS.md`, autonomy, force+update) | **OK** â€” `alwaysPreservePath` covers user paths; vendor refresh bypasses preserve; `fillAgents` handles AGENTS managed block; autonomy user entries skipped when present |
| **2. Closure/hoisting in execute.mjs** | **OK** â€” `copyCtx`/`autonomyCtx`/`uninstallCtx` close over hoisted `readMaybe`/`detectInstallLayout`; invoked at runtime only |
| **3. Imports / stripTraceHooks** | **OK** â€” `mergeTraceHooks` on install (cursor); `stripTraceHooks` in `runtime/uninstall.mjs:151-161`; no dead import issues found |
| **4. plan-tree vs copy-tree policy** | **OK for copy decisions** â€” same `alwaysPreservePath` + `isVendorManagedPath`; **gap** for wipe/prune (M1) |
| **5. conflicts.mjs semantic change** | **OK** â€” `isConflictVendorPath` matches prior inline `isVendorManagedPath` (engine/scripts + autonomy vendor, excluding user files) |
| **6. ship-manifest completeness** | **OK** â€” 22 scripts + `lib/trace-*`; `build-create` adds `install-diagnose.mjs` + `install-context.mjs`; `build-create:scripts-tree-match` enforces parity |
| **7. state.yaml honesty** | **OK** â€” `layout: classic` documented; un-attested audits noted in state |
| **8. Stale improve-cycle** | **OK** â€” only migration/history refs |
| **9. Test coverage gaps** | **Gap** â€” see M3 |
| **10. TaskPilot / further splits** | **OK to proceed** after M1â€“M3 hardening |

---

## What looks solid

- **Centralized preserve policy** (`preserve-policy.mjs`) with explicit `.mcp.json`, `AGENTS.md`, product/rules/runs, autonomy user files, and fresh-install mirror preservation.
- **Copy decision parity** between `plan-tree.mjs` and `copy-tree.mjs` for the shared predicate.
- **Uninstall extraction** â€” manifest-hash removal, managed-block stripping, `stripTraceHooks`, user-work retention/`--purge`; integration tests exist.
- **execute.mjs thinning** â€” clear delegation to modules; rollback paths still include autonomy on update.
- **ship-manifest.mjs** â€” single source for `build-create.mjs` + `test.mjs`.
- **Deleted `install.mjs`** â€” no dangling imports; workflow uses `plan-tree` directly.
- **MCP preserve** â€” user-owned on update; cursor sync + conflict detection unchanged from pre-refactor.

---

## Recommended next 1â€“3 fixes (before TaskPilot migrate / more execute splits)

1. **Add parity tests** â€” table-driven cases for `alwaysPreservePath(rel, update)` Ã— `{exists, force, vendor}` asserting `planTemplateCopy` kind matches `copyTree` skip/write (import both, no subprocess).
2. **Extend plan-tree or document gap** â€” either emit synthetic `remove`/`refresh` ops for `resetFreshVendorTrees` + prune on update, or state in plan output that execute performs additional vendor lifecycle steps not shown in file ops.
3. **Harden autonomy state guard** â€” change `ensureAutonomyStatePointers` line 45 to `/^autonomy:/m.test(cur)` and add a one-line test for â€œexisting autonomy block â†’ no appendâ€.

Optional: re-run `npm test` twice in CI to catch M4 flakiness if Windows file locking is suspected.

---

**Bottom line:** The refactor is architecturally sound and safe to continue. Address dry-run fidelity and unit-test gaps before leaning harder on plan/execute splits or TaskPilot migration work.

[REDACTED]
