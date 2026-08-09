import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyPush,
  detectGitWrite,
  evaluateCommand,
  handleHookStdin,
} from '../gate-commits.mjs';
import { consumeReceipt, peekReceipt, resolveReceiptPath, writeReceipt } from '../../lib/commit-receipt.mjs';

const FP = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const HOOK = fileURLToPath(new URL('../gate-commits.mjs', import.meta.url));

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-gate-commits-${suffix}-`));
}

describe('gate-commits', () => {
  it('detectGitWrite maps git write subcommands', () => {
    assert.deepEqual(detectGitWrite('git commit -m "x"'), { neededOp: 'commit' });
    assert.deepEqual(detectGitWrite('git push origin main'), { neededOp: 'push' });
    assert.deepEqual(detectGitWrite('git rebase main'), { neededOp: 'git-write' });
    assert.deepEqual(detectGitWrite('git cherry-pick abc'), { neededOp: 'git-write' });
    assert.deepEqual(detectGitWrite('git merge feature'), { neededOp: 'git-write' });
    assert.deepEqual(detectGitWrite('git am patch.mbox'), { neededOp: 'git-write' });
    assert.equal(detectGitWrite('git status'), null);
    assert.equal(detectGitWrite('echo git commit'), null);
  });

  it('classifyPush detects force variants', () => {
    assert.equal(classifyPush('origin main'), 'push');
    assert.equal(classifyPush('origin main --force-with-lease'), 'force-with-lease');
    assert.equal(classifyPush('origin main -f'), 'force-with-lease');
    assert.equal(classifyPush('origin +main'), 'force-with-lease');
  });

  it('allows non-git and dry-run commands', () => {
    assert.equal(evaluateCommand('npm test').permission, 'allow');
    assert.equal(evaluateCommand('git commit --dry-run -m x').permission, 'allow');
    assert.equal(evaluateCommand('git push --dry-run').permission, 'allow');
  });

  it('denies empty command', () => {
    const result = evaluateCommand('   ');
    assert.equal(result.permission, 'deny');
    assert.match(result.user_message || '', /empty/i);
  });

  it('denies git commit without receipt', () => {
    const root = makeProject('no-receipt');
    try {
      const result = evaluateCommand('git commit -m "x"', { projectRoot: root });
      assert.equal(result.permission, 'deny');
      assert.match(result.user_message || '', /receipt/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows git commit after consumeReceipt', () => {
    const root = makeProject('commit-ok');
    try {
      writeReceipt(root, { operation: 'commit', diff_fingerprint: FP });
      const result = evaluateCommand('git commit -m "x"', { projectRoot: root });
      assert.equal(result.permission, 'allow');
      assert.equal(existsSync(resolveReceiptPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('peek-only for force-with-lease leaves receipt intact', () => {
    const root = makeProject('peek-fwl');
    try {
      writeReceipt(root, { operation: 'force-with-lease', diff_fingerprint: FP });
      const path = resolveReceiptPath(root);

      const result = evaluateCommand('git push --force-with-lease origin main', { projectRoot: root });
      assert.equal(result.permission, 'allow');
      assert.ok(existsSync(path));
      assert.ok(peekReceipt(root, 'force-with-lease'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('git-write receipt covers rebase', () => {
    const root = makeProject('rebase');
    try {
      writeReceipt(root, { operation: 'git-write', diff_fingerprint: FP });
      const result = evaluateCommand('git rebase main', { projectRoot: root });
      assert.equal(result.permission, 'allow');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('denies when receipt lib missing flag is set', () => {
    const result = evaluateCommand('git commit -m x', { receiptLibMissing: true });
    assert.equal(result.permission, 'deny');
    assert.match(result.user_message || '', /receipt library/i);
  });

  it('handleHookStdin reads command from JSON payload', () => {
    const root = makeProject('stdin');
    try {
      writeReceipt(root, { operation: 'push', diff_fingerprint: FP });
      const result = handleHookStdin(JSON.stringify({ command: 'git push origin main' }), {
        projectRoot: root,
      });
      assert.equal(result.permission, 'allow');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('main entry exits 0 and emits deny JSON without receipt', () => {
    const run = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ command: 'git commit -m x' }),
      encoding: 'utf8',
    });
    assert.equal(run.status, 0);
    const out = JSON.parse(run.stdout.trim());
    assert.equal(out.permission, 'deny');
  });
});
