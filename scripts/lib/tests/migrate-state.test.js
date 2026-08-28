import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStateMigrations,
  parseAppliedMigrations,
  pendingMigrations,
  writeAppliedMigrations,
} from '../migrate-state.mjs';

const STATE = 'midas_version: 2.9.9\nlayout: harness\nsetup_complete: true\n';

function project(migrations = {}, state = STATE) {
  const root = mkdtempSync(join(tmpdir(), 'midas-migrate-state-'));
  mkdirSync(join(root, 'engine', 'state-migrations'), { recursive: true });
  mkdirSync(join(root, '.harness'), { recursive: true });
  writeFileSync(join(root, '.harness', 'state.yaml'), state, 'utf8');
  for (const [name, body] of Object.entries(migrations)) {
    writeFileSync(join(root, 'engine', 'state-migrations', name), body, 'utf8');
  }
  return root;
}

const opts = { engineDir: 'engine', statePath: '.harness/state.yaml' };

/** Migration that appends a marker key, so double-application would be visible. */
function appendKey(id, key) {
  return `export const id = '${id}';\n` +
    `export const description = 'add ${key}';\n` +
    'export async function up(ctx) {\n' +
    `  ctx.patchState((yaml) => yaml.includes('${key}:') ? yaml : yaml + '${key}: 1\\n');\n` +
    '}\n';
}

describe('applied-migration ledger', () => {
  it('round-trips an inline list', () => {
    assert.deepEqual(parseAppliedMigrations('migrations: [0001-a, 0002-b]'), ['0001-a', '0002-b']);
    assert.deepEqual(parseAppliedMigrations('midas_version: 1.0.0'), []);
    assert.equal(
      writeAppliedMigrations('migrations: [0001-a]', ['0001-a', '0002-b']),
      'migrations: [0001-a, 0002-b]',
    );
  });

  it('appends the key when the state has none', () => {
    assert.match(writeAppliedMigrations(STATE, ['0001-a']), /\nmigrations: \[0001-a\]\n$/);
  });
});

describe('applyStateMigrations', () => {
  it('applies pending migrations in id order and records them', async () => {
    const root = project({
      '0002-second.mjs': appendKey('0002-second', 'second'),
      '0001-first.mjs': appendKey('0001-first', 'first'),
    });
    try {
      const result = await applyStateMigrations(root, opts);
      assert.deepEqual(result.applied, ['0001-first', '0002-second']);
      const yaml = readFileSync(join(root, '.harness', 'state.yaml'), 'utf8');
      assert.match(yaml, /first: 1/);
      assert.match(yaml, /second: 1/);
      assert.deepEqual(parseAppliedMigrations(yaml), ['0001-first', '0002-second']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is idempotent — a second run applies nothing', async () => {
    const root = project({ '0001-first.mjs': appendKey('0001-first', 'first') });
    try {
      await applyStateMigrations(root, opts);
      const first = readFileSync(join(root, '.harness', 'state.yaml'), 'utf8');
      const again = await applyStateMigrations(root, opts);
      assert.deepEqual(again.applied, []);
      assert.equal(readFileSync(join(root, '.harness', 'state.yaml'), 'utf8'), first);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('applies by unapplied id, not by version range', async () => {
    // Same midas_version across commits (the `edge` channel case): a semver window would skip this.
    const root = project(
      { '0007-late.mjs': appendKey('0007-late', 'late') },
      `${STATE}migrations: [0001-first]\n`,
    );
    try {
      const result = await applyStateMigrations(root, opts);
      assert.deepEqual(result.applied, ['0007-late']);
      assert.deepEqual(
        parseAppliedMigrations(readFileSync(join(root, '.harness', 'state.yaml'), 'utf8')),
        ['0001-first', '0007-late'],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports pending work without writing under dryRun', async () => {
    const root = project({ '0001-first.mjs': appendKey('0001-first', 'first') });
    try {
      const result = await applyStateMigrations(root, { ...opts, dryRun: true });
      assert.deepEqual(result.pending, ['0001-first']);
      assert.equal(readFileSync(join(root, '.harness', 'state.yaml'), 'utf8'), STATE);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('skips cleanly when there is no state file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-migrate-state-none-'));
    try {
      const result = await applyStateMigrations(root, opts);
      assert.equal(result.skipped, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists nothing pending when the migrations dir is absent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-migrate-state-empty-'));
    try {
      assert.deepEqual(await pendingMigrations(join(root, 'engine'), []), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
