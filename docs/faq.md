# FAQ

---

**Q: How much does Midas cost to run?**

Midas itself is free (Apache-2.0). You pay your AI provider for model calls. The default balanced
profile routes most work to Sonnet (mid-tier), reserves Opus for the ~6 irreversible decisions
(architecture, phase gates, sprint audits), and uses Haiku for searches and status checks. The
`max_savings` profile in `harness/state.yaml` drops orchestrate to Sonnet except on explicit
audits. See [Agents & Models](agents-and-models.md) for the full cost matrix.

---

**Q: Do I need a Context7 API key?**

Context7 has a free tier that covers light use. For active build sprints — where skills fetch live
library docs before every code change — a paid key avoids rate limits. Set it as the environment
variable `CONTEXT7_API_KEY` (never write it to disk or commit it). If Context7 is down or
unavailable, skills fall back to the documented web-search fallback; the harness never hard-fails on
a missing key.

---

**Q: I use Cursor / Copilot / Windsurf, not Claude Code. Does this work?**

Yes. `AGENTS.md` and `.claude/skills/` are read natively by Cursor, GitHub Copilot, Codex,
Windsurf, and Gemini. Methodology and MCP wiring are fully preserved. The one thing lost is
automatic per-subagent model routing — on those tools the tiers collapse to prose intent in
`AGENTS.md` ("use your fastest model for research, your strongest for architecture").

---

**Q: Plugin marketplace vs `npx github:` — which should I use?**

Use `npx github:okuzpe/midas-harness` (or the `curl|bash` / `irm|iex` shims) for a full project
install: it copies all harness files into the repo so any tool can read them, and runs the adapter
generator. Use the Claude Code plugin (`/plugin marketplace add okuzpe/midas-harness`) if you want
to drive Midas purely from Claude Code without committing harness files to the repo. Note: the plugin
does not write `AGENTS.md`, `CLAUDE.md`, or `harness/state.yaml` — you still need `/midas-init`
afterward, but the resulting files are local-only.

---

**Q: Is it safe to run `/midas-adopt` on a production codebase?**

Yes, by design. `/midas-adopt` is read-only during the inventory phase. It only writes new files
(inventory, architecture, rules) directly; for any pre-existing `AGENTS.md`, `CLAUDE.md`, `.mcp.json`,
or source file it computes the exact diff, shows it to you, and requires explicit confirmation before
touching anything. On decline it prints the block for manual paste. Nothing is ever silently rewritten.

---

**Q: How do I update Midas to a newer version?**

Re-run the install command in the project root:
```bash
curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
```
It skips files you have edited (non-destructive by default). Pass `--force` to refresh the engine
files. After updating, run `/midas-doctor` to re-sync the generated tool adapters with the new
conventions.

---

**Q: How do I uninstall Midas?**

Midas only adds files — it never modifies your existing source. Remove:
`.claude/`, `harness/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
`.cursor/rules/00-midas.mdc`, `.windsurf/rules/00-midas.md`, `.mcp.json`,
and the `.midas` / `.harness` state directory if present. Your source code is untouched.

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

Yes, with an explicit recorded assumption. The `entry_stage` field in `harness/state.yaml` marks
where you entered, and any skipped gate carries a `recorded_assumption` entry so the harness stays
honest. This is the standard path for brownfield projects (entering at Phase 4 or 5 via
`/midas-adopt`) and for teams that already have a market analysis or business case on file.
