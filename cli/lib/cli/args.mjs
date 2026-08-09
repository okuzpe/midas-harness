// args.mjs — argv → typed installer command (Node 22 util.parseArgs).

import { parseArgs as nodeParseArgs } from 'node:util';

export const KNOWN_TOOLS = ['claude-code', 'cursor', 'windsurf', 'gemini', 'codex', 'copilot'];
export const DEFAULT_TOOLS = ['cursor'];
export const ALL_ADAPTER_TOOLS = ['claude-code', 'cursor', 'windsurf', 'gemini'];
export const KNOWN_ROUTING = ['claude', 'openai-mini', 'local-hybrid', 'openai'];

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
      tools: { type: 'string' },
      routing: { type: 'string' },
      layout: { type: 'string' },
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

  const modes = [
    values.update && 'update',
    values.migrate && 'migrate',
    values.uninstall && 'uninstall',
    values.diagnose && 'diagnose',
  ].filter(Boolean);

  if (values.help) {
    return baseCommand({ command: 'help', positionals, tools, toolsFlag, values });
  }
  if (modes.length > 1) {
    const err = new Error('create-midas: choose exactly one of --update, --migrate, or --uninstall.');
    err.code = 'MODE_CONFLICT';
    throw err;
  }
  if (values.apply && !values.migrate) {
    const err = new Error('create-midas: --apply is valid only together with --migrate.');
    err.code = 'APPLY_WITHOUT_MIGRATE';
    throw err;
  }
  if (values.resume && values.rollback) {
    const err = new Error('create-midas: choose either --resume or --rollback, not both.');
    err.code = 'RESUME_ROLLBACK_CONFLICT';
    throw err;
  }
  if ((values.resume || values.rollback) && !values.update && !values.migrate) {
    const err = new Error('create-midas: --resume/--rollback require --update or --migrate.');
    err.code = 'RESUME_WITHOUT_MODE';
    throw err;
  }

  const command = values.diagnose
    ? 'diagnose'
    : values.update
      ? 'update'
      : values.migrate
        ? 'migrate'
        : values.uninstall
          ? 'uninstall'
          : 'install';

  // When `--tools cursor` (space form) is used, parseArgs may also put "cursor" in positionals.
  const consumed = new Set();
  if (toolsRaw != null) {
    for (const part of String(toolsRaw).split(',')) {
      const t = part.trim();
      if (t) consumed.add(t);
    }
  }
  const target = positionals.find((p) => !String(p).startsWith('-') && !consumed.has(p)) || '.';

  return baseCommand({ command, target, positionals, tools, toolsFlag, values });
}

function baseCommand({ command, target = '.', positionals = [], tools, toolsFlag, values }) {
  return {
    command,
    target,
    tools,
    toolsFlag: !!toolsFlag,
    force: !!(values.force || values.update || values.migrate),
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
