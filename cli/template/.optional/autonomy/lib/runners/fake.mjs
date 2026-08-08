import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Deterministic fake runner for the full test suite — never consumes Cursor tokens.
 */
export async function runFake(action, ctx) {
  const {
    projectRoot,
    task,
    branch,
    policyDigest,
    fencingToken,
    scenario = process.env.MIDAS_AUTONOMY_FAKE_SCENARIO || 'success',
  } = ctx;

  if (scenario === 'crash_before_effect') {
    const err = new Error('fake crash before remote effect');
    err.code = 'FAKE_CRASH_BEFORE';
    throw err;
  }

  if (scenario === 'rate_limit_unknown') {
    const err = new Error('Rate limit exceeded');
    err.name = 'RateLimitError';
    err.isRetryable = false;
    throw err;
  }

  if (scenario === 'budget') {
    const err = new Error('Spend limit exceeded for this account');
    err.name = 'RateLimitError';
    throw err;
  }

  if (scenario === 'quota') {
    const err = new Error('Monthly usage limit exceeded');
    throw err;
  }

  if (scenario === 'needs_merge') {
    return {
      ok: false,
      task_status: 'approval_pending',
      reason: 'merge_required',
      commit_sha: null,
      agent_id: null,
      run_id: null,
      evidence_paths: [],
      usage: { input_tokens: 0, output_tokens: 0, charged_cents: 0 },
    };
  }

  const material = `${action.id}:${task.id}:${branch}:${policyDigest}:${fencingToken}`;
  const commit_sha = createHash('sha1').update(material).digest('hex');
  const agent_id = `fake-agent-${commit_sha.slice(0, 8)}`;
  const run_id = `fake-run-${commit_sha.slice(8, 16)}`;

  const evidenceDir = join(projectRoot, '.harness', 'runs', 'autonomy', 'evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, `${task.id}.md`);
  writeFileSync(
    evidencePath,
    `# Fake evidence\n\ntask: ${task.id}\nsha: ${commit_sha}\nbranch: ${branch}\n`,
    'utf8',
  );

  if (scenario === 'crash_after_effect') {
    return {
      ok: true,
      task_status: 'done',
      commit_sha,
      agent_id,
      run_id,
      evidence_paths: [evidencePath],
      usage: { input_tokens: 100, output_tokens: 50, charged_cents: 1 },
      _crash_after: true,
    };
  }

  return {
    ok: true,
    task_status: 'done',
    commit_sha,
    agent_id,
    run_id,
    evidence_paths: [evidencePath],
    usage: { input_tokens: 100, output_tokens: 50, charged_cents: 1 },
  };
}

export default { run: runFake };
