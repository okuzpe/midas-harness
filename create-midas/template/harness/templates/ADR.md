<!-- Architecture Decision Record template. One file per major decision, filed under product/adr/.
     Naming: ADR-NNN-short-title.md (zero-padded three-digit number, kebab title).
     Phase 4 exit gate requires >=1 ADR per major stack decision. -->

# ADR-NNN — {{TITLE}}

| Field | Value |
|---|---|
| **Status** | <!-- proposed \| accepted \| deprecated \| superseded-by: ADR-NNN --> |
| **Date** | <!-- YYYY-MM-DD --> |
| **Deciders** | <!-- names / tiers involved (e.g. orchestrate tier + human) --> |
| **Context7 verified** | <!-- yes \| no \| n/a (for non-library decisions) --> |

## Context

<!-- TODO: what situation, constraint, or requirement makes this decision necessary?
     Be specific — link to the business plan metric or architecture requirement this serves. -->

…

## Decision

<!-- TODO: one clear sentence stating the choice made -->

We will use **…** for **…**.

## Considered alternatives

<!-- TODO: at least two alternatives evaluated — what was rejected and why -->

| Alternative | Pros | Cons | Reason rejected |
|---|---|---|---|
| … | … | … | … |
| … | … | … | … |

## Consequences

### Positive

<!-- TODO: what this decision enables -->

- …

### Negative / trade-offs

<!-- TODO: what this decision costs or closes off — be honest -->

- …

### Risks

<!-- TODO: what could go wrong; how to detect / mitigate -->

- …

## Context7 verification log

<!-- If this decision involves a third-party library, paste the resolved ID and doc excerpt here. -->

```
Library: …
Resolved ID: …
Version: …
Docs fetched: YYYY-MM-DD
Key finding: …
```

---

*Link this ADR from `product/architecture.md → ADR index` once accepted.*
