# Rule: Change propagation — keep sources, bundles, docs, and versions aligned (always-on)

Every Midas change has **downstream surfaces** that must move together. Editing only the "obvious"
file and leaving generated trees, version stamps, or docs stale is a **gap** — not a style issue.

> **Every item carries a `**CHECK:**`** — the concrete condition an alignment pass or Phase-8 audit
> evaluates. Engine repo: `npm run align` or `/midas-align`. Product install: `/midas-align` or
> `/midas-doctor` after convention/rule edits.

## Propagation matrix (what you changed → what else must update)

| You changed… | Also update / run |
|---|---|
| `<paths.engine>/conventions.md` or any `<paths.engine>/rules/*.md` | `node <paths.scripts>/render-adapters.mjs` (or `/midas-doctor --fix`); re-read adapters in every active tool |
| `.claude/skills/*` or `.claude/agents/*` | **Engine repo:** `npm run build` (syncs `plugins/midas/` + `create-midas/template/`). **Product:** adapters only if conventions changed |
| `<paths.engine>/pipeline/*`, templates, methodology, state schema | Matching docs (`docs/*`, `INSTALL.md`, `README.md` when user-facing); rebuild template if engine repo |
| Behaviour in product code | Tests per `testing.md`; docs per `docs.md`; `product/features.json` if tracked |
| `harness/VERSION` (engine repo) | `package.json`, `create-midas/package.json`, `gemini-extension.json`, `CHANGELOG.md`, `harness/state.schema.md` example stamp, docs version pins — `scripts/test.mjs` asserts parity |
| Installer (`create-midas/index.mjs`) | `scripts/test.mjs`; smoke both layouts if layout paths touched |
| `.mcp.json` or skill `mcp-required` | `state.yaml → mcp:` list; `node <paths.scripts>/mcp-drift.mjs` / doctor `mcp:*` checks |
| Sprint behaviour / acceptance criteria | Tests; `{runs}/verifications/` if UI; `{runs}/audits/` at `/close-sprint` |

**Never hand-edit generated trees** (`plugins/midas/`, `create-midas/template/`, `CLAUDE.md`,
`.cursor/rules/`, `.windsurf/rules/`, `GEMINI.md`) — edit the source, then run the render/build path.

## Checklist

### After any substantive edit (before marking work done)
- [ ] Identified which row(s) in the propagation matrix apply to this diff.
      **CHECK:** `manual:` the PR/sprint notes or `/midas-align` report names each downstream surface
      touched; an unmentioned generated tree in the diff that was hand-edited is a fail.
- [ ] Ran the cheapest alignment ladder that proves sync (product: doctor + tests; engine: `npm run align`).
      **CHECK:** `npm run align` (engine) or `/midas-align` exits with `verdict=aligned` or lists only
      resolved gaps; exit 1 with open gaps is a fail before merge.
- [ ] No generated adapter committed without a matching source edit in the same change set.
      **CHECK:** `git diff --name-only` shows no lone edits under `plugins/midas/`, `create-midas/template/`,
      or managed adapter regions without a corresponding `.claude/`, `harness/`, or `scripts/` source change.

### Version and docs (engine releases)
- [ ] `harness/VERSION` bump cascades to all mirrors listed in `VERSIONING.md` § Release checklist.
      **CHECK:** `node scripts/test.mjs` version:* checks pass when `harness/VERSION` is in the diff.
- [ ] User-facing behaviour or install flow change updates `INSTALL.md`, `docs/getting-started.md`, or
      `docs/index.md` in the same change set.
      **CHECK:** `manual:` a diff touching installer flags, layout, or skill commands also touches at least
      one user-facing doc; undocumented install/flow change is a fail.

### Product installs
- [ ] Rule or convention edits re-render adapters before the next sprint task is marked done.
      **CHECK:** `node <paths.scripts>/doctor.mjs` reports no adapter `drift` after a `<paths.engine>/rules/` diff.
- [ ] Phase playbook prose uses `{runs}/` tokens; skills read `paths.state` — not hardcoded classic paths.
      **CHECK:** `grep -rnE 'harness/state\.yaml' .claude/skills/` → only examples naming classic layout, not
      as the sole read path in ritual guards.

## Relationship to other commands

| Command | Scope |
|---|---|
| `/midas-align` | Full propagation pass — matrix + ladder + gap report (run after substantive edits) |
| `/midas-doctor` | Adapter drift + install health (subset of align) |
| `/midas-sweep` | Dead flows and stale docs vs reality (brownfield hygiene) |
| `/close-sprint` | Phase-8 rule audit for a shipped sprint |
