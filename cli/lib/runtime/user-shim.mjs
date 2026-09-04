// user-shim.mjs — install a `midas` command that always npx-fetches latest main.
//
// Project: `.harness/bin/midas` (+ `midas.cmd` on Windows).
// User: `~/.midas/bin/` and, on Windows, prepend that dir to the User PATH.
// PATH mutation is skipped for temp/CI installs so tests cannot rewrite the developer PATH.

import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LAUNCHER_NAME = 'midas.mjs';

function readLauncherSource() {
  const here = dirname(fileURLToPath(import.meta.url));
  const bundled = join(here, '..', '..', 'template', '.harness', 'scripts', LAUNCHER_NAME);
  if (existsSync(bundled)) return readFileSync(bundled, 'utf8');
  const repo = join(here, '..', '..', '..', 'scripts', LAUNCHER_NAME);
  return readFileSync(repo, 'utf8');
}

function writeUnixLauncher(dir) {
  const dest = join(dir, 'midas');
  const body = readLauncherSource();
  writeFileSync(dest, body.startsWith('#!') ? body : `#!/usr/bin/env node\n${body}`, 'utf8');
  try {
    chmodSync(dest, 0o755);
  } catch {
    // Windows or no chmod — midas.cmd covers the shell
  }
  return dest;
}

function writeWindowsCmd(dir) {
  const dest = join(dir, 'midas.cmd');
  writeFileSync(
    dest,
    '@echo off\r\nnode "%~dp0midas.mjs" %*\r\n',
    'utf8',
  );
  writeFileSync(join(dir, LAUNCHER_NAME), readLauncherSource(), 'utf8');
  return dest;
}

function writeBinDir(dir) {
  mkdirSync(dir, { recursive: true });
  writeUnixLauncher(dir);
  writeWindowsCmd(dir);
  return dir;
}

function isTempInstall(target) {
  const tmp = resolve(tmpdir());
  const abs = resolve(target);
  return abs === tmp || abs.startsWith(`${tmp}\\`) || abs.startsWith(`${tmp}/`);
}

function prependWindowsUserPath(dir) {
  const ps = [
    `$dir = ${JSON.stringify(dir)}`,
    `$user = [Environment]::GetEnvironmentVariable('Path', 'User')`,
    `if (-not $user) { $user = '' }`,
    `$parts = @($user -split ';' | Where-Object { $_ -and $_.Trim() })`,
    `if ($parts -contains $dir) { exit 0 }`,
    `$next = if ($user.Trim()) { "$dir;$user" } else { $dir }`,
    `[Environment]::SetEnvironmentVariable('Path', $next, 'User')`,
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0;
}

/**
 * @param {{ target: string }} opts
 * @returns {{ projectBin: string, userBin: string|null, pathUpdated: boolean }}
 */
export function installMidasShims(opts) {
  const projectBin = writeBinDir(join(opts.target, '.harness', 'bin'));
  if (process.env.MIDAS_SKIP_USER_SHIM === '1' || isTempInstall(opts.target)) {
    return { projectBin, userBin: null, pathUpdated: false };
  }
  const userBin = writeBinDir(join(homedir(), '.midas', 'bin'));
  let pathUpdated = false;
  if (process.platform === 'win32' && process.env.MIDAS_SKIP_USER_PATH !== '1') {
    pathUpdated = prependWindowsUserPath(userBin);
  }
  return { projectBin, userBin, pathUpdated };
}
