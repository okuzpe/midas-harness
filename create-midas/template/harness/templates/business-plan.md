<!-- Phase 3 — Business Case artifact. Orchestrator decides; requires HUMAN sign-off before Phase 4.
     Exit gate: MVP scope+non-goals, measurable metrics, revenue/cost model, go/no-go + human sign-off. -->

# Business plan — {{PROJECT_NAME}}

## MVP scope

<!-- TODO: bullet list of what IS in MVP — concrete features/capabilities, not vague intentions -->

- …

## MVP non-goals (explicit exclusions)

<!-- TODO: what is deliberately out of scope for the initial release — prevents scope creep -->

- …

## Success metrics

<!-- TODO: measurable, time-bound — each metric must be checkable in Phase 8 audits -->

| Metric | Target | Measurement method | Time horizon |
|---|---|---|---|
| … | … | … | … |

## Revenue / cost model

<!-- TODO: how does this product make money (or justify its cost if internal tool)?
     Keep honest about assumptions. -->

### Revenue streams

- …

### Key cost drivers

- …

### Unit economics hypothesis

<!-- TODO: e.g. "CAC < $X, LTV > $Y at Z% conversion" — even rough is better than omitted -->

…

## Validation status

<!-- Desk validation (Phase 2) is required; field validation is strongly recommended but MAY be deferred
     with a logged assumption — the founder is not hard-walled. -->

- **Desk validation (Phase 2):** demand verdict <!-- strong | mixed | weak --> (see `product/market.md`).
- **Field validation** (interviews / a real preorder / a paid-ad demand test): <!-- done (summary + evidence) | DEFERRED -->
- **If deferred — assumption:** "real-customer demand is unproven; field validation deferred." Logged as a
  top risk; re-surface before launch/scale and in `/midas-tribunal`.

## Go / no-go recommendation

<!-- TODO: orchestrator verdict — go | go-with-field-validation-deferred | conditional-go | no-go -->

**Verdict:** <!-- go | no-go | conditional-go -->

**Rationale:**

…

**Conditions (if conditional-go):**

- …

## Human sign-off

<!-- REQUIRED: Phase 4 does not start until a human approves this section. -->

- [ ] Reviewed by: <!-- name / handle -->
- [ ] Approved on: <!-- YYYY-MM-DD -->
- [ ] Notes: <!-- any amendments the human made -->

---

*Gate check: MVP scope + non-goals ✓, measurable metrics ✓, model ✓, validation status ✓, go/no-go ✓, human sign-off ✓.*
*Next: run `/choose-architecture` (Phase 4).*
