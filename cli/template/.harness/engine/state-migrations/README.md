# State migrations

Ordered, idempotent changes to an installed project's state and layout, applied by `midas update`
inside the same transaction as the vendor copy (rollback with `--rollback` covers them).

## Contract

One module per migration, named `NNNN-<slug>.mjs`:

```js
export const id = '0001-example';
export const description = 'One line, imperative — shown in the update report.';

/**
 * @param {{
 *   root: string,          // project root
 *   engineDir: string,     // absolute path to the installed engine
 *   statePath: string,     // absolute path to state.yaml
 *   patchState: (fn: (yaml: string) => string) => void,
 * }} ctx
 */
export async function up(ctx) {
  ctx.patchState((yaml) => yaml.replace(/^old_key:/m, 'new_key:'));
}
```

## Rules

- **Applied by id, never by version range.** `harness/VERSION` only moves on `npm run bump`, so on
  the `edge` channel many commits share one version. The runner applies every id absent from
  `migrations:` in `state.yaml`.
- **Idempotent anyway.** Write `up()` so a second run is harmless; the ledger is a safety net, not
  an excuse.
- **Zero-padded ids.** Lexicographic order is apply order.
- **No network, no prompts.** Migrations run unattended during an update.
- **Never touch user content** beyond the specific shape being migrated (`{product}/`, `rules/`,
  and `runs/` belong to the project).

Runner: `scripts/lib/migrate-state.mjs`.
