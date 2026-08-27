# Response map — L3 for `/midas-help`

> Loaded after the user picks **one** AskQuestion option. Copy **only** that option’s
> What / Command / Happens / NOT / Next into the ≤15-line answer. Do not load the rest.

**Set up or update Midas**
- What: single entry — diagnose install/setup/version, then tip install CLI, run intake, or tip `--update`.
- Command: `/midas-init` [`--monorepo`]
- Happens: runs diagnose; `not_installed` → install tip + stop; `setup_pending` → adaptive intake; version behind → tip pinned `--update`.
- NOT if you only want a read-only “which command?” print → `/midas-reconcile`.
- Next: `/midas-status` after setup/refresh.

**Start a product idea or adopt brownfield**
- What: Phase 0 idea capture, or brownfield adopt inventory.
- Command: `/idea-intake` · existing code → `/midas-adopt` (or `/midas-init` first if setup incomplete)
- Happens: writes idea/inventory artifacts; may set brownfield mode.
- NOT if Midas is not installed / setup incomplete → `/midas-init` first.
- Next: `/midas-status` then the phase skill it names.

**Resume after a break**
- What: cheap PC + optional context pack.
- Command: `/midas-status` then `/midas-recall` if mid-phase or `last_touched` > 7 days.
- Happens: status prints the single next command; recall lists ~15 paths + a 30-line brief.
- NOT if install is broken → `/midas-reconcile` first.
- Next: the command status names.

**Run the next phase gate**
- What: advance one audited phase (0–8).
- Command: `/midas-status` names it; catalog in `docs/skills.md` § Pipeline.
- Happens: skill writes its artifact, updates `paths.state`, waits for human gate confirmation.
- NOT for ad-hoc investigation outside the pipeline → `/midas-explore`.
- Next: `/midas-status` again after the gate.

**Start or close a sprint**
- What: Phase 7 kickoff, Phase 8 audit, bounded sprint ticks, or a non-advancing retrospective.
- Command: `/start-sprint` · `/close-sprint` · `/midas-auto-pilot` (Sprint checklist / `setup`) → `node .harness/autonomy/bin/midas-autopilot.mjs setup` · `/midas-retro` [`NN|latest`]
- Happens: start activates sprint and path-passes STM (`midas-progress`); close path-passes hygiene/diff-gates/lean as needed then audits rules; auto-pilot sprint path guides setup/dry-run/tick CLI (requires `--autonomy` install); retro freezes `{runs}/retros/retro-NN.md` without touching stage.
- NOT for operator-only sprint tasks (release/merge) — ADR-009 targets code checklist items. NOT for inventing continuous improve without a checklist → `/midas-auto-pilot` Continuous evolve. Retro is not a substitute for `/close-sprint`.
- Next: after start → implement per Phase 7 (STM via path-pass progress); after close → next sprint; after retro → optional `/midas-capture` on recurring learnings.

**Autonomy / auto-pilot**
- What: one slash for continuous evolve (PR|code → tick → `/loop`) **or** ADR-009 sprint checklist guide (setup/status/tick).
- Command: `/midas-auto-pilot` (bare → Mode Ask) · `/midas-auto-pilot pr|code|local|cloud|stop` · `/midas-auto-pilot setup|status|dry-run|tick`
- Happens: Mode gate if bare; evolve writes `{runs}/auto-pilot/runbook.md` and arms `/loop`; sprint path shells `midas-autopilot.mjs` (never auto-`tick` from chat).
- NOT Phase-8 (`/close-sprint`). Laptop sleep → evolve `cloud` mode. Deprecated aliases forward here (not listed as options).
- Next: leave Cursor open for evolve; review PRs or local diffs; `/close-sprint` when a sprint’s worth lands. Command map: `docs/skills.md` § Autonomy commands.

