#!/usr/bin/env node
// midas.mjs — short shell entry. Always fetches latest `main` via npx (never a stale global copy).
//
//   midas update      refresh this project from edge (every push to main), no confirm prompt
//   midas diagnose    print the single next command
//   midas --help

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NPX_PACKAGE = 'github:okuzpe/midas-harness';

/** Shim help only for a bare invocation — never swallow `midas update --help`. */
export function shimWantsHelp(args) {
  if (!args.length) return true;
  const first = args[0];
  return first === 'help' || first === '--help' || first === '-h';
}

/** `update` always tracks latest main and skips TTY confirm unless the caller opted out. */
export function withUpdateDefaults(args) {
  const forwarded = [...args];
  if (forwarded[0] !== 'update') return forwarded;
  if (!forwarded.some((a) => a === '--channel' || a.startsWith('--channel='))) {
    forwarded.push('--channel=edge');
  }
  if (!forwarded.some((a) => a === '--yes' || a === '-y' || a === '--dry-run')) {
    forwarded.push('--yes');
  }
  return forwarded;
}

function printShimHelp() {
  process.stdout.write(
    [
      'Midas — run from the product repo',
      '',
      '  midas update       latest main (edge), non-interactive',
      '  midas diagnose     install status + next command',
      '  midas uninstall    remove the engine (keeps product/rules/runs)',
      '  midas --help       this text',
      '',
      'Always downloads current main. Do not install midas globally for updates.',
      '',
    ].join('\n'),
  );
}

/** Quote one token for `cmd.exe /c` (no `shell: true` — avoids Node DEP0190). */
export function quoteCmdArg(arg) {
  const s = String(arg);
  if (s.length === 0) return '""';
  if (!/[\s"&<>^|()]/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

function runNpx(forwarded) {
  const args = ['-y', NPX_PACKAGE, ...forwarded];
  if (process.platform !== 'win32') {
    return spawnSync('npx', args, { stdio: 'inherit', env: process.env });
  }
  const line = ['npx.cmd', ...args].map(quoteCmdArg).join(' ');
  return spawnSync('cmd.exe', ['/d', '/s', '/c', line], {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });
}

export function main(argv = process.argv.slice(2)) {
  if (shimWantsHelp(argv)) {
    printShimHelp();
    process.exitCode = 0;
    return 0;
  }

  const result = runNpx(withUpdateDefaults(argv));
  const status = result.status === null ? 1 : result.status;
  process.exitCode = status;
  return status;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(entry).toLowerCase();
  } catch {
    return false;
  }
}

if (isDirectRun()) main();
