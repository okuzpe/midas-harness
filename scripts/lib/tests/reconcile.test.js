import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUnderRoots,
  planReconcile,
  reconcilePreservedEdits,
  reconcileRemovals,
  scanVendorTree,
} from '../reconcile.mjs';
import { sha256Buffer } from '../../ownership-manifest.mjs';

const ENGINE = '.harness/engine';

function file(path, body) {
  return { path, sha256: sha256Buffer(body) };
}

function manifest(files) {
  return { files: files.map((f) => ({ ...f, role: 'vendor' })) };
}

describe('planReconcile', () => {
  it('creates files the bundle adds', () => {
    const plan = planReconcile({
      oldManifest: manifest([]),
      newVendorFiles: [file(`${ENGINE}/new.md`, 'a')],
      diskScan: [],
    });
    assert.deepEqual(plan.create.map((e) => e.path), [`${ENGINE}/new.md`]);
    assert.equal(plan.refresh.length, 0);
    assert.equal(plan.delete.length, 0);
  });

  it('refreshes a file untouched since the last install', () => {
    const plan = planReconcile({
      oldManifest: manifest([file(`${ENGINE}/a.md`, 'old')]),
      newVendorFiles: [file(`${ENGINE}/a.md`, 'new')],
      diskScan: [file(`${ENGINE}/a.md`, 'old')],
    });
    assert.deepEqual(plan.refresh.map((e) => e.path), [`${ENGINE}/a.md`]);
    assert.equal(plan.modified.length, 0);
  });

  it('flags a locally edited file as modified rather than a clean refresh', () => {
    const plan = planReconcile({
      oldManifest: manifest([file(`${ENGINE}/a.md`, 'old')]),
      newVendorFiles: [file(`${ENGINE}/a.md`, 'new')],
      diskScan: [file(`${ENGINE}/a.md`, 'local edit')],
    });
    assert.deepEqual(plan.modified.map((e) => e.path), [`${ENGINE}/a.md`]);
    assert.equal(plan.refresh.length, 0);
  });

  it('keeps a file already matching the bundle', () => {
    const plan = planReconcile({
      oldManifest: manifest([file(`${ENGINE}/a.md`, 'same')]),
      newVendorFiles: [file(`${ENGINE}/a.md`, 'same')],
      diskScan: [file(`${ENGINE}/a.md`, 'same')],
    });
    assert.deepEqual(plan.keep.map((e) => e.path), [`${ENGINE}/a.md`]);
    assert.equal(plan.refresh.length, 0);
    assert.equal(plan.modified.length, 0);
  });

  it('deletes a file the bundle dropped, flagging local edits', () => {
    const plan = planReconcile({
      oldManifest: manifest([file(`${ENGINE}/gone.md`, 'old')]),
      newVendorFiles: [],
      diskScan: [file(`${ENGINE}/gone.md`, 'edited')],
    });
    assert.deepEqual(plan.delete.map((e) => e.path), [`${ENGINE}/gone.md`]);
    assert.equal(plan.delete[0].modified, true);
    assert.deepEqual(reconcileRemovals(plan), [`${ENGINE}/gone.md`]);
    assert.deepEqual(reconcilePreservedEdits(plan).map((e) => e.path), [`${ENGINE}/gone.md`]);
  });

  it('reports untracked files inside a vendor root and does not delete them', () => {
    const plan = planReconcile({
      oldManifest: manifest([]),
      newVendorFiles: [],
      diskScan: [file(`${ENGINE}/stray.md`, 'x')],
    });
    assert.deepEqual(plan.untracked.map((e) => e.path), [`${ENGINE}/stray.md`]);
    assert.deepEqual(reconcileRemovals(plan), []);
    assert.deepEqual(reconcilePreservedEdits(plan), []);
  });

  it('never touches paths outside the vendor roots', () => {
    const plan = planReconcile({
      oldManifest: manifest([file('.harness/product/idea.md', 'old')]),
      newVendorFiles: [file('.cursor/rules/00-midas.mdc', 'new')],
      diskScan: [
        file('.harness/product/idea.md', 'edited'),
        file('.harness/rules/local.md', 'mine'),
        file('AGENTS.md', 'mine'),
      ],
    });
    assert.deepEqual(reconcileRemovals(plan), []);
    assert.equal(plan.create.length, 0);
    assert.equal(plan.modified.length, 0);
  });

  it('never deletes user-owned files that live inside a vendor root', () => {
    const plan = planReconcile({
      oldManifest: manifest([]),
      newVendorFiles: [],
      diskScan: [file('.harness/autonomy/policy.yaml', 'mine')],
      roots: ['.harness/engine', '.harness/scripts', '.harness/autonomy'],
    });
    assert.deepEqual(reconcileRemovals(plan), []);
  });

  it('treats a missing baseline as modified, not as a clean refresh', () => {
    const plan = planReconcile({
      oldManifest: null,
      newVendorFiles: [file(`${ENGINE}/a.md`, 'new')],
      diskScan: [file(`${ENGINE}/a.md`, 'whatever')],
    });
    assert.deepEqual(plan.modified.map((e) => e.path), [`${ENGINE}/a.md`]);
  });
});

describe('isUnderRoots', () => {
  it('matches the root itself and its descendants only', () => {
    assert.equal(isUnderRoots('.harness/engine/rules/a.md'), true);
    assert.equal(isUnderRoots('.harness/engine'), true);
    assert.equal(isUnderRoots('.harness/engineering/a.md'), false);
    assert.equal(isUnderRoots('.harness/product/idea.md'), false);
  });
});

describe('scanVendorTree', () => {
  it('hashes only vendor files under the roots', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-reconcile-scan-'));
    try {
      mkdirSync(join(root, '.harness', 'engine', 'rules'), { recursive: true });
      mkdirSync(join(root, '.harness', 'product'), { recursive: true });
      writeFileSync(join(root, '.harness', 'engine', 'rules', 'a.md'), 'a', 'utf8');
      writeFileSync(join(root, '.harness', 'product', 'idea.md'), 'b', 'utf8');
      const scan = scanVendorTree(root);
      assert.deepEqual(scan.map((e) => e.path), ['.harness/engine/rules/a.md']);
      assert.equal(scan[0].sha256, sha256Buffer('a'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
