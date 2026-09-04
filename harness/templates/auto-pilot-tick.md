# Auto-pilot tick {{NN}}

> Freeze **before** any product edit. Path: `{runs}/auto-pilot/ticks/tick-NN.md`
> `source:` must already exist on disk — do not create OPEN / sweep / checklist rows this tick.

```yaml
n: {{NN}}
at: {{ISO}}
delivery: {{DELIVERY}}   # pr | code — from runbook; do not invent
source: {{SOURCE}}       # path + line, or features.json id — pre-existing
branch: {{BRANCH}}       # midas-auto/<date>-session (code) or midas-auto/<date>-<slug> (pr)
verify: {{VERIFY}}       # cheapest command that proves the change
```

## EARS

WHEN/IF/THEN: {{EARS}}

## Files (≤4 source + tests)

- {{FILE_1}}

## Stop

- Implement only this plan. If `source:` cannot be cited from an existing artifact → delete this file and journal `idle` instead.
