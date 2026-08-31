// spawn-failure.mjs — readable failure text from `node --test` spawnSync results.

/** Spec/TAP output routinely exceeds Node's 1MiB spawnSync default. */
export const UNIT_TEST_MAX_BUFFER = 16 * 1024 * 1024;

export const UNIT_TEST_SPAWN = Object.freeze({
  encoding: 'utf8',
  maxBuffer: UNIT_TEST_MAX_BUFFER,
});

/**
 * Prefer failing test names over the first bytes of spec output.
 *
 * @param {{ status?: number | null, error?: Error, stdout?: string, stderr?: string }} result
 * @param {{ max?: number }} [opts]
 * @returns {string}
 */
export function formatSpawnedTestFailure(result, opts = {}) {
  const max = opts.max ?? 4000;
  const parts = [];
  if (result.error) {
    const code = result.error.code ? `${result.error.code}: ` : '';
    parts.push(`${code}${result.error.message}`);
  }
  const text = `${result.stderr || ''}\n${result.stdout || ''}`;
  const failish = text.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    return (
      t.startsWith('not ok ') ||
      t.startsWith('# fail ') ||
      t.startsWith('✖') ||
      t.startsWith('✘') ||
      t.includes('AssertionError') ||
      t.includes('digest drifted') ||
      /\btests? failed\b/i.test(t)
    );
  });
  if (failish.length) parts.push(failish.slice(0, 40).join('\n'));
  else if (text.trim()) parts.push(text.trim().slice(-max));
  const out = parts.join('\n').trim();
  return out.slice(0, max) || `exit ${result.status}`;
}
