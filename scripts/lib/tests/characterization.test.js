import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareCharacterizationSnapshots,
  snapshotFile,
} from '../characterization.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('characterization snapshots', () => {
  it('install-contract.json lists cursor and multihost paths', () => {
    const p = snapshotFile(ROOT, 'install-contract.json');
    assert.equal(existsSync(p), true);
    const contract = JSON.parse(readFileSync(p, 'utf8'));
    assert.ok(contract.cursor.mustExist.includes('AGENTS.md'));
    assert.ok(contract.cursor.mustNotExist.includes('.claude'));
    assert.ok(contract.multihost.mustExist.includes('.claude/CLAUDE.md'));
  });

  it('adapter / template / plugin / doctor snapshots match live generators', () => {
    if (process.env.MIDAS_UPDATE_SNAPSHOTS === '1') {
      const wrote = compareCharacterizationSnapshots(ROOT, { update: true });
      assert.equal(wrote.ok, true);
      return;
    }
    const result = compareCharacterizationSnapshots(ROOT);
    assert.equal(
      result.ok,
      true,
      result.diffs.join('; ') + ' — run `node scripts/test/snapshots/refresh.mjs` after intentional generator changes',
    );
  });
});
