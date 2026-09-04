#!/usr/bin/env node
// midas.mjs — short shell entry. Always fetches latest `main` via npx (never a stale global copy).
//
//   midas update      refresh this project from edge (every push to main), no confirm prompt
//   midas diagnose    print the single next command
//   midas --help

import { spawnSync } from 'node:child_process';

const NPX_PACKAGE = 'github:okuzpe/midas-harness';
const forwarded = process.argv.slice(2);

if (forwarded.length === 0 || forwarded[0] === 'help' || forwarded.includes('--help') || forwarded.includes('-h')) {
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
  process.exit(0);
}

if (forwarded[0] === 'update') {
  if (!forwarded.some((a) => a === '--channel' || a.startsWith('--channel='))) {
    forwarded.push('--channel=edge');
  }
  if (!forwarded.some((a) => a === '--yes' || a === '-y' || a === '--dry-run')) {
    forwarded.push('--yes');
  }
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, ['-y', NPX_PACKAGE, ...forwarded], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});
process.exit(result.status === null ? 1 : result.status);
