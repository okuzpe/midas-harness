# FAQ

---

**Q: How much does Midas cost to run?**

Midas itself is free (Apache-2.0). You pay your AI provider for model calls. The default balanced
profile routes most work to Sonnet (mid-tier), reserves Opus for the ~6 irreversible decisions
(architecture, phase gates, sprint audits), and uses Haiku for searches and status checks. The
`max_savings` profile in the state file (`paths.state`) drops orchestrate to Sonnet except on explicit
audits. See [Agents & Models](agents-and-models.md) for the full cost matrix.

---

**Q: Do I need Context7?**

No — it's **optional**. Midas mandates the *habit* (fetch current, version-accurate docs before
third-party code; never from memory), not a specific tool. Wire whichever you like: Context7 is the
recommended free option, or a web-fetch MCP / your editor's docs / a local mirror. Midas uses Context7's
**free anonymous tier only — no API key, ever**; if it ever stops being free, drop it and use a web-fetch
MCP / your editor's docs instead. With no doc tool wired, you must still fetch the official docs for the
pinned version by hand and cite them — the rule is the habit, not the vendor
(`harness/rules/context7-usage.md`).

---

**Q: I use Cursor / Copilot / Windsurf, not Claude Code. Does this work?**

Yes — with honest nuance. `AGENTS.md` carries the project law to Cursor, Copilot and Codex natively
(Codex/Copilot also read the Agent Skills standard); Windsurf reads `.windsurf/rules/` and Gemini reads
`GEMINI.md` and `gemini-extension.json` (generated adapters). Cursor also gets `.cursor/mcp.json` synced
from `.mcp.json`. Skill/command *execution* is fullest on Claude Code; elsewhere you still get the
methodology, rules, and MCP wiring. The one thing lost everywhere off Claude Code is automatic
per-subagent model routing — the tiers collapse to prose intent in `AGENTS.md`.

---

**Q: Where does Midas live under the harness layout?**

Everything Midas-owned lives under `.harness/` except selected-host discovery adapters. Classic,
compact, and hub 1.x installs remain detectable but are not updated in place. Preview migrate with
the pinned command in [INSTALL.md](https://github.com/okuzpe/midas-harness/blob/main/INSTALL.md), then repeat with `--apply`; verify with
`node .harness/scripts/doctor.mjs --strict`. See
[ADR-007](adr/ADR-007-canonical-harness-layout.md).

---

**Q: Plugin marketplace vs `npx github:` — which should I use?**

Use `npx github:okuzpe/midas-harness` (or the `curl|bash` / `irm|iex` shims) for a full project
install: it copies all harness files into the repo so any tool can read them, and runs the adapter
generator. Use the Claude Code plugin (`/plugin marketplace add ./harness` from a clone) if you want
to drive Midas purely from Claude Code without committing harness files to the repo. Note: the plugin
does not write `AGENTS.md`, `.claude/CLAUDE.md`, or the state file — you still need `/midas-init`
afterward, but the resulting files are local-only.

---

**Q: Is it safe to run `/midas-adopt` on a production codebase?**

Yes, by design. `/midas-adopt` is read-only during the inventory phase. It only writes new files
(inventory, architecture, rules) directly; for any pre-existing `AGENTS.md`, `.claude/CLAUDE.md`, `.mcp.json`,
or source file it computes the exact diff, shows it to you, and requires explicit confirmation before
touching anything. On decline it prints the block for manual paste. Nothing is ever silently rewritten.

---

**Q: How do I update Midas to a newer version?**

Prefer a **pinned** update. Copy the exact `#v…` command from [INSTALL.md](https://github.com/okuzpe/midas-harness/blob/main/INSTALL.md)
(matches `harness/VERSION` — do not invent the tag):
```bash
npx github:okuzpe/midas-harness#v{VERSION} update
```
`--update` refreshes manifest-owned engine/generated files and keeps your product/rules/runs. It is
**not** the same as install-time `--force`. On vendor edits outside overlays, same-version update
**aborts** before writing; stale manifest hashes **re-baseline** after confirm. Full contract:
[INSTALL.md § Updating an existing install](https://github.com/okuzpe/midas-harness/blob/main/INSTALL.md#updating-an-existing-install).
`/midas-init` tips the same pinned CLI when diagnose reports `version_behind`. 1.x
classic/compact/hub trees are **unsupported** in 3.x (`unsupported_v1` — pin create-midas@2.10.3,
migrate, then upgrade; see [ADR-018](adr/ADR-018-v1-layout-removal.md)). After a successful CLI verify, adapters
are already synced — `/midas-doctor` only if you still see drift. Unpinned `main` / pipe-to-shell
installs are higher risk (see SECURITY.md).

---

**Q: How do I uninstall Midas?**

Run the same one command with `--uninstall`: `npx github:okuzpe/midas-harness --uninstall` (or
`curl -fsSL …/install.sh | bash -s -- --uninstall`). It is **surgical** — it removes only Midas's own
engine files and **keeps your work** (`.harness/product/`, `.harness/rules/`, `.harness/runs/`, state)
unless you pass `--purge`; use `--dry-run` to preview. Prefer to remove it by hand? Delete host
mirrors, `.harness/`, and generated adapters per [INSTALL.md § Uninstalling](https://github.com/okuzpe/midas-harness/blob/main/INSTALL.md#uninstalling).
Your source code is untouched.

---

**Q: What is `/midas-retro` vs `/close-sprint`?**

`/close-sprint` is Phase 8 — a binding conformance audit against frozen rules (advances the sprint
gate ledger when attested). `/midas-retro` is a **non-advancing** learnings freeze under
`{runs}/retros/retro-NN.md` (went well / hurt / learned / carry). Run retro after a sprint lands;
it does not replace close-sprint. See [skills.md](skills.md).

---

**Q: What is `/midas-investigate` vs `/midas-explore`?**

`/midas-investigate` is **root-cause before a bug fix** (Iron Law + 3 strikes) and freezes
`{runs}/investigate/inv-NN.md`. `/midas-explore` is open-ended scoping outside the pipeline under
`{runs}/explore/`. Use investigate when something is broken; explore when you are still framing
the question. See [skills.md](skills.md).

---

**Q: What is the tribunal and when should I run it?**

`/midas-tribunal` is a standing, on-demand adversarial debate over the entire project. A steelman
Defense, a red-team Prosecution, and a dissent-forcing Catfish argue every assumption; an Opus judge
rules per claim and every claim must cite on-disk evidence or it is struck. Run it before big
irreversible decisions: pre-architecture-freeze, pre-go/no-go, pre-ship. It complements
`/close-sprint` (which audits code against frozen rules) by asking the prior question — were those
rules and decisions right in the first place?

---

**Q: Can I run only some phases and skip others?**

Yes, with an explicit recorded assumption. The `entry_stage` field in the state file marks
where you entered, and any skipped gate carries a `recorded_assumption` entry so the harness stays
honest. This is the standard path for brownfield projects (an E2 repo enters at Phase 5 via
`/midas-adopt`; E3 at Phase 6) and for teams that already have a market analysis or business case on file.
