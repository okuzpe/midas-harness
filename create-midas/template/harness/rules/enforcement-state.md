# Rule: Enforcement state is recorded and honest (always-on)

Phase 5 scaffolds the stack's linter/formatter, git hooks, commit-msg lint, and a CI job — but the
**install is recommend-don't-wall**, so the user may decline. If that decision is silent, no later
reader (or audit) can tell whether a rule's CHECK is actually enforced **on every commit** or only
graded by hand at Phase 8. So the decision must be **recorded and checkable**.

## Requires

- `/define-conventions` Step 5 writes an `enforcement:` block to `harness/state.yaml` — one entry per
  scaffolded tool, naming the **config file** it wrote and whether it was **installed**:

  ```yaml
  enforcement:
    linter:     { config: biome.json, installed: true }
    git_hooks:  { config: lefthook.yml, installed: false }
    commit_msg: { config: commitlint.config.js, installed: false }
    ci:         { config: .github/workflows/ci.yml, installed: true }
  ```

- A named config file that does **not** exist on disk is drift — the config was claimed but never
  written. `installed: false` is allowed (recommend-don't-wall), but is surfaced as
  "enforcement OFF for `<tool>` → its CHECKs are graded only at Phase 8", so the gap is **visible,
  never silent**.

## CHECK

- **CHECK:** `node scripts/doctor.mjs <project>` reports no `enforcement` **warn** — every named config
  file exists on disk. Any `installed: false` is reported as an advisory `ok` note, not a fail.
- **CHECK:** when a stack rule's CHECK names a linter/scanner as its machine-readable form, a matching
  `enforcement:` entry exists and its config file is present. *(manual.)*
