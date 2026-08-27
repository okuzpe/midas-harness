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
| `harness/skills/*` or `harness/agents/*` (engine source — **not** the generated `.claude/` / `.agents/` mirrors) | **Engine repo:** `npm run build` (syncs `.claude/`, `.agents/`, `harness/plugins/midas/`, `harness/.claude-plugin/marketplace.json`, `cli/template/`). **Product:** adapters only if conventions changed. Never hand-edit generated skill trees. |
| `<paths.engine>/pipeline/*`, templates, methodology, state schema | Matching docs (`docs/*`, `INSTALL.md`, `README.md` when user-facing); rebuild template if engine repo |
| Behaviour in product code | Tests per `testing.md`; docs per `docs.md`; `{product}/features.json` if tracked |
| `harness/VERSION` (engine repo) | **Mandatory:** `npm run bump -- <X.Y.Z>` writes this file only; `scripts/sync-version.mjs` propagates all mirrors (`npm run build` runs sync first). Never hand-scatter version strings. Skills/docs use `#v{VERSION}` or read VERSION at runtime. `install.sh` / `install.ps1` read `harness/VERSION` at runtime. See `VERSIONING.md` § Release checklist. |
| Installer (`cli/index.mjs`) | `scripts/test.mjs`; smoke both layouts if layout paths touched |
| `.mcp.json` or skill `mcp-required` | `state.yaml → mcp:` list; `node <paths.scripts>/mcp-drift.mjs` / doctor `mcp:*` checks |
| Sprint behaviour / acceptance criteria | Tests; `{runs}/verifications/` if UI; `{runs}/audits/` at `/close-sprint` |

**Never hand-edit generated trees** (`harness/plugins/midas/`, `harness/.claude-plugin/`, `cli/template/`,
`.agents/skills/`, `CLAUDE.md`, `.cursor/rules/`, `.windsurf/rules/`, `GEMINI.md`) — edit the source,
then run the render/build path.

## Adapter digest strategy (engine repo)

**Option C (active)** per [ADR-014](../../docs/adr/ADR-014-adapter-digest-on-demand.md):
`render-adapters.mjs` puts conventions + Context7 in the always-on adapter and the **full**
`**CHECK:**` digest (base `<paths.engine>/rules/` **plus** project overlays from `<paths.rules>/`)
in a host on-demand file when the host supports it.

- **Cursor:** `.cursor/rules/00-midas.mdc` (`alwaysApply: true`) = conventions; `.cursor/rules/01-midas-checks.mdc`
  (`alwaysApply: false`) = full digest including overlays.
- **Gemini:** no on-demand surface — `GEMINI.md` points at `<paths.engine>/checks.json` and `rules/`;
  do not inline the digest.
- **Windsurf:** split when current docs name an on-demand trigger; otherwise keep digest inline in
  the `always_on` file.
- **Claude Code:** unchanged (short `CLAUDE.md` pointer; native `rules/` read).

Dedupe overlapping CHECKs in **source rules** via cross-references (`see code-quality.md` § …) —
do not add a parallel `_fragments/` layer (see `conventions.md` precedence).
**Option A** (full digest always-on) is superseded. **Option B** (title-only digest + links)
remains rejected (drops audit text).

## Checklist

### After any substantive edit (before marking work done)
- [ ] Identified which row(s) in the propagation matrix apply to this diff.
      **CHECK:** `manual:` the PR/sprint notes or `/midas-align` report names each downstream surface
      touched; an unmentioned generated tree in the diff that was hand-edited is a fail.
- [ ] Ran the cheapest alignment ladder that proves sync (product: doctor + tests; engine: `npm run align`).
      **CHECK:** `npm run align` (engine) or `/midas-align` exits with `verdict=aligned` or lists only
      resolved gaps; exit 1 with open gaps is a fail before merge.
- [ ] No generated adapter committed without a matching source edit in the same change set.
      **CHECK:** `git diff --name-only` shows no lone edits under `harness/plugins/midas/`,
      `harness/.claude-plugin/`, `cli/template/`, or managed adapter regions without a
      corresponding `.claude/`, `harness/`, or `scripts/` source change.

### Version and docs (engine releases)
- [ ] **Engine version publishes use `npm run bump` — never hand-scatter version strings.**
      To cut a release (or any intentional `harness/VERSION` change) run
      `npm run bump -- <X.Y.Z>` (writes `harness/VERSION` only), which runs
      `scripts/sync-version.mjs` + `npm run build`. Do **not** hand-edit package mirrors,
      `INSTALL.md` pins, or skill `#v…` tags. Then finish CHANGELOG + `git tag`.
      Full checklist: `VERSIONING.md` § Release checklist.
      **CHECK:** `manual:` when `harness/VERSION` is in the PR/sprint diff, the session or PR notes
      name `npm run bump -- <ver>`; a VERSION bump done by editing mirrors/pins by hand without that
      command is a fail.
      **CHECK:** `node scripts/sync-version.mjs --check` exits 0 when `harness/VERSION` is in the diff.
      **CHECK:** `node scripts/test.mjs` `version:*`, `version-pin:*`, and `version:sync-check` pass.
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
| `npm run bump -- <ver>` | **Engine repo only** — mandatory path to publish / bump `harness/VERSION` |

## Amendment

- **2026-08-27** — Adapter digest strategy Option C (on-demand full CHECK digest) per ADR-014.
  Supersedes ADR-005's inline-digest clause. Overlay CHECKs travel with the digest file, not the
  always-on conventions file.
- **2026-08-08** — Marketplace catalog at `harness/.claude-plugin/marketplace.json` (not repo root;
  stripped from install template with `plugins/`).
- **2026-08-08** — Plugin bundle output lives under `harness/plugins/midas/` (generated; stripped from install template).
- **2026-08-08** — Propagation matrix: skill/agent edits start at `harness/skills|agents` (engine
  source), not generated `.claude/` / `.agents/` mirrors. Clarifies contributor edit target.
- **2026-08-08** — Companion rule `engine-repo-boundary.md`: never nest a product `.harness/engine`
  install into this engine repository (installer hard-refuses).
- **2026-08-01** — Engine version publishes must use `npm run bump -- <X.Y.Z>` (no hand-scattered
  pins). Added CHECK + command table row; `INSTALL.md` remains the sole copy-paste `#v…` surface.
