// hook-io.mjs — shared Cursor safety hook I/O helpers.
// docs: Cursor Hooks — beforeShellExecution uses permission; beforeSubmitPrompt uses continue
// via https://cursor.com/docs/hooks

import { readFileSync } from 'node:fs';

/**
 * Trim and collapse internal whitespace for stable matching.
 * @param {unknown} command
 * @returns {string}
 */
export function normalizeCommand(command) {
  if (command == null) return '';
  return String(command).trim().replace(/\s+/g, ' ');
}

/**
 * @param {string} raw
 * @returns {Record<string, unknown> | null}
 */
export function parseHookPayload(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object'
      ? /** @type {Record<string, unknown>} */ (parsed)
      : null;
  } catch {
    return null;
  }
}

/**
 * Read hook stdin without blocking when Cursor did not pipe a payload (TTY).
 * @param {string} [raw]
 * @returns {string}
 */
export function readHookStdin(raw) {
  if (typeof raw === 'string') return raw;
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/**
 * @param {string} payload
 * @returns {string}
 */
export function extractCommand(payload) {
  const p = parseHookPayload(payload);
  if (!p) return '';
  const cmd = p.command;
  return typeof cmd === 'string' ? cmd : '';
}

/** @typedef {{ permission: 'allow' | 'deny', user_message?: string, agent_message?: string }} HookDecision */

/**
 * @param {HookDecision} decision
 */
export function emitDecision(decision) {
  const out = { permission: decision.permission };
  if (decision.permission === 'deny') {
    if (decision.user_message) out.user_message = decision.user_message;
    if (decision.agent_message) out.agent_message = decision.agent_message;
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
}

/**
 * @returns {HookDecision}
 */
export function allowDecision() {
  return { permission: 'allow' };
}

/**
 * @param {string} [message]
 * @returns {HookDecision}
 */
export function denyDecision(message) {
  if (!message) return { permission: 'deny' };
  return {
    permission: 'deny',
    user_message: message,
    agent_message: message,
  };
}

/** @typedef {{ continue: boolean, user_message?: string }} PromptHookDecision */

/**
 * Map internal allow/deny to Cursor beforeSubmitPrompt output (`continue`, not `permission`).
 * @param {{ permission: 'allow' | 'deny', user_message?: string }} decision
 * @returns {PromptHookDecision}
 */
export function toPromptHookOutput(decision) {
  if (decision.permission === 'allow') {
    return { continue: true };
  }
  const out = { continue: false };
  if (decision.user_message) out.user_message = decision.user_message;
  return out;
}

/**
 * @param {PromptHookDecision} decision
 */
export function emitPromptDecision(decision) {
  const out = { continue: decision.continue };
  if (decision.continue === false && decision.user_message) {
    out.user_message = decision.user_message;
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
}
