import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeReceipt,
  fingerprintWorkingTree,
  isReceiptFresh,
  operationsMatch,
  peekReceipt,
  readReceipt,
  resolveReceiptPath,
  validateReceipt,
  writeReceipt,
} from '../commit-receipt.mjs';

const FP = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-commit-receipt-${suffix}-`));
}

describe('commit-receipt', () => {
  it('resolveReceiptPath prefers runs/cache for engine-style roots', () => {
    const root = makeProject('engine');
    try {
      const path = resolveReceiptPath(root);
      assert.equal(path, join(root, 'runs', 'cache', 'session', 'commit-approved.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolveReceiptPath prefers .harness/cache when .harness exists', () => {
    const root = makeProject('harness');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      const path = resolveReceiptPath(root);
      assert.equal(path, join(root, '.harness', 'cache', 'session', 'commit-approved.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('write/read roundtrip', () => {
    const root = makeProject('roundtrip');
    try {
      const written = writeReceipt(root, { operation: 'commit', diff_fingerprint: FP });
      assert.equal(written.schema_version, 2);
      assert.equal(written.operation, 'commit');
      assert.equal(written.diff_fingerprint, FP);
      assert.equal(written.ttl_seconds, 3600);
      assert.ok(written.created_at);

      const read = readReceipt(root);
      assert.deepEqual(read, written);

      const raw = readFileSync(resolveReceiptPath(root), 'utf8');
      assert.ok(raw.endsWith('\n'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('consume deletes receipt on success', () => {
    const root = makeProject('consume');
    try {
      writeReceipt(root, { operation: 'commit', diff_fingerprint: FP });
      const path = resolveReceiptPath(root);
      assert.ok(existsSync(path));

      assert.equal(consumeReceipt(root, 'commit'), true);
      assert.equal(existsSync(path), false);
      assert.equal(consumeReceipt(root, 'commit'), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('peek keeps receipt file', () => {
    const root = makeProject('peek');
    try {
      writeReceipt(root, { operation: 'push', diff_fingerprint: FP });
      const path = resolveReceiptPath(root);

      const peeked = peekReceipt(root, 'push');
      assert.ok(peeked);
      assert.equal(peeked.operation, 'push');
      assert.ok(existsSync(path));
      assert.ok(readReceipt(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('stale TTL fails peek and consume', () => {
    const root = makeProject('stale');
    try {
      writeReceipt(root, {
        operation: 'commit',
        diff_fingerprint: FP,
        ttl_seconds: 60,
      });
      const path = resolveReceiptPath(root);
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      raw.created_at = new Date(Date.now() - 120_000).toISOString();
      writeFileSync(path, `${JSON.stringify(raw)}\n`, 'utf8');

      const receipt = readReceipt(root);
      assert.ok(receipt);
      assert.equal(isReceiptFresh(receipt), false);
      assert.equal(peekReceipt(root, 'commit'), null);
      assert.equal(consumeReceipt(root, 'commit'), false);
      assert.ok(existsSync(path));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('wrong operation fails peek and consume', () => {
    const root = makeProject('wrong-op');
    try {
      writeReceipt(root, { operation: 'commit', diff_fingerprint: FP });
      assert.equal(peekReceipt(root, 'push'), null);
      assert.equal(consumeReceipt(root, 'push'), false);
      assert.ok(readReceipt(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('schema_version 1 is rejected on read', () => {
    const root = makeProject('v1');
    try {
      const path = resolveReceiptPath(root);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(
        path,
        `${JSON.stringify({
          schema_version: 1,
          operation: 'commit',
          diff_fingerprint: FP,
          created_at: new Date().toISOString(),
          ttl_seconds: 3600,
        })}\n`,
        'utf8',
      );
      assert.equal(readReceipt(root), null);
      assert.equal(peekReceipt(root, 'commit'), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('empty receipt file is rejected', () => {
    const root = makeProject('empty');
    try {
      const path = resolveReceiptPath(root);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, '', 'utf8');
      assert.equal(readReceipt(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('operationsMatch matrix', () => {
    assert.equal(operationsMatch('commit', 'commit'), true);
    assert.equal(operationsMatch('push', 'push'), true);
    assert.equal(operationsMatch('commit', 'git-write'), true);
    assert.equal(operationsMatch('push', 'git-write'), true);
    assert.equal(operationsMatch('force-with-lease', 'push'), true);
    assert.equal(operationsMatch('force-with-lease', 'force-with-lease'), true);
    assert.equal(operationsMatch('force-with-lease', 'git-write'), true);
    assert.equal(operationsMatch('commit', 'push'), false);
    assert.equal(operationsMatch('push', 'commit'), false);
    assert.equal(operationsMatch('force-with-lease', 'commit'), false);
  });

  it('validateReceipt rejects invalid payloads', () => {
    assert.equal(validateReceipt(null), false);
    assert.equal(
      validateReceipt({
        schema_version: 2,
        operation: 'commit',
        diff_fingerprint: 'nope',
        created_at: new Date().toISOString(),
        ttl_seconds: 3600,
      }),
      false,
    );
    assert.equal(
      validateReceipt({
        schema_version: 2,
        operation: 'commit',
        diff_fingerprint: FP,
        created_at: 'not-a-date',
        ttl_seconds: 3600,
      }),
      false,
    );
  });

  it('fingerprintWorkingTree returns sha256 prefix', () => {
    const root = makeProject('fp');
    try {
      const fp = fingerprintWorkingTree(root);
      assert.match(fp, /^sha256:([a-f0-9]{64}|unavailable)$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
