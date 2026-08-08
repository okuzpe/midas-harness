<timestamp>Saturday, Aug 8, 2026, 12:33 PM (UTC+2)</timestamp>
<user_query>
You are auditing the Midas harness engine repository at C:\Users\AfterMe\Desktop\Harness.

Focus ONLY on `create-midas/` (installer package + template).

Goal: find architecture, hygiene, naming, dead-code, duplication, structure issues. Do NOT make edits.

Investigate thoroughly (very thorough):
1. create-midas/lib/ structure vs steps vs CLI
2. Template mirroring: create-midas/template vs harness/ vs plugins/ â€” drift risks
3. Naming of new untracked modules if visible (args, conflicts, context, runner, transaction, bind-applies, trace-hooks, migrate-v2)
4. Dead/orphan files in template
5. Whether template/.harness/engine is a healthy vendor copy pattern
6. Autonomy optional path clarity
7. Hygiene: duplicate skill trees (.agents, .claude, .cursor)

Return:
- Verdict
- Top 10 findings ranked by impact
- Suggested refactors/renames/moves
- Drift hotspots between template and harness source
- What NOT to change

Cite exact paths. Evidence-based.
</user_query>

---CHUNK---

Auditing `create-midas/` for structure, mirroring drift, and hygiene â€” I'll map the layout first, then compare template vs harness sources.

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

[REDACTED]

---CHUNK---

## Verdict

**Mostly healthy, with meaningful architectural debt.** The `create-midas/` split (CLI shim â†’ `lib/workflow/engine.mjs` â†’ `lib/runtime/execute.mjs`) is directionally right, and the **template vendor-copy pattern is sound and CI-enforced**. The main risks are a **~1,300-line execute monolith** that duplicates plan logic, **installer code importing from the bundled template** (inverted dependency), and several **orphan exports/modules**. Skill-tree â€œduplicationâ€ and `.optional/autonomy` staging are **intentional**, not hygiene failures.

---

## Top 10 findings (by impact)

### 1. `lib/runtime/execute.mjs` is a god module (~1,272 lines)

**Paths:** `C:\Users\AfterMe\Desktop\Harness\create-midas\lib\runtime\execute.mjs`

**Evidence:** 30+ local functions (`copyTree`, `writeState`, `runUninstall`, `syncSkillMirrors`, `installAutonomyCapability`, â€¦). Imports span template scripts, `migrate-v2.mjs`, and most of `lib/`.

**Impact:** Hard to test, review, and evolve; most install bugs will land here. Plan/execute split is only half-realized.

---

### 2. Plan vs execute duplication (preserve/copy policy)

**Paths:**
- `C:\Users\AfterMe\Desktop\Harness\create-midas\lib\steps\plan-tree.mjs` (`isVendorManagedPath`, `alwaysPreservePath`, `visit`)
- `C:\Users\AfterMe\Desktop\Harness\create-midas\lib\runtime\execute.mjs` (`isVendorManagedPath`, `copyTree` ~396â€“441)

**Evidence:** Nearly identical preserve lists (`.mcp.json`, `.harness/product/`, autonomy user files, `.claude/.agents` on fresh install). `plan-tree` emits per-file ops; `execute` re-implements the walk in `copyTree`.

**Impact:** Dry-run plans can diverge from actual writes after a one-sided edit. High regression risk on preserve policy changes.

---

### 3. Installer `lib/` imports from bundled template (inverted dependency)

**Paths:**
- `C:\Users\AfterMe\Desktop\Harness\create-midas\index.mjs` â†’ `template/.harness/scripts/model-profiles.mjs`
- `C:\Users\AfterMe\Desktop\Harness\create-midas\lib\runtime\execute.mjs` â†’ `model-profiles.mjs`, `ownership-manifest.mjs`
- `C:\Users\AfterMe\Desktop\Harness\create-midas\lib\core\conflicts.mjs` â†’ `ownership-manifest.mjs`

**Impact:** `lib/` is not self-contained; a broken/stale template breaks the installer before any copy. Couples runtime logic to whatever ships in `template/`.

---

### 4. Orphan / unused modules and exports

| Item | Path | Evidence |
|------|------|----------|
| `install.mjs` | `create-midas\lib\steps\install.mjs` | Only re-exports; no imports anywhere |
| `pathIsFile` | `create-midas\lib\steps\plan-tree.mjs` | Exported; zero references |
| `isExecutableOp` | `create-midas\lib\core\runner.mjs` | Exported; unused |
| `withTransaction` | `create-midas\lib\core\transaction.mjs` | Exported; unused (direct `beginRollbackSession` used) |
| Thin wrappers | `execute.mjs` ~381â€“507 | `compareVersions`, `hasMidasInstall`, etc. delegate to `lib/core/context.mjs` |

**Impact:** Noise for readers; suggests incomplete refactor.

---

### 5. `migrate-v2.mjs` sits outside `lib/` (~522 lines)

