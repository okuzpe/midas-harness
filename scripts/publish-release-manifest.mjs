#!/usr/bin/env node
// publish-release-manifest.mjs — push a channel manifest to the orphan `releases` branch.
//
//   node scripts/publish-release-manifest.mjs --channel=edge   --commit=$GITHUB_SHA
//   node scripts/publish-release-manifest.mjs --channel=stable --ref=v2.9.9 --commit=$GITHUB_SHA
//
// The manifest lives on a branch of its own so publishing it cannot trigger the CI that produced
// it, and so `raw.githubusercontent.com` can serve it without shipping anything else.
// Engine-only; never shipped to installs. Exits 0 when there was nothing new to publish.

import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELEASE_BRANCH } from './release-manifest.mjs';
import { maybeHelp } from './lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function git(args, opts = {}) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });
}

function gitOrThrow(args, opts = {}) {
  const r = git(args, opts);
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`);
  }
  return r;
}

function parseArgs(argv) {
  const out = { channel: 'edge', commit: null, ref: null, dryRun: false };
  for (const arg of argv) {
    if (arg.startsWith('--channel=')) out.channel = arg.slice('--channel='.length);
    else if (arg.startsWith('--commit=')) out.commit = arg.slice('--commit='.length);
    else if (arg.startsWith('--ref=')) out.ref = arg.slice('--ref='.length);
    else if (arg === '--dry-run') out.dryRun = true;
  }
  return out;
}

/** Check out `releases` into `dir`, creating it as an orphan the first time. */
function prepareWorktree(dir) {
  const remote = git(['ls-remote', '--exit-code', '--heads', 'origin', RELEASE_BRANCH]);
  if (remote.status === 0) {
    gitOrThrow(['fetch', '--depth=1', 'origin', `${RELEASE_BRANCH}:refs/remotes/origin/${RELEASE_BRANCH}`]);
    gitOrThrow(['worktree', 'add', '-B', RELEASE_BRANCH, dir, `refs/remotes/origin/${RELEASE_BRANCH}`]);
    return { created: false };
  }
  gitOrThrow(['worktree', 'add', '--detach', dir, 'HEAD']);
  // A local branch left over from an earlier run would make --orphan fail; the remote is the truth.
  git(['branch', '-D', RELEASE_BRANCH]);
  gitOrThrow(['-C', dir, 'checkout', '--orphan', RELEASE_BRANCH]);
  git(['-C', dir, 'rm', '-rf', '--quiet', '.']);
  for (const name of readdirSync(dir)) {
    if (name !== '.git') rmSync(join(dir, name), { recursive: true, force: true });
  }
  return { created: true };
}

function main(argv) {
  const args = parseArgs(argv);
  const worktree = mkdtempSync(join(tmpdir(), 'midas-releases-'));
  rmSync(worktree, { recursive: true, force: true });

  let added = false;
  try {
    // The published hash must describe the bundle built from this commit, not a stale checkout.
    const build = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-create.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (build.status !== 0) {
      throw new Error(`build-create failed: ${(build.stderr || build.stdout || '').trim()}`);
    }

    prepareWorktree(worktree);
    added = true;

    const outFile = join(worktree, `${args.channel}.json`);
    const genArgs = [
      join(ROOT, 'scripts', 'release-manifest.mjs'),
      `--channel=${args.channel}`,
      `-o=${outFile}`,
      '--skip-unchanged',
    ];
    if (args.commit) genArgs.push(`--commit=${args.commit}`);
    if (args.ref) genArgs.push(`--ref=${args.ref}`);
    const gen = spawnSync(process.execPath, genArgs, { cwd: ROOT, encoding: 'utf8' });
    process.stdout.write(gen.stdout || '');
    if (gen.status === 3) {
      console.log(`publish-release-manifest: ${args.channel} already published — nothing to do`);
      return 0;
    }
    if (gen.status !== 0) {
      throw new Error(`release-manifest failed: ${(gen.stderr || gen.stdout || '').trim()}`);
    }

    if (!existsSync(outFile)) throw new Error(`release-manifest wrote no ${outFile}`);
    gitOrThrow(['-C', worktree, 'add', `${args.channel}.json`]);
    if (git(['-C', worktree, 'diff', '--cached', '--quiet']).status === 0) {
      console.log(`publish-release-manifest: ${args.channel} unchanged — nothing to commit`);
      return 0;
    }

    if (!git(['-C', worktree, 'config', 'user.email']).stdout?.trim()) {
      gitOrThrow(['-C', worktree, 'config', 'user.email', 'actions@github.com']);
      gitOrThrow(['-C', worktree, 'config', 'user.name', 'github-actions[bot]']);
    }
    const subject = `chore(release): publish ${args.channel} manifest${args.commit ? ` for ${args.commit.slice(0, 7)}` : ''}`;
    gitOrThrow(['-C', worktree, 'commit', '-m', subject]);
    if (args.dryRun) {
      console.log(`publish-release-manifest: dry run — would push ${RELEASE_BRANCH}`);
      return 0;
    }
    gitOrThrow(['-C', worktree, 'push', 'origin', `HEAD:refs/heads/${RELEASE_BRANCH}`]);
    console.log(`publish-release-manifest: pushed ${args.channel}.json to ${RELEASE_BRANCH}`);
    return 0;
  } finally {
    if (added) git(['worktree', 'remove', '--force', worktree]);
    rmSync(worktree, { recursive: true, force: true });
    git(['worktree', 'prune']);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.error(`publish-release-manifest: ${err.message || err}`);
    process.exit(1);
  }
}
