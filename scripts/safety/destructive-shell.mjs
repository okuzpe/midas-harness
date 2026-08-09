// destructive-shell.mjs — Cursor beforeShellExecution: deny destructive shell patterns.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumeReceipt } from '../lib/commit-receipt.mjs';
import { resolveProjectRootFromScript } from '../paths.mjs';
import {
  normalizeCommand,
  extractCommand,
  emitDecision,
  allowDecision,
  denyDecision,
} from './lib/hook-io.mjs';

const DEFAULT_ROOT = resolveProjectRootFromScript(import.meta.url);

const FORCE_PUSH_DENY =
  'Destructive force-push blocked. Use --force-with-lease only with a valid commit approval receipt after explicit user request.';

/**
 * @param {string} command
 * @returns {boolean}
 */
export function isDryRun(command) {
  return /(?:^|\s)--dry-run\b/i.test(command);
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function matchesRmRf(command) {
  if (/\brm\s+-(?:rf|fr)\b/i.test(command)) return true;
  if (/\brm\s+-\S*[rf]\S*\s+\S/i.test(command) && /-(?:\S*f\S*r\S*|\S*r\S*f\S*)/i.test(command)) {
    return true;
  }
  return false;
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function matchesGitCleanFdx(command) {
  return /\bgit\s+clean\b.*\s-(?:f{1,2}d|fd)x\b/i.test(command);
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function matchesGitResetHard(command) {
  return /\bgit\s+reset\b.*\s--hard\b/i.test(command);
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function matchesFindDelete(command) {
  return /\bfind\b.+\s-delete\b/i.test(command);
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function matchesTruncateOrDd(command) {
  if (/\bdd\b/i.test(command) && /\bof=/i.test(command)) return true;
  if (/\btruncate\b/i.test(command) && /(?:\s|^)(?:-s|--size)\s*0\b/i.test(command)) {
    return true;
  }
  return false;
}

/**
 * @param {string} command
 * @returns {'force-with-lease' | 'force-other' | null}
 */
export function classifyForcePush(command) {
  if (!/(?:^|\s)git(?:\.exe)?\s+push\b/i.test(command)) return null;
  if (/(?:^|\s)--force-with-lease\b/i.test(command)) return 'force-with-lease';
  if (/(?:^|\s)--force\b/i.test(command) || /(?:^|\s)-f(?:\s|$)/.test(command)) {
    return 'force-other';
  }
  if (/(?:^|\s)\+[\w./-]/.test(command) || /(?:^|\s)\+refs\//i.test(command)) {
    return 'force-other';
  }
  return null;
}

/**
 * @param {string} command
 * @param {{
 *   projectRoot?: string,
 *   consumeReceipt?: typeof consumeReceipt,
 * }} [opts]
 * @returns {import('./lib/hook-io.mjs').HookDecision}
 */
export function evaluateCommand(command, opts = {}) {
  const normalized = normalizeCommand(command);
  if (!normalized) {
    return denyDecision('Empty shell command blocked by destructive-shell (fail-closed).');
  }

  if (isDryRun(normalized)) return allowDecision();

  if (matchesRmRf(normalized)) {
    return denyDecision('Destructive `rm -rf` blocked.');
  }

  if (matchesGitCleanFdx(normalized)) {
    return denyDecision('Destructive `git clean -fdx` blocked.');
  }

  if (matchesGitResetHard(normalized)) {
    return denyDecision('Destructive `git reset --hard` blocked.');
  }

  if (matchesFindDelete(normalized)) {
    return denyDecision('Destructive `find … -delete` blocked.');
  }

  if (matchesTruncateOrDd(normalized)) {
    return denyDecision('Destructive truncate/dd blocked.');
  }

  const forceKind = classifyForcePush(normalized);
  if (forceKind === 'force-with-lease') {
    const projectRoot = opts.projectRoot || DEFAULT_ROOT;
    const consume = opts.consumeReceipt || consumeReceipt;
    if (consume(projectRoot, 'force-with-lease')) {
      return allowDecision();
    }
    return denyDecision(FORCE_PUSH_DENY);
  }

  if (forceKind === 'force-other') {
    return denyDecision(FORCE_PUSH_DENY);
  }

  return allowDecision();
}

/**
 * @param {string} raw
 * @param {{ projectRoot?: string }} [opts]
 * @returns {import('./lib/hook-io.mjs').HookDecision}
 */
export function handleHookStdin(raw, opts = {}) {
  const command = extractCommand(raw);
  return evaluateCommand(command, opts);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const raw = readFileSync(0, 'utf8');
    const result = handleHookStdin(raw);
    emitDecision(result);
  } catch {
    emitDecision(denyDecision('destructive-shell hook failed (fail-closed).'));
  }
  process.exit(0);
}
