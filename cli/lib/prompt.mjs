// prompt.mjs — TTY confirm/select via node:readline/promises.

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * @param {string} message
 * @param {{ defaultYes?: boolean, signal?: AbortSignal }} [opts]
 * @returns {Promise<boolean>}
 */
export async function confirm(message, opts = {}) {
  if (!input.isTTY || !output.isTTY) return opts.defaultYes !== false;
  const rl = readline.createInterface({ input, output });
  try {
    const hint = opts.defaultYes === false ? 'y/N' : 'Y/n';
    const answer = await rl.question(`${message} [${hint}] `, { signal: opts.signal });
    const trimmed = answer.trim().toLowerCase();
    if (!trimmed) return opts.defaultYes !== false;
    return trimmed === 'y' || trimmed === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * @param {string} message
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<string>}
 */
export async function ask(message, opts = {}) {
  const rl = readline.createInterface({ input, output });
  try {
    return await rl.question(message, { signal: opts.signal });
  } finally {
    rl.close();
  }
}

export function isInteractive() {
  return !!(input.isTTY && output.isTTY);
}
