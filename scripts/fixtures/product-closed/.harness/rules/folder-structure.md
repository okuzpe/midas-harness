# Rule: Folder structure (fixture overlay)

Product code lives under `product/src/`. Route handlers may import from `lib/`; `lib/` must not import from `app/`.

## CHECK

- **CHECK:** `manual:` route handlers reach persistence only via shared `lib/` modules.
