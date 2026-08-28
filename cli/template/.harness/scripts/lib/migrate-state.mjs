// migrate-state.mjs — ordered, idempotent state migrations applied by id.
//
// Migrations are applied by "id not yet recorded in state", never by a version range: `VERSION`
// only moves on `npm run bump`, so on the `edge` channel dozens of commits share one version and a
// semver window would never fire. An id ledger is also idempotent by construction.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Directory (under the engine root) holding migration modules. */
export const MIGRATIONS_DIRNAME = 'state-migrations';

/** Read the applied-migration ids from a state.yaml body. */
export function parseAppliedMigrations(yaml) {
  const m = String(yaml || '').match(/^migrations:\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/**
 * Return a state.yaml body with `migrations:` set to `ids`.
 * Appends the key when absent, preserving everything else byte for byte.
 */
export function writeAppliedMigrations(yaml, ids) {
  const body = String(yaml || '');
  const line = `migrations: [${ids.join(', ')}]`;
  if (/^migrations:\s*\[[^\]]*\]/m.test(body)) {
    return body.replace(/^migrations:\s*\[[^\]]*\]/m, line);
  }
  const trimmed = body.replace(/\s*$/, '');
  return `${trimmed}\n${line}\n`;
}

/** Sorted migration module paths. Ids are zero-padded, so lexicographic order is apply order. */
export function listMigrationFiles(engineDir) {
  const dir = join(engineDir, MIGRATIONS_DIRNAME);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.mjs'))
    .sort()
    .map((name) => join(dir, name));
}

/**
 * Load every migration module, deriving a default id from the filename.
 * @returns {Promise<{id: string, description: string, up: Function, file: string}[]>}
 */
export async function loadMigrations(engineDir) {
  const out = [];
  for (const file of listMigrationFiles(engineDir)) {
    const mod = await import(pathToFileURL(file).href);
    const id = mod.id || file.split(/[\\/]/).pop().replace(/\.mjs$/, '');
    if (typeof mod.up !== 'function') {
      throw new Error(`state migration ${id} has no up() export`);
    }
    out.push({ id, description: mod.description || '', up: mod.up, file });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Migrations whose id is not yet in `appliedIds`. */
export async function pendingMigrations(engineDir, appliedIds = []) {
  const applied = new Set(appliedIds);
  return (await loadMigrations(engineDir)).filter((m) => !applied.has(m.id));
}

/**
 * Apply pending migrations and record their ids in state.
 *
 * @param {string} root project root
 * @param {{ engineDir: string, statePath: string, dryRun?: boolean }} opts
 *   `engineDir` and `statePath` are absolute or root-relative paths resolved by the caller from
 *   `paths` — this module never guesses the layout.
 * @returns {Promise<{applied: string[], pending: string[], skipped: boolean}>}
 */
export async function applyStateMigrations(root, opts) {
  const engineDir = join(root, opts.engineDir);
  const statePath = join(root, opts.statePath);
  if (!existsSync(statePath)) return { applied: [], pending: [], skipped: true };

  let yaml = readFileSync(statePath, 'utf8');
  const alreadyApplied = parseAppliedMigrations(yaml);
  const pending = await pendingMigrations(engineDir, alreadyApplied);
  if (!pending.length) return { applied: [], pending: [], skipped: false };
  if (opts.dryRun) {
    return { applied: [], pending: pending.map((m) => m.id), skipped: false };
  }

  const applied = [];
  for (const migration of pending) {
    await migration.up({
      root,
      engineDir,
      statePath,
      /** Read-modify-write the state body inside one migration step. */
      patchState(fn) {
        const current = readFileSync(statePath, 'utf8');
        const next = fn(current);
        if (typeof next === 'string' && next !== current) {
          writeFileSync(statePath, next, 'utf8');
        }
      },
    });
    applied.push(migration.id);
  }

  yaml = readFileSync(statePath, 'utf8');
  writeFileSync(statePath, writeAppliedMigrations(yaml, [...alreadyApplied, ...applied]), 'utf8');
  return { applied, pending: [], skipped: false };
}
