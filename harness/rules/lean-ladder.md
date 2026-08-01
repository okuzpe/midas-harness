# Rule: Lean solution ladder (always-on)

Before writing or expanding code, stop at the **first rung that holds**. Prefer the code never
written. Complements [`code-quality.md`](./code-quality.md) (reuse, no premature abstraction) with an
explicit pre-write climb and a delete-oriented review skill (`/midas-lean-review`).

> **Attribution:** Ladder shape inspired by [Ponytail](https://github.com/DietrichGebert/ponytail)
> (MIT). Midas owns this rule text, CHECKs, and `/midas-lean-review`. Installing upstream Ponytail
> for host hooks / `lite|full|ultra` levels is **optional** and complementary — do not vendor it.

> **Every item carries a `**CHECK:**`** — the Phase-8 audit evaluates these against the sprint diff
> and (when present) `{runs}/lean/lean-NN.md`.

## The ladder (climb after understanding)

Read the task and the code it touches; trace the real flow; **then** climb. Stop at the first hold:

1. **Need?** Speculative or unused capability → skip (YAGNI). Say so in one line.
2. **Already here?** Reuse the project's helper, type, or pattern — search before writing.
3. **Stdlib?** Prefer the language / runtime standard library.
4. **Native platform?** Prefer platform features (`<input type="date">`, CSS, DB constraints) over
   new app code or deps.
5. **Installed dependency?** Use what is already in the lockfile — do not add a package for a few lines.
6. **One line?** Prefer one clear line over a ceremony wrapper.
7. **Only then:** the minimum that works — fewest files, shortest correct diff.

**Bug fix = root cause.** Grep callers of the function you touch; one shared guard beats N call-site
patches.

## Never cut (not on the chopping block)

Do **not** simplify away: trust-boundary validation, error handling that prevents data loss,
security controls, accessibility basics, or anything the human explicitly requested. Hardware /
sensor / clock calibration knobs stay when the physical world needs them.

Non-trivial logic still ships with **one** runnable check (small test or assert self-check) —
YAGNI applies to test *frameworks*, not to proving the behaviour (see [`testing.md`](./testing.md)).

## Deliberate corners

If you knowingly ship a simplification with a known ceiling (global lock, O(n²), naive heuristic),
leave a `// lean: <ceiling>; upgrade when <condition>` note at the site (or `# lean:` / equivalent).

## Checklist

- [ ] New code in the sprint diff is justified by a rung ≤ 7; no speculative layer "for later".
      **CHECK:** `manual:` for each substantial added module/abstraction in the diff, the PR/sprint
      notes or `/midas-lean-review` record name the rung used (or why rung 7 was required); unexplained
      scaffolding is a fail.
- [ ] No new dependency when stdlib, native platform, or an already-installed package suffices.
      **CHECK:** `manual:` lockfile additions this sprint — each has a note that rungs 3–5 were
      considered; an unexplained new dep for a thin wrapper is a fail (pairs with `code-quality.md`
      Dependencies).
- [ ] Diff prefers deletion / shrink over parallel implementations.
      **CHECK:** `manual:` grep for the concept in `<src-root>/` (same as code-quality reuse CHECK);
      a second implementation of an existing pattern is a fail.
- [ ] Safety floor intact — lean did not remove boundary validation, authz, or a11y required by
      sibling rules.
      **CHECK:** `manual:` cross-read the sprint diff against `security.md` / `accessibility.md`
      CHECKs that apply to touched surfaces; a "lean" removal of a required control is a fail.
- [ ] Over-engineering review available before close when the diff is large.
      **CHECK:** `manual:` recommended (not hard-required): a `{runs}/lean/lean-NN.md` or progress
      note citing `/midas-lean-review` exists for UI/feature sprints with large diffs; absence alone
      is not a fail — unresolved **high** lean findings listed in the Phase-8 audit without
      fixed/deferred/accepted is a fail.

## Optional upstream composition

Teams that want Ponytail's always-on host hooks and `lite|full|ultra` session modes may install
[Ponytail](https://github.com/DietrichGebert/ponytail) alongside Midas. Prefer **one** always-on
voice: if both inject rules, keep Midas as project law and treat Ponytail as intensity UX — or turn
Ponytail `off` and rely on this rule + `/midas-lean-review`.

## Amendment

- **2026-08-01** — Introduced lean ladder (Ponytail-inspired) + `/midas-lean-review` pairing; optional
  upstream compose note.
