# Architecture — midas-harness (engine)

## Shape

| Layer | Path | Role |
|---|---|---|
| Authoring | `harness/` | Skills, agents, rules, methodology, templates |
| Scripts | `scripts/` | Render, doctor, test, build, bump |
| Installer | `cli/` (npm name `create-midas`) | Lifecycle CLI + generated `template/` |
| Plugin | `harness/plugins/midas/` | Claude Code marketplace bundle (generated) |
| Product dogfood | `docs/product/` | Engine methodology artifacts (`paths.product` in `harness/state.yaml`) |

## Layout

Engine dogfoods **`layout: classic`** (`harness/` + `scripts/`). Product installs use
**`layout: harness`** (`.harness/`). See ADR-007 / ADR-008.

## Stack

Node ≥22 ESM (dependency-free scripts), MkDocs for docs site. No application runtime UI.

## Boundaries

- Generated trees (`harness/plugins/midas/`, `cli/template/`, host skill mirrors) are never authored.
- Optional autonomy lives under `harness/autonomy/` and ships only with `--autonomy`.
- Engine-only skills (e.g. `/midas-precommit`) never enter the install template.
