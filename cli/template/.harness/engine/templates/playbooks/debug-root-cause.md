# Playbook: debug root cause

| | |
|---|---|
| **Use when** | A defect, failing test, or verify failure needs a fix — before speculative patches |
| **Trigger** | Human runs `/midas-investigate`, or Phase-7 hits the ~3 self-fix bound without a green result |
| **Skip when** | Pure typos the human named exactly; or `/midas-explore` for open-ended scoping |

## Steps

1. Run `/midas-investigate` with the symptom (or `--continue NN` to deepen an existing record).
2. Trace **symptoms → flow → falsifiable hypotheses → evidence** into `{runs}/investigate/inv-NN.md`.
3. **Iron Law:** do not edit product code to “try a fix” until the freeze exists (unless the human waives).
4. Implement the confirmed fix with a **regression** test (`testing.md` Coverage contract).
5. If **3 strikes** fail without a deeper investigation → stop and ask the human (`verdict=stop`).

## Exit checks

- [ ] `inv-NN.md` exists (or dry-run shown) with at least one hypothesis.
- [ ] Fix diff cites the investigation id in progress / PR.
- [ ] Regression proof in the same change set.