**Verify UI before close**
- What: gate evidence for UI/API acceptance journeys.
- Command: `/midas-verify` (before close)
- Happens: drives flows, freezes `{runs}/verifications/verify-NN.md`.
- NOT for non-UI sprints (verify hard-skips). NOT for root-cause before a bug fix → `/midas-investigate`. Ad-hoc branch smoke is path-passed inside Phase 7 (`midas-qa` internal) — do not list as a separate menu command.
- Next: `/close-sprint` when verify is green.

**Debug a failing fix**
- What: freeze symptoms → flow → hypotheses before speculative fixes; stop after 3 failed strikes.
- Command: `/midas-investigate` [`topic`] · `--continue NN` · `--dry-run`
- Happens: writes `{runs}/investigate/inv-NN.md`; does not advance stage.
- NOT open-ended scoping → `/midas-explore`. NOT conformance → `/close-sprint`.
- Next: implement fix + regression test; cite `inv-NN` in progress (path-pass STM).

**Redesign product UI**
- What: authentic redesign with directions + human pick before implementation.
- Command: `/midas-design` [`--mode audit|directions|spec|implement`]
- Happens: audits current UI, proposes art directions, freezes a design record; optional one-slice implement.
- NOT Phase 5 freeze → `/define-conventions`; NOT gate proof → `/midas-verify`.
- Next: `/midas-verify` on the touched surface when implementing.

**Security or adversarial review**
- What: deep security scan or whole-project debate — neither advances gates.
- Command: `/midas-security-audit` · `/midas-tribunal`
- Happens: freezes `{runs}/security/` or `{runs}/debates/debate-NN.md`.
- NOT a substitute for `/close-sprint` sprint conformance.
- Next: fix findings; then `/close-sprint` when ready.

**Clean dead flows / lean the repo**
- What: product-repo hygiene — dead routes, orphans, ledger/doc drift, optional lean delete-list.
- Command: `/midas-hygiene` [`all|dead-flows|docs|lean|report-only`]
- Happens: path-passes sweep scope `product` (+ lean on fat diffs); freezes `sweep-NN.md` / optional `lean-NN.md`.
- NOT adapter sync → `/midas-doctor`. NOT binding gate → `/close-sprint` (close path-passes hygiene in Step 0).
- Next: `/close-sprint` when in an active sprint, else `/midas-status`.

**Capture a recurring pattern**
- What: crystallize a rule, playbook, or convention (asks first).
- Command: `/midas-capture`
- Happens: capture proposes an artifact; never writes silently.
- NOT for one-off preferences with no CHECK → say so and skip. Product hygiene → `/midas-hygiene`.
- Next: `/midas-doctor` if a rule changed.

**Export or import project knowledge**
- What: portable JSON of state, product docs, rules, playbooks, frozen evidence (no secrets).
- Command: `/midas-bundle`
- Happens: runs `<paths.scripts>/bundle.mjs` export or import; checksums; conflict preview.
- NOT a git replacement. NOT engine-contributor PR bar → `/midas-precommit` (engine repo only; not a product menu item).
- Next: `/midas-status` after import; `/midas-align` after engine-side edits.

**Install confusion / adapter health**
- What: read-only “which command?” or adapter/engine sync (not setup/update — that is `/midas-init`).
- Command: `/midas-reconcile` · `/midas-doctor` · `/midas-align` (engine edits). Engine contributors: `/midas-precommit`.
- Happens: prints next CLI/slash command or re-renders adapters.
- NOT for first-time setup or version refresh → `/midas-init`.
- Next: the command reconcile/doctor names.

**Investigate something outside the pipeline**
- What: multi-turn notes session that does not advance phases.
- Command: `/midas-explore <topic>` · `/midas-explore --end`
- Happens: writes `{runs}/explore/<slug>/notes.md`; end may propose `/midas-capture`.
- NOT when a sprint is `active` and you should implement → finish or pause sprint first.
- Next: `/midas-capture` or a phase skill if findings justify it.

**I'm not sure — show a short summary table**

Print the **canonical router** from `docs/skills.md` § Which command when (install:
`<paths.engine>/docs/skills.md`) — do not invent rows. Prefer **primary** commands; mention
internals only as parent-owned path-pass. End with: Pipeline PC = `/midas-status`.
