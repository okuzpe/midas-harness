import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECRET_PATTERNS,
  evaluatePrompt,
  formatPromptHookResponse,
  handlePayload,
  handleStdin,
} from '../secrets-prompt.mjs';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'secrets-prompt.mjs');

describe('secrets-prompt evaluatePrompt', () => {
  it('allows benign prompts', () => {
    assert.deepEqual(evaluatePrompt('help me refactor this module'), {
      permission: 'allow',
    });
    assert.deepEqual(evaluatePrompt(''), { permission: 'allow' });
  });

  it('denies OpenAI-style sk- keys', () => {
    const key = `sk-${'a'.repeat(20)}`;
    const result = evaluatePrompt(`use this key ${key} please`);
    assert.equal(result.permission, 'deny');
    assert.equal(result.reason, 'openai_api_key');
  });

  it('denies GitHub ghp_ tokens', () => {
    const token = `ghp_${'B'.repeat(24)}`;
    const result = evaluatePrompt(token);
    assert.equal(result.permission, 'deny');
    assert.equal(result.reason, 'github_pat');
  });

  it('denies AWS AKIA access keys', () => {
    const result = evaluatePrompt('AKIAIOSFODNN7EXAMPLE');
    assert.equal(result.permission, 'deny');
    assert.equal(result.reason, 'aws_access_key');
  });

  it('denies PEM private key headers', () => {
    const result = evaluatePrompt('-----BEGIN RSA PRIVATE KEY-----');
    assert.equal(result.permission, 'deny');
    assert.equal(result.reason, 'pem_private_key');
  });

  it('denies Slack xox* tokens', () => {
    for (const token of ['xoxb-123-456-abc', 'xoxp-abc', 'xoxa-token', 'xoxr-1', 'xoxs-9']) {
      const result = evaluatePrompt(`slack ${token}`);
      assert.equal(result.permission, 'deny', `expected deny for ${token}`);
      assert.equal(result.reason, 'slack_token');
    }
  });

  it('does not echo secret values in evaluatePrompt result', () => {
    const secret = `sk-${'z'.repeat(24)}`;
    const result = evaluatePrompt(secret);
    assert.equal(JSON.stringify(result).includes(secret), false);
  });
});

describe('secrets-prompt handlePayload', () => {
  it('reads prompt from prompt | message | content | text', () => {
    const secret = `ghp_${'c'.repeat(24)}`;
    for (const field of ['prompt', 'message', 'content', 'text']) {
      const result = handlePayload({ [field]: `token ${secret}` });
      assert.equal(result.permission, 'deny', field);
      assert.equal(result.reason, 'github_pat');
      assert.match(result.user_message, /possible secret pattern/i);
      assert.match(result.agent_message, /possible secret pattern/i);
      assert.equal(result.user_message.includes(secret), false);
    }
  });

  it('allows when a recognized field has safe text', () => {
    assert.deepEqual(handlePayload({ prompt: 'hello' }), { permission: 'allow' });
  });

  it('denies invalid payload (fail-closed)', () => {
    for (const payload of [null, undefined, 'string', 42]) {
      const result = handlePayload(payload);
      assert.equal(result.permission, 'deny');
      assert.equal(result.reason, 'invalid_payload');
    }
  });

  it('denies when no prompt field is a string', () => {
    const result = handlePayload({ prompt: 123 });
    assert.equal(result.permission, 'deny');
    assert.equal(result.reason, 'missing_prompt_field');
  });
});

describe('secrets-prompt handleStdin', () => {
  it('denies invalid JSON (fail-closed)', () => {
    const result = handleStdin('{not json');
    assert.equal(result.permission, 'deny');
    assert.equal(result.reason, 'invalid_json');
  });

  it('denies empty stdin', () => {
    const result = handleStdin('   ');
    assert.equal(result.permission, 'deny');
    assert.equal(result.reason, 'invalid_payload');
  });
});

describe('secrets-prompt formatPromptHookResponse', () => {
  it('maps allow to continue true (Cursor beforeSubmitPrompt contract)', () => {
    assert.deepEqual(formatPromptHookResponse({ permission: 'allow' }), { continue: true });
  });

  it('maps deny to continue false with user_message', () => {
    const out = formatPromptHookResponse({
      permission: 'deny',
      user_message: 'blocked',
    });
    assert.equal(out.continue, false);
    assert.equal(out.user_message, 'blocked');
    assert.equal('permission' in out, false);
  });
});

describe('secrets-prompt CLI', () => {
  it('exits 0 and emits continue true for safe prompt', () => {
    const r = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify({ prompt: 'safe text' }),
      encoding: 'utf8',
    });
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(r.stdout.trim()), { continue: true });
  });

  it('exits 0 and emits continue false for secret prompt', () => {
    const secret = `sk-${'d'.repeat(22)}`;
    const r = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify({ prompt: secret }),
      encoding: 'utf8',
    });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout.trim());
    assert.equal(out.continue, false);
    assert.ok(out.user_message);
    assert.equal(out.user_message.includes(secret), false);
    assert.equal('permission' in out, false);
  });
});

describe('secrets-prompt SECRET_PATTERNS', () => {
  it('documents a small fixed pattern set', () => {
    assert.equal(SECRET_PATTERNS.length, 5);
    const ids = SECRET_PATTERNS.map((p) => p.id);
    assert.deepEqual(ids, [
      'openai_api_key',
      'github_pat',
      'aws_access_key',
      'pem_private_key',
      'slack_token',
    ]);
  });
});
