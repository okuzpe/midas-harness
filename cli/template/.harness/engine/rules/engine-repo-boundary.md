# Rule: Engine repository is not an install target (always-on)

**Scope: midas-harness engine repository only.** Product installs never receive this rule as a
constraint on *their* trees — it protects *this* repo from nesting a second harness inside itself.

## Law

Never run `create-midas` / `npx … midas-harness` **install**, **`--update`**, or **`--migrate`**
against the engine repository root. Never create `.harness/engine/`, `.harness/scripts/`, or
`.harness/state.yaml` here as a product install.

## Engine root layout (this repo)

| Path | Role | Keep? |
|---|---|---|
| `harness/` | **Authored engine source** | Yes — this *is* the product |
| `scripts/` | Engine tooling (doctor, test, build) | Yes |
| `cli/` | Installer package (npm name `create-midas`) | Yes |
| `docs/product/` | Stub README — **not** a product lifecycle tree | Yes (path token only) |
| `runs/cache/` | Contributor Trace cache (`paths.cache`) | Yes — gitignored |
| `runs/` (other) | Optional tooling output (adapters hash, etc.) | Not lifecycle evidence |
| `.harness/engine/` | Product install vendor tree | **Forbidden** at repo root |
| `.harness/state.yaml` | Product install state | **Forbidden** at repo root |

**Glossary:** `harness/state.yaml` here holds **contributor metadata** (version, routing, path overrides).
Installed products use **`.harness/runs/`** for lifecycle evidence (ADR-007). The `{runs}/` token resolves
from `paths.runs` in each project's state file.

This repository **authors** Midas; it does **not** run Phase 0–8 on itself. Lifecycle demo:
`docs/research/taskpilot/`.

For install/migration tests use a **temp directory** or `docs/research/taskpilot/` — never the engine root.

## Checklist

- [ ] No product install markers under the engine root.
  **CHECK:** `test ! -e .harness/engine/VERSION && test ! -e .harness/state.yaml` (or Windows
  equivalent) at the midas-harness repo root — either file present is a fail.
- [ ] Installer refuses this repository.
  **CHECK:** `node cli/index.mjs --dry-run .` exits non-zero with message containing
  `refusing to install/update/migrate into the midas-harness engine repository`.
- [ ] Agents do not propose `/midas-init` or `npx … --update` against this root as a product setup.
  **CHECK:** `manual:` session/PR notes proposing a root product install without an explicit human
  override naming a *separate* directory is a fail.

## Amendment

- **2026-08-08** — Engine dogfood evidence at root `runs/` + `runs/cache/` (`paths.runs` /
  `paths.cache`); installer folder `cli/` (npm name still `create-midas`). Product installs keep
  `.harness/runs/` (ADR-007).
- **2026-08-08** — Engine dogfood `paths.product` is `docs/product/` (not root `product/`).
- **2026-08-08** — Codified: engine repo ≠ install target; installer hard-refuses; clarify dogfood
  evidence vs nested product install.
- **2026-08-08** — Removed engine lifecycle dogfood (sprints/audits/product ledger). `docs/product/`
  is a stub; `runs/cache/` remains for Trace; lifecycle CI demo = `docs/research/taskpilot/`.
