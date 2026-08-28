#!/usr/bin/env node
// release-manifest.mjs — publish the content hash of a built bundle so installed projects can ask
// "is there anything new?" without downloading it (engine-only; never shipped to installs).
//
//   node scripts/release-manifest.mjs --channel=edge --commit=$GITHUB_SHA -o edge.json
//   node scripts/release-manifest.mjs --channel=stable --ref=v2.9.9 -o stable.json
//
// Exit 3 with --skip-unchanged when the target file already records this tree hash, so CI can
// avoid an empty commit on every push that does not touch the harness.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeSha256 } from './ownership-manifest.mjs';
import { scanVendorTree } from './lib/reconcile.mjs';
import { listMigrationFiles } from './lib/migrate-state.mjs';

export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;

/** Branch holding the published channel manifests (orphan; never merged into main). */
export const RELEASE_BRANCH = 'releases';

export const CHANNELS = Object.freeze(['stable', 'edge']);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} templateRoot built bundle root (`cli/template`)
 * @param {{
 *   channel: string, version: string, ref: string, commit?: string|null,
 *   engineDir?: string, publishedAt?: string,
 * }} opts
 */
export function buildReleaseManifest(templateRoot, opts) {
  if (!CHANNELS.includes(opts.channel)) {
    throw new Error(`release-manifest: unknown channel "${opts.channel}" (known: ${CHANNELS.join(', ')})`);
  }
  const files = scanVendorTree(templateRoot);
  if (!files.length) {
    throw new Error(`release-manifest: no vendor files under ${templateRoot} — run npm run build first`);
  }
  const engineDir = opts.engineDir ?? join(templateRoot, '.harness', 'engine');
  const migrations = listMigrationFiles(engineDir)
    .map((file) => file.split(/[\\/]/).pop().replace(/\.mjs$/, ''))
    .sort();
  return {
    schema_version: RELEASE_MANIFEST_SCHEMA_VERSION,
    channel: opts.channel,
    version: opts.version,
    ref: opts.ref,
    commit: opts.commit ?? null,
    tree_sha256: treeSha256(files),
    published_at: opts.publishedAt ?? new Date().toISOString(),
    migrations,
    files,
  };
}

function parseArgs(argv) {
  const out = { channel: 'edge', commit: null, ref: null, out: null, skipUnchanged: false };
  for (const arg of argv) {
    if (arg.startsWith('--channel=')) out.channel = arg.slice('--channel='.length);
    else if (arg.startsWith('--commit=')) out.commit = arg.slice('--commit='.length);
    else if (arg.startsWith('--ref=')) out.ref = arg.slice('--ref='.length);
    else if (arg.startsWith('-o=') || arg.startsWith('--out=')) out.out = arg.split('=').slice(1).join('=');
    else if (arg === '--skip-unchanged') out.skipUnchanged = true;
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  const templateRoot = join(ROOT, 'cli', 'template');
  const version = (readFileSync(join(ROOT, 'harness', 'VERSION'), 'utf8') || '').trim();
  const ref = args.ref || (args.channel === 'stable' ? `v${version}` : 'main');
  const manifest = buildReleaseManifest(templateRoot, {
    channel: args.channel,
    version,
    ref,
    commit: args.commit,
  });

  const outPath = args.out ? resolve(process.cwd(), args.out) : null;
  if (args.skipUnchanged && outPath && existsSync(outPath)) {
    try {
      const prior = JSON.parse(readFileSync(outPath, 'utf8'));
      if (prior?.tree_sha256 === manifest.tree_sha256) {
        console.log(`release-manifest: ${args.channel} unchanged at ${manifest.tree_sha256.slice(0, 12)}`);
        process.exit(3);
      }
    } catch { /* unreadable prior manifest — republish */ }
  }

  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  if (outPath) {
    writeFileSync(outPath, body, 'utf8');
    console.log(
      `release-manifest: ${args.channel} v${version} (${manifest.files.length} files,` +
      ` tree ${manifest.tree_sha256.slice(0, 12)}) → ${outPath}`,
    );
  } else {
    process.stdout.write(body);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