**Path:** `C:\Users\AfterMe\Desktop\Harness\create-midas\migrate-v2.mjs`

**Evidence:** Imported by `index.mjs` and `execute.mjs`; listed in `package.json` `files`. `lib/steps/migrate.mjs` only builds plan metadata.

**Impact:** Migration logic is split across `migrate-v2.mjs`, `lib/steps/migrate.mjs`, and `execute.mjs` session `applyMigration`. Naming/version coupling (â€œv2â€) will age awkwardly.

---

### 6. Template mirroring is guarded but multi-surface (drift hotspots)

**Canonical pipeline:** `C:\Users\AfterMe\Desktop\Harness\scripts\build-create.mjs`

**CI:** `.github/workflows/ci.yml` runs `node scripts/build-create.mjs` and fails on diff.

**Tests:** `scripts/test.mjs` â€” `build-create:harness-tree-match`, `build-create:scripts-tree-match`, `build-create:autonomy-optional-only`, portable-skills checks.

**Hotspots if `build-create` is skipped:**
| Surface | Source | Template destination |
|---------|--------|----------------------|
| Engine | `harness/` (minus `HARNESS_ENGINE_ONLY_RELS`) | `template/.harness/engine/` |
| Scripts bundle | `scripts/*.mjs` (subset in `FILES`) | `template/.harness/scripts/` |
| Autonomy | `harness/autonomy/` | `template/.optional/autonomy/` |
| Claude skills/agents | `harness/skills`, `harness/agents` | `template/.claude/` |
| Portable skills | `portable-skills.mjs` transform | `template/.agents/skills`, `template/.cursor/skills` |
| Docs | `docs/agents-and-models.md`, `skill-flows.md`, etc. | `template/.harness/engine/docs/` |
| Context mirror | `lib/core/context.mjs` | `template/.harness/scripts/install-context.mjs` |
| Diagnose mirror | `create-midas/install-diagnose.mjs` | `template/.harness/scripts/install-diagnose.mjs` (byte-identical today) |

**Filtered engine compare:** 123 harness files (exclusions applied) vs 127 template engine files â€” only extra files are the four `docs/*.md` copies (intentional).

---

### 7. Triple skill trees in template (~295 files) â€” intentional, not accidental duplication

**Paths:**
- `create-midas/template/.harness/engine/skills/` (canonical authored copy)
- `create-midas/template/.claude/skills/` (raw harness copy)
- `create-midas/template/.agents/skills/` (portable transform)
- `create-midas/template/.cursor/skills/` (portable transform)

**Evidence:** `build-create.mjs` lines 92â€“107; `scripts/portable-skills.mjs`. All 35 skill dirs align by name; **content differs by design** (Claude native frontmatter vs `metadata.midas-*` keys in agents/cursor). `midas-help` engine â‰¡ claude; agents/cursor differ.

**Impact:** ~4Ã— skill bytes in npm package, but required for ADR-008 host discovery. Risk is **edit wrong tree** (hand-edit `.claude` in template instead of `harness/skills`).

---

### 8. Autonomy optional path is correct but scattered

**Staging:** `template/.optional/autonomy/` (from `harness/autonomy/`)

**Install target:** `.harness/autonomy/` when `--autonomy`

**Evidence:**
- `plan-tree.mjs` ~89â€“100: autonomy op from `.optional/autonomy`
- `execute.mjs` ~698â€“759: `installAutonomyCapability`, user-file preserve set
- `conflicts.mjs` ~13â€“20: vendor paths under `.harness/autonomy/` with user exceptions
- ADR: `docs/adr/ADR-009-optional-autonomy-control-plane.md`

**Clarity gap:** Skills/docs mix **CLI** `midas-autopilot.mjs` and **slash** `/midas-auto-sprints` / `/midas-auto-pilot` â€” documented but easy to confuse.

---

### 9. `lib/` layering is clear but `steps/` vs `runtime/` boundary is muddy

**Healthy structure:**
```
create-midas/index.mjs          # argv + wiring
lib/cli/args.mjs                # parse
lib/workflow/engine.mjs         # lifecycle phases
lib/core/{context,plan,conflicts,runner,transaction}.mjs
lib/steps/{plan-tree,migrate,uninstall,diagnose,bind-applies,trace-hooks}.mjs
lib/report/render.mjs, lib/prompt.mjs
lib/runtime/execute.mjs         # everything else
```

**Evidence:** `engine.mjs` delegates all writes to `deps.execute`; plan builders are thin except `plan-tree.mjs`.

**Impact:** â€œStepsâ€ name suggests executable steps, but only `bind-applies` + `trace-hooks` are execute-adjacent; real execution lives in `runtime/`.

---

### 10. Prompt / interactive UX duplicated

**Paths:**
- `C:\Users\AfterMe\Desktop\Harness\create-midas\lib\prompt.mjs` (used by `engine.mjs` for confirm)
- `C:\Users\AfterMe\Desktop\Harness\create-midas\lib\runtime\execute.mjs` (`promptToolsInteractive`, `createInterface` ~878+)

