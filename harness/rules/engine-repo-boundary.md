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
| `docs/product/` | Engine dogfood lifecycle docs (`paths.product`) | Yes (not an install) |
| `runs/{audits,sprints,sweeps,…}` | Classic dogfood **evidence** (`paths.runs`) | Yes — not vendor |
| `runs/cache/` | Dogfood cache + traces (`paths.cache`) | Yes — gitignored |
| `.harness/engine/` | Product install vendor tree | **Forbidden** at repo root |
| `.harness/state.yaml` | Product install state | **Forbidden** at repo root |

**Glossary:** Engine dogfood uses root **`runs/`** (`paths.runs` in `harness/state.yaml`). Installed
products use **`.harness/runs/`** under ADR-007 — not the same path. The `{runs}/` token resolves
from `paths.runs` in each project's state file.

Dogfood (`layout: classic` in `harness/state.yaml`) tracks methodology on the engine itself. That is
**not** “install harness on harness.” Installing would copy `harness/` into `.harness/engine/` and
bite the tail.

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
