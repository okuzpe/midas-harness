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
  buildCarryoverSnapshot,
  isActiveSession,
  readCarryoverSnapshot,
  resolveCarryoverPath,
  writeCarryoverSnapshot,
} from '../carryover.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-carryover-${suffix}-`));
}

function writeHarnessLayout(root, stateYaml) {
  mkdirSync(join(root, '.harness', 'product', 'sprints'), { recursive: true });
  mkdirSync(join(root, '.harness', 'runs', 'sprints'), { recursive: true });
  writeFileSync(join(root, '.harness', 'state.yaml'), stateYaml, 'utf8');
}

describe('carryover', () => {
  it('resolveCarryoverPath prefers runs/cache for engine-style roots', () => {
    const root = makeProject('engine');
    try {
      const path = resolveCarryoverPath(root);
      assert.equal(path, join(root, 'runs', 'cache', 'metrics', 'current-carryover.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolveCarryoverPath prefers .harness/cache when .harness exists', () => {
    const root = makeProject('harness');
    try {
      mkdirSync(join(root, '.harness'), { recursive: true });
      const path = resolveCarryoverPath(root);
      assert.equal(path, join(root, '.harness', 'cache', 'metrics', 'current-carryover.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buildCarryoverSnapshot returns idle when no active session', () => {
    const root = makeProject('idle');
    try {
      const snap = buildCarryoverSnapshot(root);
      assert.equal(snap.schema_version, 1);
      assert.equal(snap.ok, true);
      assert.equal(snap.mode, 'idle');
      assert.deepEqual(snap.files, []);
      assert.equal(snap.sprint_id, null);
      assert.equal(snap.explore_slug, null);
      assert.equal(snap.approx_tokens, 0);
      assert.equal(isActiveSession(root), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buildCarryoverSnapshot collects explore files from .active slug', () => {
    const root = makeProject('explore');
    try {
      const slug = 'spike-auth';
      mkdirSync(join(root, '.harness'), { recursive: true });
      writeFileSync(join(root, '.harness', 'state.yaml'), 'layout: harness\nstage: idea_intake\n', 'utf8');
      const exploreDir = join(root, '.harness', 'runs', 'explore', slug);
      mkdirSync(exploreDir, { recursive: true });
      mkdirSync(join(root, '.harness', 'runs', 'explore'), { recursive: true });
      writeFileSync(join(root, '.harness', 'runs', 'explore', '.active'), `${slug}\n`, 'utf8');
      writeFileSync(join(exploreDir, 'meta.yaml'), 'topic: auth\n', 'utf8');
      writeFileSync(join(exploreDir, 'notes.md'), '# Notes\n', 'utf8');

      const snap = buildCarryoverSnapshot(root);
      assert.equal(snap.mode, 'explore');
      assert.equal(snap.explore_slug, slug);
      assert.equal(snap.files.length, 2);
      assert.ok(snap.files.includes('.harness/runs/explore/spike-auth/meta.yaml'));
      assert.ok(snap.files.includes('.harness/runs/explore/spike-auth/notes.md'));
      assert.ok(snap.approx_tokens > 0);
      assert.equal(isActiveSession(root), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buildCarryoverSnapshot collects sprint allow-list files', () => {
    const root = makeProject('sprint');
    try {
      writeHarnessLayout(
        root,
        [
          'layout: harness',
          'stage: sprint_execution',
          'sprints:',
          '  - id: "01"',
          '    status: active',
        ].join('\n'),
      );
      writeFileSync(join(root, '.harness', 'product', 'idea.md'), '# Idea\n', 'utf8');
      writeFileSync(join(root, '.harness', 'product', 'architecture.md'), '# Arch\n', 'utf8');
      writeFileSync(join(root, '.harness', 'product', 'sprints', '01-fixture.md'), '# Sprint\n', 'utf8');
      writeFileSync(join(root, '.harness', 'runs', 'sprints', '01-progress.md'), '# Progress\n', 'utf8');

      const snap = buildCarryoverSnapshot(root);
      assert.equal(snap.mode, 'sprint');
      assert.equal(snap.sprint_id, '01');
      assert.equal(snap.stage, 'sprint_execution');
      assert.ok(snap.files.includes('.harness/state.yaml'));
      assert.ok(snap.files.includes('.harness/product/sprints/01-fixture.md'));
      assert.ok(snap.files.includes('.harness/runs/sprints/01-progress.md'));
      assert.ok(snap.files.includes('.harness/product/idea.md'));
      assert.ok(snap.files.includes('.harness/product/architecture.md'));
      assert.ok(snap.approx_tokens > 0);
      assert.equal(isActiveSession(root), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('write/read roundtrip', () => {
    const root = makeProject('roundtrip');
    try {
      const written = writeCarryoverSnapshot(root);
      assert.equal(written.schema_version, 1);
      assert.equal(written.mode, 'idle');

      const read = readCarryoverSnapshot(root);
      assert.deepEqual(read, written);

      const path = resolveCarryoverPath(root);
      assert.ok(existsSync(path));
      const raw = readFileSync(path, 'utf8');
      assert.ok(raw.endsWith('\n'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
