import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  installSafetyHookCommand,
  isMidasSafetyHookCommand,
  mergeSafetyHooks,
  stripSafetyHooks,
} from '../safety-hooks.mjs';
import { installTraceHookCommand, mergeTraceHooks } from '../trace-hooks.mjs';

describe('safety-hooks', () => {
  it('installSafetyHookCommand and isMidasSafetyHookCommand', () => {
    const cmd = installSafetyHookCommand('gate-commits.mjs');
    assert.equal(cmd, 'node .harness/scripts/safety/gate-commits.mjs');
    assert.equal(isMidasSafetyHookCommand(cmd), true);
    assert.equal(isMidasSafetyHookCommand('node scripts/safety/foo.mjs'), true);
    assert.equal(isMidasSafetyHookCommand('echo hello'), false);
  });

  it('mergeSafetyHooks seeds expected entries', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-safety-merge-'));
    try {
      const seed = mergeSafetyHooks(tmp);
      assert.equal(seed.action, 'seed');
      assert.equal(seed.wrote, true);

      const raw = JSON.parse(readFileSync(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
      assert.equal(
        raw.hooks.beforeSubmitPrompt[0].command,
        installSafetyHookCommand('secrets-prompt.mjs'),
      );
      assert.equal(raw.hooks.beforeSubmitPrompt[0].failClosed, true);
      assert.equal(raw.hooks.beforeSubmitPrompt[0].timeout, 10);

      const shell = raw.hooks.beforeShellExecution;
      assert.equal(shell.length, 2);
      assert.deepEqual(
        shell.map((h) => h.command),
        [
          installSafetyHookCommand('gate-commits.mjs'),
          installSafetyHookCommand('destructive-shell.mjs'),
        ],
      );
      assert.ok(shell.every((h) => h.failClosed === true && h.timeout === 10));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('mergeSafetyHooks is idempotent and preserves trace hooks', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-safety-merge-'));
    try {
      mergeTraceHooks(tmp);
      mergeSafetyHooks(tmp);

      const again = mergeSafetyHooks(tmp);
      assert.equal(again.action, 'noop');
      assert.equal(again.wrote, false);

      const raw = JSON.parse(readFileSync(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
      assert.ok(
        raw.hooks.postToolUse?.some((h) => h.command === installTraceHookCommand('postToolUse')),
      );
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('stripSafetyHooks removes safety entries and keeps trace hooks', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-safety-merge-'));
    try {
      mergeTraceHooks(tmp);
      mergeSafetyHooks(tmp);

      const stripped = stripSafetyHooks(tmp);
      assert.equal(stripped.wrote, true);
      assert.equal(stripped.removed, false);

      const raw = JSON.parse(readFileSync(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
      assert.ok(!JSON.stringify(raw).includes('scripts/safety/'));
      assert.ok(
        raw.hooks.postToolUse?.some((h) => h.command === installTraceHookCommand('postToolUse')),
      );
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('stripSafetyHooks deletes hooks.json when only safety entries remain', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-safety-merge-'));
    try {
      mergeSafetyHooks(tmp);
      const gone = stripSafetyHooks(tmp);
      assert.equal(gone.removed, true);
      assert.equal(existsSync(join(tmp, '.cursor', 'hooks.json')), false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('mergeSafetyHooks upserts by script basename', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'midas-safety-merge-'));
    try {
      mergeSafetyHooks(tmp);
      const hooksPath = join(tmp, '.cursor', 'hooks.json');
      const raw = JSON.parse(readFileSync(hooksPath, 'utf8'));
      raw.hooks.beforeShellExecution[0] = {
        command: 'node scripts/safety/gate-commits.mjs',
        failClosed: false,
        timeout: 5,
      };
      writeFileSync(hooksPath, `${JSON.stringify(raw, null, 2)}\n`);

      const merged = mergeSafetyHooks(tmp);
      assert.equal(merged.wrote, true);

      const updated = JSON.parse(readFileSync(hooksPath, 'utf8'));
      const gate = updated.hooks.beforeShellExecution.find((h) =>
        h.command.includes('gate-commits.mjs'),
      );
      assert.equal(gate.command, installSafetyHookCommand('gate-commits.mjs'));
      assert.equal(gate.failClosed, true);
      assert.equal(gate.timeout, 10);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
