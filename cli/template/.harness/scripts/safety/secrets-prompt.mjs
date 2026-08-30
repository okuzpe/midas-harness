#!/usr/bin/env node
// secrets-prompt.mjs — Cursor beforeSubmitPrompt safety hook (ADR-012). Fail-closed on secrets.
// Output contract: { continue: true } | { continue: false, user_message } — NOT permission (shell hooks).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitPromptDecision, readHookStdin, toPromptHookOutput } from './lib/hook-io.mjs';
import { maybeHelp } from '../lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

/**
 * High-confidence secret-like patterns (small, documented list).
 * Never include matched substrings in user-facing messages.
 * @type {ReadonlyArray<{ id: string, pattern: RegExp }>}
 */
export const SECRET_PATTERNS = Object.freeze([
  { id: 'openai_api_key', pattern: /sk-[A-Za-z0-9]{20,}/ },
  { id: 'github_pat', pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { id: 'aws_access_key', pattern: /AKIA[A-Z0-9]{16}/ },
  { id: 'pem_private_key', pattern: /-----BEGIN [^-]*PRIVATE KEY/ },
  { id: 'slack_token', pattern: /xox[baprs]-[A-Za-z0-9-]+/ },
]);

const PROMPT_FIELDS = Object.freeze(['prompt', 'message', 'content', 'text']);

const DENY_USER_MESSAGE =
  'Your prompt was blocked because a possible secret pattern was detected. Remove credentials and try again.';
const DENY_AGENT_MESSAGE =
  'Prompt denied: possible secret pattern detected. Do not repeat or quote the blocked value.';

/**
 * @param {string} text
 * @returns {{ permission: 'allow' } | { permission: 'deny', reason: string }}
 */
export function evaluatePrompt(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { permission: 'allow' };
  }

  for (const { id, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      return { permission: 'deny', reason: id };
    }
  }

  return { permission: 'allow' };
}

/**
 * @param {unknown} payload
 * @returns {{ permission: 'allow' } | { permission: 'deny', reason: string, user_message: string, agent_message: string }}
 */
export function handlePayload(payload) {
  if (payload == null || typeof payload !== 'object') {
    return denyWithReason('invalid_payload');
  }

  const text = extractPromptText(/** @type {Record<string, unknown>} */ (payload));
  if (text === null) {
    return denyWithReason('missing_prompt_field');
  }

  const decision = evaluatePrompt(text);
  if (decision.permission === 'allow') {
    return { permission: 'allow' };
  }

  return {
    permission: 'deny',
    reason: decision.reason,
    user_message: DENY_USER_MESSAGE,
    agent_message: DENY_AGENT_MESSAGE,
  };
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string | null}
 */
function extractPromptText(payload) {
  for (const field of PROMPT_FIELDS) {
    const value = payload[field];
    if (typeof value === 'string') {
      return value;
    }
  }
  return null;
}

/**
 * @param {string} reason
 */
function denyWithReason(reason) {
  return {
    permission: 'deny',
    reason,
    user_message:
      reason === 'invalid_payload' || reason === 'invalid_json'
        ? 'Your prompt could not be validated (invalid hook payload). Try again or check Cursor hook configuration.'
        : DENY_USER_MESSAGE,
    agent_message:
      reason === 'invalid_payload' || reason === 'invalid_json'
        ? 'Prompt denied: hook payload could not be parsed. Fail-closed.'
        : DENY_AGENT_MESSAGE,
  };
}

/**
 * @param {string} raw
 */
export function handleStdin(raw) {
  let payload;
  try {
    const trimmed = raw.trim();
    if (!trimmed) {
      return denyWithReason('invalid_payload');
    }
    payload = JSON.parse(trimmed);
  } catch {
    return denyWithReason('invalid_json');
  }
  return handlePayload(payload);
}

/**
 * Cursor beforeSubmitPrompt stdout shape.
 * @param {ReturnType<typeof handleStdin>} result
 */
export function formatPromptHookResponse(result) {
  return toPromptHookOutput(result);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const raw = readHookStdin();
    const result = handleStdin(raw);
    emitPromptDecision(formatPromptHookResponse(result));
  } catch {
    emitPromptDecision(
      toPromptHookOutput(denyWithReason('hook_error')),
    );
  }
  process.exit(0);
}
