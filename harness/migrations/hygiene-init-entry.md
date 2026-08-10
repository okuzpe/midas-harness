# Migration — hygiene + init (setup/update entry)

Product-repo hygiene as a primary orchestrator; `/midas-init` becomes the single
install/setup/update tip entry. No `/midas-onboard`.

## What changed

| Before (≤2.9.5) | After (2.9.6+) |
|---|---|
| Dead-flow / lean tips → `/midas-sweep` / `/midas-lean-review` as peer-ish | Primary **`/midas-hygiene`** path-passes sweep scope **`product`** + optional lean |
| Setup → `/midas-init`; upgrade tip → `/midas-update` | **`/midas-init`** diagnose matrix covers both; **`/midas-update`** deprecated → init |
| Diagnose `nextSlash` → `/midas-update` when behind | Diagnose → **`/midas-init`** for setup/update states |
| Close Step 0 → path-pass sweep/lean | Close Step 0 → path-pass **`midas-hygiene`** body |

## Surfaces

| Skill | Surface |
|---|---|
| `midas-hygiene` | **primary** |
| `midas-init` | **primary** (expanded) |
| `midas-update` | **deprecated** → `/midas-init` |
| `midas-sweep` / `midas-lean-review` | **internal** (unchanged; hygiene parents them) |

## Install / update steps

1. Refresh engine: `npx github:okuzpe/midas-harness#v{VERSION} --update --yes`
2. Prefer `/midas-hygiene` for product dead flows / lean; never for doctor/align.
3. Prefer `/midas-init` when unsure about install/setup/version; type deprecated `/midas-update` only if muscle memory — it forwards.
4. Re-run `/midas-doctor` if adapters look stale after refresh.

## Anti-typo

| Token | Role |
|---|---|
| `/midas-hygiene` | Product-repo cleanup only |
| `/midas-init` | Setup + version/layout tip |
| `/midas-doctor` / `/midas-align` | Adapter/engine sync — **not** hygiene |
| `/midas-onboard` | **Does not exist** — do not create |
