import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendQualityEvent,
  FORBIDDEN_DETAIL_KEYS,
  isValidQualityKind,
  isValidQualityStatus,
  QUALITY_LOG_SCHEMA_VERSION,
  resolveQualityLogPath,
  sanitizeDetail,
  validateQualityLogEntry,
  VALID_KINDS,
  VALID_STATUSES,
} from '../quality-log.mjs';
import { runQualityLog } from '../../quality-log.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-quality-log-${suffix}-`));
}

function readLogLines(root) {
  const path = resolveQualityLogPath(root);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('quality-log', () => {
  it('resolveQualityLogPath prefers runs/cache for engine-style roots', () => {
    const root = makeProject('engine');
    try {
      const path = resolveQualityLogPath(root);
      assert.equal(path, join(root, 'runs', 'cache', 'metrics', 'quality-log.jsonl'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolveQualityLogPath prefers .harness/cache when .harness exists', () => {
    const root = makeProject('harness');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      const path = resolveQualityLogPath(root);
      assert.equal(path, join(root, '.harness', 'cache', 'metrics', 'quality-log.jsonl'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('appendQualityEvent writes schema_version 1 entry with pid', () => {
    const root = makeProject('append');
    try {
      const ok = appendQualityEvent(root, { kind: 'gate', status: 'pass' });
      assert.equal(ok, true);

      const lines = readLogLines(root);
      assert.equal(lines.length, 1);
      const entry = lines[0];
      assert.equal(entry.schema_version, QUALITY_LOG_SCHEMA_VERSION);
      assert.equal(entry.kind, 'gate');
      assert.equal(entry.status, 'pass');
      assert.equal(typeof entry.ts, 'string');
      assert.ok(!Number.isNaN(Date.parse(entry.ts)));
      assert.equal(typeof entry.pid, 'number');
      assert.equal(entry.pid, process.pid);
      assert.equal(entry.detail, undefined);
      assert.equal(validateQualityLogEntry(entry), true);

      const raw = readFileSync(resolveQualityLogPath(root), 'utf8');
      assert.ok(raw.endsWith('\n'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('appendQualityEvent includes optional string detail', () => {
    const root = makeProject('detail-string');
    try {
      const ok = appendQualityEvent(root, {
        kind: 'audit',
        status: 'fail',
        detail: 'audit-03 unresolved=2',
      });
      assert.equal(ok, true);

      const entry = readLogLines(root)[0];
      assert.equal(entry.kind, 'audit');
      assert.equal(entry.status, 'fail');
      assert.equal(entry.detail, 'audit-03 unresolved=2');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sanitizeDetail strips forbidden keys from objects', () => {
    const clean = sanitizeDetail({
      summary: 'lint ok',
      password: 'leak',
      token: 'sk-test',
      nested: { secret: 'x', api_key: 'y', count: 3 },
      authorization: 'Bearer abc',
    });
    assert.deepEqual(clean, { summary: 'lint ok', nested: { count: 3 } });
    assert.ok(FORBIDDEN_DETAIL_KEYS.every((key) => !JSON.stringify(clean).includes(key)));
  });

  it('appendQualityEvent sanitizes object detail and never logs forbidden keys', () => {
    const root = makeProject('detail-object');
    try {
      const ok = appendQualityEvent(root, {
        kind: 'verify',
        status: 'warn',
        detail: {
          route: '/login',
          token: 'must-not-appear',
          counts: { pass: 4, fail: 1 },
        },
      });
      assert.equal(ok, true);

      const entry = readLogLines(root)[0];
      assert.equal(entry.kind, 'verify');
      assert.deepEqual(entry.detail, { route: '/login', counts: { pass: 4, fail: 1 } });

      const raw = readFileSync(resolveQualityLogPath(root), 'utf8');
      assert.ok(!raw.includes('must-not-appear'));
      assert.ok(!raw.includes('"token"'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('appendQualityEvent appends multiple lines', () => {
    const root = makeProject('multi');
    try {
      assert.equal(appendQualityEvent(root, { kind: 'doctor', status: 'skip' }), true);
      assert.equal(appendQualityEvent(root, { kind: 'gate', status: 'pass' }), true);

      const lines = readLogLines(root);
      assert.equal(lines.length, 2);
      assert.equal(lines[0].kind, 'doctor');
      assert.equal(lines[1].kind, 'gate');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('invalid kind or status returns false without writing', () => {
    const root = makeProject('invalid');
    try {
      assert.equal(isValidQualityKind('bogus'), false);
      assert.equal(isValidQualityStatus('green'), false);
      assert.equal(appendQualityEvent(root, { kind: 'bogus', status: 'pass' }), false);
      assert.equal(appendQualityEvent(root, { kind: 'gate', status: 'green' }), false);
      assert.equal(existsSync(resolveQualityLogPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('non-string non-object detail returns false without writing', () => {
    const root = makeProject('bad-detail');
    try {
      assert.equal(appendQualityEvent(root, { kind: 'gate', status: 'pass', detail: 42 }), false);
      assert.equal(existsSync(resolveQualityLogPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('VALID_KINDS and VALID_STATUSES match expected enums', () => {
    assert.deepEqual(VALID_KINDS, ['gate', 'audit', 'verify', 'doctor']);
    assert.deepEqual(VALID_STATUSES, ['pass', 'fail', 'warn', 'skip']);
  });

  it('runQualityLog always exits 0 and appends with --verbose', () => {
    const root = makeProject('cli');
    try {
      const code = runQualityLog(
        ['gate', 'pass', '--detail', 'test-gate receipt', '--root', root, '--verbose'],
        { projectRoot: root },
      );
      assert.equal(code, 0);

      const lines = readLogLines(root);
      assert.equal(lines.length, 1);
      assert.equal(lines[0].status, 'pass');
      assert.equal(lines[0].detail, 'test-gate receipt');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runQualityLog exits 0 on missing args without writing', () => {
    const root = makeProject('cli-missing');
    try {
      const code = runQualityLog(['gate'], { projectRoot: root });
      assert.equal(code, 0);
      assert.equal(existsSync(resolveQualityLogPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
