import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  installContextCostHookCommand,
  isMidasContextCostHookCommand,
  mergeContextCostHooks,
  stripContextCostHooks,
} from '../context-cost-hooks.mjs';
import { mergeTraceHooks, installTraceHookCommand } from '../trace-hooks.mjs';
import { mergeCarryoverHooks, installCarryoverHookCommand } from '../carryover-hooks.mjs';

describe('context-cost-hooks', () => {
  it('installContextCostHookCommand is marked and uses --hook', () => {
    const cmd = installContextCostHookCommand();
    assert.match(cmd, /context-cost-refresh\.mjs --hook/);
    assert.equal(isMidasContextCostHookCommand(cmd), true);
    assert.equal(isMidasContextCostHookCommand('echo hi'), false);
  });

  it('mergeContextCostHooks seeds and preserves trace/carryover sessionStart', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-context-cost-hooks-'));
    try {
      mergeTraceHooks(tmp);
      mergeCarryoverHooks(tmp);
      const seed = mergeContextCostHooks(tmp);
      assert.equal(seed.wrote, true);

      const raw = JSON.parse(readFileSync(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
      const session = raw.hooks.sessionStart;
      assert.ok(session.some((h) => h.command === installTraceHookCommand('sessionStart')));
      assert.ok(session.some((h) => h.command === installCarryoverHookCommand()));
      assert.ok(session.some((h) => h.command === installContextCostHookCommand()));
      assert.ok(session.every((h) => h.failClosed !== true));

      const again = mergeContextCostHooks(tmp);
      assert.equal(again.action, 'noop');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('stripContextCostHooks keeps trace and carryover entries', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-context-cost-hooks-'));
    try {
      mergeTraceHooks(tmp);
      mergeCarryoverHooks(tmp);
      mergeContextCostHooks(tmp);
      const stripped = stripContextCostHooks(tmp);
      assert.equal(stripped.wrote, true);
      assert.equal(stripped.removed, false);

      const raw = JSON.parse(readFileSync(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
      assert.ok(!JSON.stringify(raw).includes('context-cost-refresh'));
      assert.ok(
        raw.hooks.sessionStart?.some((h) => h.command === installTraceHookCommand('sessionStart')),
      );
      assert.ok(
        raw.hooks.sessionStart?.some((h) => h.command === installCarryoverHookCommand()),
      );
      assert.equal(existsSync(join(tmp, '.cursor', 'hooks.json')), true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
