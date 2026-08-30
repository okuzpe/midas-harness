// characterization.mjs — byte-stable snapshots of generated trees and adapter bodies (Phase 0 net).
// Refresh: `MIDAS_UPDATE_SNAPSHOTS=1 node scripts/test/snapshots/refresh.mjs`

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { computeAdapters } from '../render-adapters.mjs';
import { walkFiles } from './walk.mjs';

export const SNAPSHOT_DIR_REL = 'scripts/test/snapshots';

/**
 * @param {Buffer | string} data
 * @returns {string}
 */
export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Ordered content digest of every file under `dir` (posix relpaths).
 * @param {string} dir
 * @returns {{ digest: string, fileCount: number, files: string[] }}
 */
export function treeSnapshot(dir) {
  const files = existsSync(dir) ? walkFiles(dir, { relativeTo: dir, exclude: ['.git', 'node_modules'] }) : [];
  const hash = createHash('sha256');
  for (const rel of files) {
    hash.update(rel);
    hash.update('\0');
    hash.update(readFileSync(join(dir, rel)));
    hash.update('\0');
  }
  return { digest: hash.digest('hex'), fileCount: files.length, files };
}

/**
 * @param {string} root
 * @returns {{ adapters: Record<string, string>, adapterPaths: string[], template: { digest: string, fileCount: number }, plugin: { digest: string, fileCount: number } }}
 */
export function computeCharacterization(root) {
  const adapters = {};
  const adapterPaths = [];
  for (const f of computeAdapters(root).files) {
    adapters[f.path.replace(/\\/g, '/')] = sha256(f.content);
    adapterPaths.push(f.path.replace(/\\/g, '/'));
  }
  adapterPaths.sort();
  const template = treeSnapshot(join(root, 'cli', 'template'));
  const plugin = treeSnapshot(join(root, 'harness', 'plugins', 'midas'));
  return {
    adapters,
    adapterPaths,
    template: { digest: template.digest, fileCount: template.fileCount },
    plugin: { digest: plugin.digest, fileCount: plugin.fileCount },
  };
}

/**
 * Doctor health-table check names (status ignored — env-stable identity only).
 * @param {string} root
 * @returns {string[]}
 */
export function collectDoctorCheckNames(root) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'doctor.mjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const names = [];
  for (const line of `${r.stdout || ''}\n${r.stderr || ''}`.split(/\r?\n/)) {
    const m = line.match(/^\s+(ok|warn|fail|skip)\s+(\S+)/);
    if (m) names.push(m[2].replace(/\\/g, '/'));
  }
  return [...new Set(names)].sort();
}

/**
 * @param {string} root
 * @param {{ update?: boolean }} [opts]
 * @returns {{ ok: boolean, diffs: string[], snapshotDir: string }}
 */
export function compareCharacterizationSnapshots(root, opts = {}) {
  const snapDir = join(root, SNAPSHOT_DIR_REL);
  mkdirSync(snapDir, { recursive: true });
  const live = computeCharacterization(root);
  const doctorNames = collectDoctorCheckNames(root);
  const payload = {
    adapters: live.adapters,
    adapterPaths: live.adapterPaths,
    template: live.template,
    plugin: live.plugin,
    doctorCheckNames: doctorNames,
  };
  const adaptersPath = join(snapDir, 'adapters.json');
  const treesPath = join(snapDir, 'trees.json');
  const doctorPath = join(snapDir, 'doctor-checks.json');
  if (opts.update) {
    writeFileSync(adaptersPath, `${JSON.stringify({ adapters: live.adapters, adapterPaths: live.adapterPaths }, null, 2)}\n`);
    writeFileSync(treesPath, `${JSON.stringify({ template: live.template, plugin: live.plugin }, null, 2)}\n`);
    writeFileSync(doctorPath, `${JSON.stringify({ doctorCheckNames: doctorNames }, null, 2)}\n`);
    return { ok: true, diffs: [], snapshotDir: snapDir };
  }
  const diffs = [];
  if (!existsSync(adaptersPath) || !existsSync(treesPath) || !existsSync(doctorPath)) {
    diffs.push('snapshot files missing — run `node scripts/test/snapshots/refresh.mjs`');
    return { ok: false, diffs, snapshotDir: snapDir };
  }
  const storedAdapters = JSON.parse(readFileSync(adaptersPath, 'utf8'));
  const storedTrees = JSON.parse(readFileSync(treesPath, 'utf8'));
  const storedDoctor = JSON.parse(readFileSync(doctorPath, 'utf8'));
  if (JSON.stringify(storedAdapters.adapterPaths) !== JSON.stringify(payload.adapterPaths)) {
    diffs.push('adapterPaths drifted');
  }
  for (const path of payload.adapterPaths) {
    if (storedAdapters.adapters[path] !== payload.adapters[path]) {
      diffs.push(`adapter hash drifted: ${path}`);
    }
  }
  for (const path of Object.keys(storedAdapters.adapters || {})) {
    if (!payload.adapters[path]) diffs.push(`adapter removed: ${path}`);
  }
  if (storedTrees.template.digest !== payload.template.digest) {
    diffs.push(`cli/template digest drifted (${storedTrees.template.fileCount} → ${payload.template.fileCount} files)`);
  }
  if (storedTrees.plugin.digest !== payload.plugin.digest) {
    diffs.push(`harness/plugins/midas digest drifted (${storedTrees.plugin.fileCount} → ${payload.plugin.fileCount} files)`);
  }
  if (JSON.stringify(storedDoctor.doctorCheckNames) !== JSON.stringify(payload.doctorCheckNames)) {
    diffs.push('doctor check names drifted');
  }
  return { ok: diffs.length === 0, diffs, snapshotDir: snapDir };
}

/**
 * @param {string} root
 * @returns {string}
 */
export function snapshotDir(root) {
  return join(root, SNAPSHOT_DIR_REL);
}

export function snapshotFile(root, name) {
  return join(snapshotDir(root), name);
}
