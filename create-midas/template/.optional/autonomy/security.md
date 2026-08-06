# Fail-closed autonomy hooks (P0)

Cloud Agents and local runners must **not** receive controller credentials,
merge/deploy tokens, or the journal MAC key.

Machine-readable policy: [`hooks/fail-closed.json`](./hooks/fail-closed.json)
evaluated by [`lib/hooks.mjs`](./lib/hooks.mjs) before every builder/auditor effect.

## Required controls

| Control | P0 expectation |
|---|---|
| Branch allowlist | Only `policy.branch.prefix*` |
| Default branch push | Forbidden |
| Network allowlist | Documented per project; deny by default in cloud hooks |
| Filesystem mutators in auditor | Blocked — auditor is read-only detached SHA |
| Secret inheritance | Inject only via `lib/credentials.mjs` role env; never to child agents |
| Authz HMAC | Local `.harness/autonomy/authz/hmac` (auto via `setup`) or optional `MIDAS_AUTONOMY_AUTHZ_KEY`; `schema_version: 2`; unsigned/v1 grants fail closed |
| Log redaction | Allowlist fields only (`redactForJournal`); no raw prompts/tool output |
| Policy / metapolicy | Agent-inaccessible; human out-of-band to change |
| Broker mediation | Every Cloud run receives only `authorizeBuilderEffects` allowlist |

## Ordinary chat vs controller

Side-effecting Midas skills keep `disable-model-invocation: true`. Ordinary
conversations cannot start `execute-next-sprint-task`. Only `midas-autopilot`
(authenticated controller + valid policy digest + commit/push authz) may.

## Bypass tests

Covered in `scripts/test.mjs` autonomy fixtures:

- broker denies policy path writes, untrusted-derived shell, merge, injection markers
- fail-closed hooks deny auditor writes and env leaks
- credential leak / rotation / revocation registry
- stale policy digest invalidates commit/push authz
- journal reorder / rewrite / truncate detection
- crash-before / crash-after + reconcile without duplicate create
- pre-start budget envelope, quota pause, unknown limit
- incorrect SHA + auditor mutator probe
