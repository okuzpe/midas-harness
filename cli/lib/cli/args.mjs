// args.mjs — argv → typed installer command (Node 22 util.parseArgs).

import { parseArgs as nodeParseArgs } from 'node:util';

export const KNOWN_TOOLS = ['claude-code', 'cursor', 'windsurf', 'gemini', 'codex', 'copilot'];
export const DEFAULT_TOOLS = ['cursor'];
export const ALL_ADAPTER_TOOLS = ['claude-code', 'cursor', 'windsurf', 'gemini'];
export const KNOWN_ROUTING = ['claude', 'openai-mini', 'local-hybrid', 'openai'];

/** Positional subcommands. `midas update` and `--update` resolve to the same command. */
export const SUBCOMMANDS = ['install', 'update', 'migrate', 'uninstall', 'diagnose'];

/** Release channels a project can follow. `edge` tracks every push to main. */
export const KNOWN_CHANNELS = ['stable', 'edge'];

/**
 * Parse a comma-separated `--tools` value into known tool ids.
 * @param {string} value
 * @returns {string[]}
 */
export function parseToolsList(value) {
  const tools = value.split(',').map((t) => t.trim()).filter(Boolean);
  for (const t of tools) {
    if (!KNOWN_TOOLS.includes(t)) {
      throw new Error(`create-midas: unknown tool "${t}". Known: ${KNOWN_TOOLS.join(', ')}`);
    }
  }
  if (!tools.length) {
    throw new Error('create-midas: --tools requires at least one tool.');
  }
  return tools;
}

/**
 * @typedef {{
 *   command: 'install'|'update'|'migrate'|'uninstall'|'diagnose'|'help',
 *   target: string,
 *   tools: string[]|null,
 *   toolsFlag: boolean,
 *   force: boolean,
 *   check: boolean,
 *   offline: boolean,
 *   channel: string|null,
 *   manifestFile: string|null,
 *   subcommand: string|null,
 *   dryRun: boolean,
 *   json: boolean,
 *   yes: boolean,
 *   apply: boolean,
 *   purge: boolean,
 *   autonomy: boolean,
 *   resume: boolean,
 *   rollback: boolean,
 *   routing: string|null,
 *   layout: string|null,
 *   positionals: string[],
 * }} InstallCommand
 */

/**
 * @param {string[]} argv process.argv.slice(2)
 * @returns {InstallCommand}
 */
export function parseInstallerArgs(argv) {
  const { values, positionals } = nodeParseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      update: { type: 'boolean', default: false },
      migrate: { type: 'boolean', default: false },
      uninstall: { type: 'boolean', default: false },
      diagnose: { type: 'boolean', default: false },
      apply: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      purge: { type: 'boolean', default: false },
      autonomy: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
      resume: { type: 'boolean', default: false },
      rollback: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      offline: { type: 'boolean', default: false },
      tools: { type: 'string' },
      routing: { type: 'string' },
      layout: { type: 'string' },
      channel: { type: 'string' },
      'manifest-file': { type: 'string' },
    },
  });

  // Support `--tools=a,b` and bare `--tools a,b` (parseArgs may leave tokens as positionals).
  let toolsRaw = values.tools ?? null;
  let toolsFlag = values.tools != null || argv.some((a) => a === '--tools' || a.startsWith('--tools='));
  if (!toolsRaw) {
    const eq = argv.find((a) => a.startsWith('--tools='));
    if (eq) toolsRaw = eq.slice('--tools='.length);
    const idx = argv.indexOf('--tools');
    if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith('-')) {
      toolsRaw = argv[idx + 1];
    }
  }

  let tools = null;
  if (toolsRaw != null) {
    tools = String(toolsRaw).split(',').map((t) => t.trim()).filter(Boolean);
    toolsFlag = true;
  }

  // When `--tools cursor` (space form) is used, parseArgs may also put "cursor" in positionals.
  const consumed = new Set();
  if (toolsRaw != null) {
    for (const part of String(toolsRaw).split(',')) {
      const t = part.trim();
      if (t) consumed.add(t);
    }
  }
  const free = positionals.filter((p) => !String(p).startsWith('-') && !consumed.has(p));
  const subIndex = free.findIndex((p) => SUBCOMMANDS.includes(String(p)));
  const subcommand = subIndex === -1 ? null : String(free[subIndex]);

  const modes = [
    (values.update || subcommand === 'update') && 'update',
    (values.migrate || subcommand === 'migrate') && 'migrate',
    (values.uninstall || subcommand === 'uninstall') && 'uninstall',
    (values.diagnose || subcommand === 'diagnose') && 'diagnose',
  ].filter(Boolean);

  if (values.help) {
    return baseCommand({ command: 'help', positionals, tools, toolsFlag, values, subcommand });
  }
  if (modes.length > 1) {
    const err = new Error(
      'create-midas: choose exactly one of update, migrate, uninstall, or diagnose.',
    );
    err.code = 'MODE_CONFLICT';
    throw err;
  }
  const isMigrate = modes[0] === 'migrate';
  const isUpdate = modes[0] === 'update';
  if (values.apply && !isMigrate) {
    const err = new Error('create-midas: --apply is valid only together with migrate.');
    err.code = 'APPLY_WITHOUT_MIGRATE';
    throw err;
  }
  if (values.resume && values.rollback) {
    const err = new Error('create-midas: choose either --resume or --rollback, not both.');
    err.code = 'RESUME_ROLLBACK_CONFLICT';
    throw err;
  }
  if ((values.resume || values.rollback) && !isUpdate && !isMigrate) {
    const err = new Error('create-midas: --resume/--rollback require update or migrate.');
    err.code = 'RESUME_WITHOUT_MODE';
    throw err;
  }
  if (values.check && !isUpdate) {
    const err = new Error('create-midas: --check is valid only together with update.');
    err.code = 'CHECK_WITHOUT_UPDATE';
    throw err;
  }
  if (values.channel != null && !KNOWN_CHANNELS.includes(String(values.channel))) {
    const err = new Error(
      `create-midas: unknown channel "${values.channel}". Known: ${KNOWN_CHANNELS.join(', ')}`,
    );
    err.code = 'UNKNOWN_CHANNEL';
    throw err;
  }

  const command = modes[0] || 'install';
  const target = free.filter((_, i) => i !== subIndex)[0] || '.';

  return baseCommand({ command, target, positionals, tools, toolsFlag, values, subcommand });
}

function baseCommand({ command, target = '.', positionals = [], tools, toolsFlag, values, subcommand = null }) {
  const refresh = command === 'update' || command === 'migrate';
  return {
    command,
    target,
    tools,
    toolsFlag: !!toolsFlag,
    force: !!(values.force || refresh),
    check: !!values.check,
    offline: !!values.offline,
    channel: values.channel ? String(values.channel) : null,
    manifestFile: values['manifest-file'] ? String(values['manifest-file']) : null,
    subcommand,
    dryRun: !!values['dry-run'],
    json: !!values.json,
    yes: !!values.yes,
    apply: !!values.apply,
    purge: !!values.purge,
    autonomy: !!values.autonomy,
    resume: !!values.resume,
    rollback: !!values.rollback,
    routing: values.routing ? String(values.routing) : null,
    layout: values.layout ? String(values.layout) : null,
    positionals,
  };
}
