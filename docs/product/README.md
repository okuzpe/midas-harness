# Engine dogfood — product artifacts

Lifecycle artifacts for **midas-harness itself** (not a shipped app). The engine repo dogfoods
`layout: classic` with `paths.product: docs/product` in `harness/state.yaml`.

- Runs / audits / sweeps live under root `.harness/` (`paths.runs`).
- For a full **product-shaped** CI fixture, see [`research/taskpilot/`](../research/taskpilot/).

Do not run `create-midas` install against this repository root — see `harness/rules/engine-repo-boundary.md`.
