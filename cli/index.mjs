#!/usr/bin/env node
// create-midas — thin shim: parse argv → lifecycle engine → execute (lib/runtime).
//
//   npx github:okuzpe/midas-harness          # into the current directory
//   npx github:okuzpe/midas-harness my-app   # into ./my-app
//
// Dependency-free (Node 22+). Lifecycle: requirements → checks → plan → confirm → execute → verify.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ROUTING_PROFILE, isKnownRoutingProfile, normalizeRoutingProfile } from './template/.harness/scripts/model-profiles.mjs';
import { formatInstallCmd } from './lib/core/install-cmd.mjs';
import { formatMigrationPlan, planHarnessMigration } from './migrate-harness.mjs';
import {
  KNOWN_TOOLS as LIB_KNOWN_TOOLS,
  parseInstallerArgs,
} from './lib/cli/args.mjs';
import { runInstaller } from './lib/workflow/engine.mjs';
import { createExecuteHandler } from './lib/runtime/execute.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, 'template');

/** Engine version from the bundled template (falls back only when the template is missing). */
function readBundledVersion() {
  try {
    return readFileSync(join(TEMPLATE, '.harness', 'engine', 'VERSION'), 'utf8').trim();
  } catch {
    return '0.0.0';
  }
}

/** Tools the installer accepts on `--tools`. */
export const KNOWN_TOOLS = LIB_KNOWN_TOOLS;

let parsedCmd;
try {
  parsedCmd = parseInstallerArgs(process.argv.slice(2));
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}

if (parsedCmd.command === 'help') {
  printHelp();
  process.exit(0);
}

const installRoutingProfile = normalizeRoutingProfile(parsedCmd.routing) || DEFAULT_ROUTING_PROFILE;
if (parsedCmd.routing && !isKnownRoutingProfile(installRoutingProfile)) {
  console.error('create-midas: --routing must be claude, openai-mini, or local-hybrid');
  process.exit(1);
}

const targetArg = parsedCmd.target;
const TARGET = resolve(process.cwd(), targetArg);
const NAME = basename(TARGET).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'project';

if (!existsSync(TEMPLATE) && parsedCmd.command !== 'diagnose') {
  console.error('create-midas: bundled template is missing — please reinstall the package.');
  process.exit(1);
}

const installCmd = formatInstallCmd({ version: readBundledVersion(), tools: 'cursor' });

const execute = createExecuteHandler({
  template: TEMPLATE,
  target: TARGET,
  name: NAME,
  targetArg,
  cmd: parsedCmd,
  routingProfile: installRoutingProfile,
  autonomy: parsedCmd.autonomy,
  testFailStep: process.env.MIDAS_TEST_FAIL_STEP || '',
  jsonOut: parsedCmd.json,
});

// Set the status and let the loop drain rather than calling process.exit(): once `update` can make
// a network call, a forcible exit aborts on a half-closed libuv handle (Windows: "Assertion failed:
// !(handle->flags & UV_HANDLE_CLOSING)") and the shell sees a crash code instead of ours.
process.exitCode = await runInstaller(parsedCmd, {
  template: TEMPLATE,
  bundledVersion: readBundledVersion(),
  installCmd,
  planMigration: (dir) => planHarnessMigration(dir),
  formatMigrationPlan,
  execute,
});

function printHelp() {
  const pin = `v${readBundledVersion()}`;
  console.log(`create-midas — install (or uninstall) the Midas harness in a project

Install:
  npx github:okuzpe/midas-harness          into the current directory (from GitHub)
  npx github:okuzpe/midas-harness my-app   into ./my-app
  npx github:okuzpe/midas-harness#${pin} --tools=cursor
  npx github:okuzpe/midas-harness --layout=harness   explicit no-op; v2 has one layout

Update (one command — v2 refresh, or auto-migrate 1.x then refresh):
  npx github:okuzpe/midas-harness#${pin} update --yes
  npx github:okuzpe/midas-harness update --check       is there anything new? (no writes; exit 1 if yes)
  npx github:okuzpe/midas-harness update --dry-run     list every write, removal and conflict first
  npx github:okuzpe/midas-harness update --yes         unpinned main (bleeding)

  update reconciles the whole engine tree against .harness/manifest.json: new files are written,
  dropped files and directories are removed, and vendor files you edited are overwritten with your
  version saved to .harness/conflicts/. Your product, rules, runs and state are never touched.
  The --update flag remains a silent alias for the update subcommand.

Optional explicit migrate (preview / apply):
  npx github:okuzpe/midas-harness#${pin} --migrate          preview only; writes nothing
  npx github:okuzpe/midas-harness#${pin} --migrate --apply  same end-state as --update on 1.x

Uninstall (surgical — removes only Midas's files, keeps your work):
  npx github:okuzpe/midas-harness --uninstall             remove owned engine files; keep product, rules, runs, state
  npx github:okuzpe/midas-harness --uninstall --dry-run   preview what would be removed
  npx github:okuzpe/midas-harness --uninstall --purge     also remove your .harness product, rules, runs and state

Options:
  --layout     only harness is accepted; classic/compact/hub are read-only migration inputs
  --routing    (install) claude, openai-mini, or local-hybrid (legacy openai alias accepted)
  --autonomy   (install|update) copy optional bounded-autonomy capability to .harness/autonomy
  --tools      comma-separated AI tools (e.g. cursor or cursor,claude-code)
  --force      (install) overwrite files that already exist
  --migrate    preview a v1 → v2 migration without writing
  --apply      apply the migration plan; valid with --migrate
  --update     alias for the update subcommand
  --check      (update) compare hashes vs the channel and exit — 0 current, 1 available, 2 undetermined.
               never downloads; prints the npx command to apply
  --channel    stable (default) or edge — edge tracks every push to main
  --offline    (update) skip the network; use the cached channel manifest
  --manifest-file  (update) read a release manifest from disk instead of the network
  --uninstall  remove Midas instead of installing it
  --dry-run    plan only (install/update/migrate/uninstall) — write nothing
  --json       machine-readable diagnose / plan / result on stdout
  --yes, -y    skip TTY confirmation for update / migrate --apply / uninstall
  --purge      (uninstall) also delete your product artifacts and audit trail
  --diagnose   read-only — print install state and the single next command (no writes)
  -h, --help   show this help

Lifecycle: requirements → checks → plan → confirm → execute → verify → result.
Ops with apply/verify drive execution; file-level plan rows are informational.
After install, open the project and run /midas-init, then /midas-status.
Not sure? Run: npx github:okuzpe/midas-harness --diagnose
Docs: https://github.com/okuzpe/midas-harness`);
}
