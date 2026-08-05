# Architecture — midas-harness (engine)

## Shape

| Layer | Path | Role |
|---|---|---|
| Authoring | `harness/` | Skills, agents, rules, methodology, templates |
| Scripts | `scripts/` | Render, doctor, test, build, bump |
| Installer | `create-midas/` | Lifecycle CLI + generated `template/` |
| Plugin | `plugins/midas/` | Claude Code marketplace bundle (generated) |
| Product dogfood | `product/` | This tree — idea/architecture/conventions for the engine itself |

## Layout

Engine dogfoods **`layout: classic`** (`harness/` + `scripts/`). Product installs use
**`layout: harness`** (`.harness/`). See ADR-007 / ADR-008.

## Stack

Node ≥22 ESM (dependency-free scripts), MkDocs for docs site. No application runtime UI.

## Boundaries

- Generated trees (`plugins/midas/`, `create-midas/template/`, host skill mirrors) are never authored.
- Optional autonomy lives under `harness/autonomy/` and ships only with `--autonomy`.
- Engine-only skills (e.g. `/midas-precommit`) never enter the install template.
