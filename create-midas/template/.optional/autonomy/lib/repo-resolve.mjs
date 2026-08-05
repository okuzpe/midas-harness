import { spawnSync } from 'node:child_process';

/**
 * Parse owner/repo from common GitHub remote URLs.
 * @param {string} url
 * @returns {string|null}
 */
export function parseGitHubRepo(url) {
  if (!url) return null;
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Resolve autonomy repo id for authz validation.
 * @param {string} projectRoot
 * @param {{ repo?: string }} opts
 * @param {{ repo?: string }|null} [policy]
 */
export function resolveAutonomyRepo(projectRoot, opts = {}, policy = null) {
  if (opts.repo) return opts.repo;
  if (policy?.repo) return policy.repo;
  const env = process.env.MIDAS_AUTONOMY_REPO;
  if (env) return env;
  try {
    const r = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (r.status === 0) {
      const parsed = parseGitHubRepo(r.stdout.trim());
      if (parsed) return parsed;
    }
  } catch {
    // non-git sandboxes fall back
  }
  return 'local/project';
}
