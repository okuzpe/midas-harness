<!-- Phase 5 artifact seed. Copy to <paths.rules>/folder-structure.md and fit the real tree.
     Scope Rule + screaming names apply to feature/module architectures.
     A Phase-4 ADR that chose layered / hexagonal / ports wins on conflict — cite it. -->

# Rule: Folder structure

Canonical layout for this project's source. Import and layer boundaries belong here (or in a
sibling rule this file points at).

## Scope Rule (unbreakable unless an ADR says otherwise)

- Used by **1** feature/module → stays **local** to that feature.
- Used by **2+** features/modules → lives in **shared** / global.
- No "we'll move it later" exceptions without amending this rule.

## Screaming architecture

Top-level product folders name **user jobs** (what the app does), not technical kinds
(`components/`, `hooks/`, `utils/` as the root). Shared primitives sit under `shared/` only
after the 2+ rule fires.

## Tree

```
src/
  features/
    <job-name>/          # local: container + components + tests for this job
  shared/                # 2+ consumers only
  infrastructure/        # cross-cutting (api, auth, telemetry) if the stack needs it
```

Replace this tree with the real layout from `{product}/architecture.md`.

## Checklist

- [ ] Placement follows Scope Rule (or the cited ADR exception).
      **CHECK:** `manual:` a file used by only one feature is not in `shared/`; a file imported by
      two features is not duplicated under both feature trees.
- [ ] Top-level names scream jobs.
      **CHECK:** `manual:` a reviewer can name the product's jobs from the first two directory
      levels; a `src/components` + `src/hooks` root with no feature folders is a fail unless the
      ADR exception is cited here.

## Amendment

- **YYYY-MM-DD** — Initial freeze from `/define-conventions`.