**Impact:** Low severity; inconsistent interactive patterns.

---

## Suggested refactors / renames / moves

| Priority | Suggestion |
|----------|------------|
| High | Split `execute.mjs` into `lib/runtime/{copy,preserve,state,adapters,autonomy,uninstall,verify}.mjs`; keep `createExecuteHandler` as thin orchestrator |
| High | Single **preserve policy module** (`lib/core/preserve-policy.mjs`) shared by `plan-tree.mjs` and copy implementation |
| High | Move `ownership-manifest.mjs` + `model-profiles.mjs` **imports** to `lib/vendor/` copies or import from repo `scripts/` at build time â€” stop importing live `template/` |
| Medium | Move `migrate-v2.mjs` â†’ `lib/migrate/v2.mjs` (or `lib/steps/migrate-v2.mjs`); keep thin `migrate-v2.mjs` re-export for `package.json` if needed |
| Medium | Delete `lib/steps/install.mjs` or wire `engine.mjs` to use `planInstall` |
| Low | Remove unused exports: `pathIsFile`, `isExecutableOp`, `withTransaction` (or use `withTransaction` in execute rollback) |
| Low | Remove wrapper functions in `execute.mjs` that only call `lib/*` aliases |
| Low | Consolidate `promptToolsInteractive` into `lib/prompt.mjs` |

**Naming:** Current names (`args`, `context`, `conflicts`, `runner`, `transaction`, `bind-applies`, `trace-hooks`) are **consistent with repo kebab-case files + verb modules**. `bind-applies` is the only awkward name; `bind-phase-handlers.mjs` would be clearer. `migrate-v2.mjs` is accurate today but will need a successor name when v3 layout appears.

---

## Drift hotspots (template â†” harness â†” plugins)

1. **`harness/` â†’ `template/.harness/engine/`** â€” automated; excludes `state.yaml`, `autonomy`, engine-only skills/research
2. **`scripts/` subset â†’ `template/.harness/scripts/`** â€” automated; template adds `install-diagnose.mjs`, `install-context.mjs`
3. **`harness/skills` â†’ `.claude` + portable mirrors** â€” automated via `build-create` + `portable-skills.mjs`
4. **`plugins/midas/skills`** â€” separate `build-plugin.mjs` path; 35 skills match template `.claude` count (manual align via `npm run align`)
5. **`lib/core/context.mjs`** â€” copied to `install-context.mjs` on build (must stay identical)
6. **`install-diagnose.mjs`** â€” duplicated to template scripts on build
7. **Hand-editing `create-midas/template/`** â€” CI fails; comment at top of `build-create.mjs` line 5â€“6

---

## What NOT to change

- **`scripts/build-create.mjs` pipeline** and CI stale-template gate
- **Vendor copy pattern:** `template/.harness/engine/` as immutable engine payload (minus explicit excludes)
- **`.optional/autonomy` â†’ `.harness/autonomy`** optional install (ADR-009)
- **Three host skill trees** + `portable-skills.mjs` transform (ADR-008)
- **Lifecycle phases** in `lib/workflow/engine.mjs` (requirements â†’ checks â†’ plan â†’ confirm â†’ execute â†’ verify)
- **`ownership-manifest.mjs` + conflict checks** in update path (`lib/core/conflicts.mjs`)
- **`bind-applies.mjs` + `runPlanOps`** op-id binding pattern
- **`trace-hooks.mjs`** Cursor hooks merge/strip (ADR-011)
- **Engine-only stripping** (`scripts/engine-only.mjs`, `midas-precommit` exclusion)
- **Fresh-install preserve** for `.harness/product/`, `rules/`, `runs/`, user `state.yaml`, `.mcp.json`
- **`index.mjs` as thin shim** â€” good boundary

---

## `template/.harness/engine` as vendor copy

**Healthy.** Evidence:
- Full `harness/` copy minus `HARNESS_ENGINE_ONLY_RELS` (`scripts/engine-only.mjs`)
- Autonomy **not** in engine tree; optional capability separate
- `docs/*.md` injected from repo `docs/` (not from `harness/`)
- `scripts/test.mjs` `build-create:harness-tree-match` enforces shape/content
- `plan-tree.mjs` + `ownership-manifest` treat `.harness/engine/` as vendor-owned refresh on update

---

## Autonomy optional path (summary)

| Stage | Path |
|-------|------|
| Engine source | `harness/autonomy/` |
| Bundled (not installed by default) | `create-midas/template/.optional/autonomy/` |
| Installed (with `--autonomy`) | `<project>/.harness/autonomy/` |
| User-owned at update | `policy.yaml`, `authz/`, `control.json`, `budget-ledger.json`, `journal-anchor.json` |

`plan-tree.mjs` skips `.optional` during template walk; autonomy is a separate phase op â€” clear separation.

[REDACTED]
