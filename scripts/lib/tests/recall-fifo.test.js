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
  FIFO_INJECTED_CAP,
  FIFO_SCHEMA_VERSION,
  emptyFifoState,
  filterUnseen,
  markInjected,
  readFifo,
  resolveFifoPath,
  validateFifoState,
  writeFifo,
} from '../recall-fifo.mjs';
import { parseRecallRankArgs, runRecallRank } from '../../recall-rank.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-recall-fifo-${suffix}-`));
}

describe('recall-fifo', () => {
  it('resolveFifoPath prefers runs/cache for engine-style roots', () => {
    const root = makeProject('engine');
    try {
      const path = resolveFifoPath(root);
      assert.equal(path, join(root, 'runs', 'cache', 'session', 'recall-fifo.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolveFifoPath prefers .harness/cache when .harness exists', () => {
    const root = makeProject('harness');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      const path = resolveFifoPath(root);
      assert.equal(path, join(root, '.harness', 'cache', 'session', 'recall-fifo.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('write/read roundtrip', () => {
    const root = makeProject('roundtrip');
    try {
      const written = writeFifo(root, {
        schema_version: FIFO_SCHEMA_VERSION,
        injected: ['docs/a.md', 'playbooks/b.md'],
      });
      assert.deepEqual(written, {
        schema_version: FIFO_SCHEMA_VERSION,
        injected: ['docs/a.md', 'playbooks/b.md'],
      });

      const read = readFifo(root);
      assert.deepEqual(read, written);

      const raw = readFileSync(resolveFifoPath(root), 'utf8');
      assert.ok(raw.endsWith('\n'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('readFifo fail-open on invalid JSON', () => {
    const root = makeProject('invalid');
    try {
      const path = resolveFifoPath(root);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, '{not json', 'utf8');
      assert.deepEqual(readFifo(root), emptyFifoState());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('readFifo fail-open on wrong schema_version', () => {
    const root = makeProject('schema');
    try {
      const path = resolveFifoPath(root);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(
        path,
        `${JSON.stringify({ schema_version: 2, injected: ['a.md'] })}\n`,
        'utf8',
      );
      assert.deepEqual(readFifo(root), emptyFifoState());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('markInjected appends unique paths', () => {
    const root = makeProject('mark');
    try {
      markInjected(root, ['a.md', 'b.md']);
      const state = markInjected(root, ['b.md', 'c.md']);
      assert.deepEqual(state.injected, ['a.md', 'b.md', 'c.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('filterUnseen returns unseen paths in order and marks them', () => {
    const root = makeProject('filter');
    try {
      markInjected(root, ['seen.md']);
      const first = filterUnseen(root, ['seen.md', 'new-a.md', 'new-b.md'], { max: 5 });
      assert.deepEqual(first, ['new-a.md', 'new-b.md']);
      assert.deepEqual(readFifo(root).injected, ['seen.md', 'new-a.md', 'new-b.md']);

      const second = filterUnseen(root, ['seen.md', 'new-a.md', 'new-c.md'], { max: 5 });
      assert.deepEqual(second, ['new-c.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('filterUnseen respects max', () => {
    const root = makeProject('max');
    try {
      const unseen = filterUnseen(root, ['a.md', 'b.md', 'c.md'], { max: 2 });
      assert.deepEqual(unseen, ['a.md', 'b.md']);
      assert.deepEqual(readFifo(root).injected, ['a.md', 'b.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('caps injected list at FIFO_INJECTED_CAP dropping oldest', () => {
    const root = makeProject('cap');
    try {
      const seeded = Array.from({ length: FIFO_INJECTED_CAP }, (_, i) => `old-${i}.md`);
      writeFifo(root, { schema_version: FIFO_SCHEMA_VERSION, injected: seeded });
      markInjected(root, ['fresh.md']);
      const state = readFifo(root);
      assert.equal(state.injected.length, FIFO_INJECTED_CAP);
      assert.equal(state.injected[0], 'old-1.md');
      assert.equal(state.injected.at(-1), 'fresh.md');
      assert.equal(state.injected.includes('old-0.md'), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('validateFifoState rejects invalid payloads', () => {
    assert.equal(validateFifoState(null), false);
    assert.equal(
      validateFifoState({ schema_version: 1, injected: [1, 2] }),
      false,
    );
    assert.equal(
      validateFifoState({ schema_version: 2, injected: [] }),
      false,
    );
  });
});

describe('recall-rank --fifo', () => {
  it('parseRecallRankArgs reads --fifo flag', () => {
    const parsed = parseRecallRankArgs([
      'node',
      'recall-rank.mjs',
      '--root',
      '/proj',
      '--fifo',
      '--query',
      'auth',
    ]);
    assert.equal(parsed.fifo, true);
  });

  it('runRecallRank with fifo skips already-injected paths', () => {
    const root = makeProject('fifo-cli');
    try {
      mkdirSync(join(root, 'docs'), { recursive: true });
      writeFileSync(join(root, 'docs', 'auth.md'), 'auth login flow', 'utf8');
      writeFileSync(join(root, 'docs', 'session.md'), 'auth session notes', 'utf8');

      const fifoPath = resolveFifoPath(root);
      mkdirSync(join(fifoPath, '..'), { recursive: true });
      writeFileSync(
        fifoPath,
        `${JSON.stringify({
          schema_version: 1,
          injected: ['docs/auth.md'],
        })}\n`,
        'utf8',
      );

      const out = runRecallRank({
        root,
        query: 'auth',
        limit: 5,
        paths: ['docs/auth.md', 'docs/session.md'],
        fifo: true,
      });
      assert.equal(out.length, 1);
      assert.match(out[0].path, /session\.md$/);

      const fifo = readFifo(root);
      assert.ok(fifo.injected.some((p) => p.endsWith('session.md')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runRecallRank without fifo returns all ranked matches', () => {
    const root = makeProject('no-fifo');
    try {
      mkdirSync(join(root, 'docs'), { recursive: true });
      writeFileSync(join(root, 'docs', 'auth.md'), 'auth login flow', 'utf8');
      writeFileSync(join(root, 'docs', 'session.md'), 'auth session notes', 'utf8');

      const fifoPath = resolveFifoPath(root);
      mkdirSync(join(fifoPath, '..'), { recursive: true });
      writeFileSync(
        fifoPath,
        `${JSON.stringify({
          schema_version: 1,
          injected: ['docs/auth.md'],
        })}\n`,
        'utf8',
      );

      const out = runRecallRank({
        root,
        query: 'auth',
        limit: 5,
        paths: ['docs/auth.md', 'docs/session.md'],
        fifo: false,
      });
      assert.equal(out.length, 2);
      assert.deepEqual(readFifo(root).injected, ['docs/auth.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
