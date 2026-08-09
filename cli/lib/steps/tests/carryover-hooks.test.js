import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  installCarryoverHookCommand,
  isMidasCarryoverHookCommand,
  mergeCarryoverHooks,
  stripCarryoverHooks,
} from '../carryover-hooks.mjs';
import { mergeTraceHooks, installTraceHookCommand } from '../trace-hooks.mjs';

describe('carryover-hooks', () => {
  it('installCarryoverHookCommand is marked and uses --hook', () => {
    const cmd = installCarryoverHookCommand();
    assert.match(cmd, /carryover-refresh\.mjs --hook/);
    assert.equal(isMidasCarryoverHookCommand(cmd), true);
    assert.equal(isMidasCarryoverHookCommand('echo hi'), false);
  });

  it('mergeCarryoverHooks seeds and preserves trace sessionStart', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-carryover-hooks-'));
    try {
      mergeTraceHooks(tmp);
      const seed = mergeCarryoverHooks(tmp);
      assert.equal(seed.wrote, true);

      const raw = JSON.parse(readFileSync(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
      const session = raw.hooks.sessionStart;
      assert.ok(session.some((h) => h.command === installTraceHookCommand('sessionStart')));
      assert.ok(session.some((h) => h.command === installCarryoverHookCommand()));
      assert.ok(session.every((h) => h.failClosed !== true));

      const again = mergeCarryoverHooks(tmp);
      assert.equal(again.action, 'noop');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('stripCarryoverHooks keeps trace entries', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-carryover-hooks-'));
    try {
      mergeTraceHooks(tmp);
      mergeCarryoverHooks(tmp);
      const stripped = stripCarryoverHooks(tmp);
      assert.equal(stripped.wrote, true);
      assert.equal(stripped.removed, false);

      const raw = JSON.parse(readFileSync(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
      assert.ok(!JSON.stringify(raw).includes('carryover-refresh'));
      assert.ok(
        raw.hooks.sessionStart?.some((h) => h.command === installTraceHookCommand('sessionStart')),
      );
      assert.equal(existsSync(join(tmp, '.cursor', 'hooks.json')), true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
