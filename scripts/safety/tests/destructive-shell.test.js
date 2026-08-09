import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyForcePush,
  evaluateCommand,
  handleHookStdin,
  isDryRun,
  matchesFindDelete,
  matchesGitCleanFdx,
  matchesGitResetHard,
  matchesRmRf,
  matchesTruncateOrDd,
} from '../destructive-shell.mjs';
import { consumeReceipt, writeReceipt } from '../../lib/commit-receipt.mjs';

const FP = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const HOOK = fileURLToPath(new URL('../destructive-shell.mjs', import.meta.url));

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-destructive-shell-${suffix}-`));
}

describe('destructive-shell', () => {
  it('pattern matchers detect destructive commands', () => {
    assert.equal(matchesRmRf('rm -rf /tmp/foo'), true);
    assert.equal(matchesRmRf('rm -fr build'), true);
    assert.equal(matchesGitCleanFdx('git clean -fdx'), true);
    assert.equal(matchesGitCleanFdx('git clean -ffdx'), true);
    assert.equal(matchesGitResetHard('git reset --hard HEAD'), true);
    assert.equal(matchesFindDelete('find . -name "*.log" -delete'), true);
    assert.equal(matchesTruncateOrDd('dd if=/dev/zero of=/dev/sda'), true);
    assert.equal(matchesTruncateOrDd('truncate -s 0 important.db'), true);
    assert.equal(classifyForcePush('git push --force origin main'), 'force-other');
    assert.equal(classifyForcePush('git push -f origin main'), 'force-other');
    assert.equal(classifyForcePush('git push origin +main'), 'force-other');
    assert.equal(classifyForcePush('git push --force-with-lease origin main'), 'force-with-lease');
  });

  it('allows safe commands', () => {
    assert.equal(evaluateCommand('npm test').permission, 'allow');
    assert.equal(evaluateCommand('git status').permission, 'allow');
    assert.equal(evaluateCommand('git push origin main').permission, 'allow');
  });

  it('dry-run bypasses destructive matchers', () => {
    assert.ok(isDryRun('rm -rf --dry-run /'));
    assert.equal(evaluateCommand('rm -rf --dry-run /tmp').permission, 'allow');
    assert.equal(evaluateCommand('git clean -fdx --dry-run').permission, 'allow');
  });

  it('denies rm -rf and git clean -fdx', () => {
    assert.equal(evaluateCommand('rm -rf node_modules').permission, 'deny');
    assert.equal(evaluateCommand('git clean -fdx').permission, 'deny');
  });

  it('denies git reset --hard and find -delete', () => {
    assert.equal(evaluateCommand('git reset --hard').permission, 'deny');
    assert.equal(evaluateCommand('find . -type f -delete').permission, 'deny');
  });

  it('denies truncate and dd via evaluateCommand', () => {
    assert.equal(evaluateCommand('truncate -s 0 important.db').permission, 'deny');
    assert.equal(evaluateCommand('dd if=/dev/zero of=/dev/sda').permission, 'deny');
  });

  it('denies raw force push without receipt', () => {
    const root = makeProject('force');
    try {
      assert.equal(evaluateCommand('git push -f origin main', { projectRoot: root }).permission, 'deny');
      assert.equal(evaluateCommand('git push --force origin main', { projectRoot: root }).permission, 'deny');
      assert.equal(evaluateCommand('git push origin +main', { projectRoot: root }).permission, 'deny');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows force-with-lease when receipt consumes', () => {
    const root = makeProject('fwl');
    try {
      writeReceipt(root, { operation: 'force-with-lease', diff_fingerprint: FP });
      const result = evaluateCommand('git push --force-with-lease origin main', { projectRoot: root });
      assert.equal(result.permission, 'allow');
      assert.equal(consumeReceipt(root, 'force-with-lease'), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('denies force-with-lease without receipt', () => {
    const root = makeProject('fwl-deny');
    try {
      const result = evaluateCommand('git push --force-with-lease origin main', { projectRoot: root });
      assert.equal(result.permission, 'deny');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('handleHookStdin parses payload command', () => {
    const result = handleHookStdin(JSON.stringify({ command: 'rm -rf /' }));
    assert.equal(result.permission, 'deny');
  });

  it('main entry exits 0 and emits deny JSON for destructive command', () => {
    const run = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ command: 'rm -rf /tmp' }),
      encoding: 'utf8',
    });
    assert.equal(run.status, 0);
    const out = JSON.parse(run.stdout.trim());
    assert.equal(out.permission, 'deny');
  });
});
