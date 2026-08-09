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
  RECALL_CORPUS_MAX_BYTES,
  collectRecallCorpus,
  excerptText,
  rankSnippets,
  scoreSnippet,
  tokenizeQuery,
} from '../recall-score.mjs';
import { parseRecallRankArgs, runRecallRank } from '../../recall-rank.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-recall-score-${suffix}-`));
}

describe('recall-score', () => {
  it('tokenizeQuery lowercases and splits on punctuation', () => {
    assert.deepEqual(tokenizeQuery('Auth-Flow v2'), ['auth', 'flow', 'v2']);
    assert.deepEqual(tokenizeQuery(''), []);
  });

  it('scoreSnippet counts query token hits in text', () => {
    assert.equal(scoreSnippet('auth login', 'User auth and login flow'), 2);
    assert.equal(scoreSnippet('missing terms', 'unrelated content'), 0);
    assert.equal(scoreSnippet('', 'some text'), 0);
  });

  it('rankSnippets sorts by score desc, drops zero, respects limit', () => {
    const items = [
      { path: 'b.md', text: 'auth only' },
      { path: 'a.md', text: 'auth login session' },
      { path: 'c.md', text: 'no overlap here' },
    ];
    const ranked = rankSnippets('auth login', items, { limit: 2 });
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].path, 'a.md');
    assert.equal(ranked[0].score, 2);
    assert.equal(ranked[1].path, 'b.md');
    assert.equal(ranked[1].score, 1);
  });

  it('collectRecallCorpus reads relative paths and caps file size', () => {
    const root = makeProject('corpus');
    try {
      mkdirSync(join(root, 'docs'), { recursive: true });
      const big = 'x'.repeat(RECALL_CORPUS_MAX_BYTES + 500);
      writeFileSync(join(root, 'docs', 'big.md'), big, 'utf8');
      writeFileSync(join(root, 'docs', 'small.md'), 'auth login notes', 'utf8');

      const items = collectRecallCorpus(root, ['docs/small.md', 'docs/missing.md', 'docs/big.md']);
      assert.equal(items.length, 2);
      const small = items.find((item) => item.path.endsWith('small.md'));
      const capped = items.find((item) => item.path.endsWith('big.md'));
      assert.ok(small);
      assert.equal(small.text, 'auth login notes');
      assert.ok(capped);
      assert.equal(capped.text.length, RECALL_CORPUS_MAX_BYTES);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('collectRecallCorpus skips unreadable paths without throwing', () => {
    const root = makeProject('skip');
    try {
      mkdirSync(join(root, 'nested'), { recursive: true });
      writeFileSync(join(root, 'nested', 'ok.md'), 'playbook auth', 'utf8');
      const items = collectRecallCorpus(root, ['nested/ok.md', '/definitely/not/a/real/path.md']);
      assert.equal(items.length, 1);
      assert.match(items[0].path, /ok\.md$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('excerptText collapses whitespace and truncates', () => {
    const long = `line one\n\nline ${'two '.repeat(80)}`;
    const excerpt = excerptText(long, 40);
    assert.ok(excerpt.length <= 41);
    assert.ok(excerpt.endsWith('…'));
    assert.doesNotMatch(excerpt, /\n/);
  });
});

describe('recall-rank CLI', () => {
  it('parseRecallRankArgs reads flags and positional paths', () => {
    const parsed = parseRecallRankArgs([
      'node',
      'recall-rank.mjs',
      '--root',
      '/proj',
      '--query',
      'auth flow',
      '--limit',
      '3',
      '--paths',
      'a.md,b.md',
      'c.md',
    ]);
    assert.ok(parsed.root.replace(/\\/g, '/').endsWith('/proj'));
    assert.equal(parsed.query, 'auth flow');
    assert.equal(parsed.limit, 3);
    assert.deepEqual(parsed.paths, ['a.md', 'b.md', 'c.md']);
  });

  it('runRecallRank returns JSON-shaped ranked excerpts', () => {
    const root = makeProject('cli');
    try {
      mkdirSync(join(root, 'playbooks'), { recursive: true });
      writeFileSync(join(root, 'playbooks', 'auth.md'), 'auth login playbook details', 'utf8');
      const out = runRecallRank({
        root,
        query: 'auth login',
        limit: 5,
        paths: ['playbooks/auth.md'],
      });
      assert.equal(out.length, 1);
      assert.equal(out[0].score, 2);
      assert.match(out[0].path, /auth\.md$/);
      assert.match(out[0].excerpt, /auth login/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runRecallRank returns empty array when nothing matches', () => {
    const root = makeProject('empty');
    try {
      writeFileSync(join(root, 'note.md'), 'unrelated', 'utf8');
      const out = runRecallRank({
        root,
        query: 'quantum',
        limit: 5,
        paths: ['note.md'],
      });
      assert.deepEqual(out, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
