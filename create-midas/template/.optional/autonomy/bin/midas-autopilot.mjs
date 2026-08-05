#!/usr/bin/env node
/**
 * midas-autopilot — optional bounded autonomy controller CLI.
 * Commands: dry-run | tick | status | resume | authz-grant
 */
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCommitPushAuthz, writeAuthz } from '../lib/authz.mjs';
import { loadProjectPolicy } from '../lib/policy.mjs';
import { dryRun, resume, statusReport, tick } from '../lib/tick.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args.find((a) => !a.startsWith('-')) || 'status';
  const flags = {};
  for (const a of args) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return { cmd, flags };
}

function printHelp() {
  console.log(`midas-autopilot — Midas bounded autonomy (optional)

Usage:
  midas-autopilot status [--root=.]
  midas-autopilot dry-run [--root=.]
  midas-autopilot tick [--root=.] [--runner=fake|cursor-cloud]
  midas-autopilot resume [--root=.] [--runner=fake|cursor-cloud]
  midas-autopilot authz-grant --actor=NAME --hours=24 [--root=.]

Environment:
  CURSOR_API_KEY                 required for cursor-cloud runner
  MIDAS_AUTONOMY_AUTHZ_KEY       required to grant/validate commit-push authz (HMAC)
  MIDAS_AUTONOMY_FAKE_SCENARIO   success|crash_before_effect|crash_after_effect|
                                 rate_limit_unknown|budget|quota|needs_merge
  MIDAS_AUTONOMY_JOURNAL_KEY     optional MAC key for journal batches
`);
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv);
  if (cmd === '-h' || cmd === 'help' || flags.help) {
    printHelp();
    process.exit(0);
  }
  const root = resolve(process.cwd(), flags.root || '.');

  if (cmd === 'status') {
    console.log(JSON.stringify(statusReport(root), null, 2));
    return;
  }
  if (cmd === 'dry-run') {
    console.log(JSON.stringify(dryRun(root, { repo: flags.repo }), null, 2));
    return;
  }
  if (cmd === 'tick') {
    const result = await tick(root, {
      runner: flags.runner,
      repo: flags.repo,
      repoUrl: flags['repo-url'],
      scenario: flags.scenario,
      orchestrateModelId: flags['orchestrate-model'],
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok || result.reconciled ? 0 : 1);
  }
  if (cmd === 'resume') {
    const result = await resume(root, {
      runner: flags.runner,
      repo: flags.repo,
      repoUrl: flags['repo-url'],
      scenario: flags.scenario,
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok || result.reconciled ? 0 : 1);
  }
  if (cmd === 'authz-grant') {
    const policy = loadProjectPolicy(root, { createIfMissing: true });
    if (policy.errors.length) {
      console.error(JSON.stringify({ ok: false, errors: policy.errors }, null, 2));
      process.exit(1);
    }
    const hours = Number(flags.hours || 24);
    const record = createCommitPushAuthz({
      repo: flags.repo || 'local/project',
      branchPrefix: policy.policy.branch.prefix,
      actionId: 'execute-next-sprint-task',
      policyDigest: policy.digest,
      actor: flags.actor || 'human',
      expiresAt: new Date(Date.now() + hours * 3600_000).toISOString(),
      singleUse: flags['multi-use'] ? false : true,
    });
    writeAuthz(root, record);
    console.log(JSON.stringify({
      ok: true,
      path: '.harness/autonomy/authz/commit-push.json',
      mac: record.mac,
      content_digest: record.content_digest,
    }, null, 2));
    return;
  }

  console.error(`unknown command: ${cmd}`);
  printHelp();
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
