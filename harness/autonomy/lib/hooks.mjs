import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Load fail-closed hook policy shipped with the autonomy capability. */
export function loadFailClosedHooks(root = join(HERE, '..')) {
  const path = join(root, 'hooks', 'fail-closed.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Evaluate a proposed tool/effect against fail-closed hooks.
 * @param {'builder'|'auditor'} role
 */
export function evaluateHook(role, { effect, path, command, env }, hooks) {
  const policy = hooks?.[role];
  if (!policy) return { allow: false, reason: 'unknown_role' };

  if (role === 'auditor') {
    if (policy.deny_filesystem_write && (effect === 'fs.write' || effect === 'git.commit' || effect === 'git.push')) {
      return { allow: false, reason: 'auditor_write_denied' };
    }
    if (policy.deny_shell_mutating && effect === 'shell.exec') {
      const cmd = String(command || '');
      const ok = (policy.allowed_shell_prefixes || []).some((p) => cmd === p || cmd.startsWith(`${p} `));
      if (!ok) return { allow: false, reason: 'auditor_shell_denied' };
    }
    if (policy.forbid_scm_token_env) {
      for (const k of policy.forbid_scm_token_env) {
        if (env?.[k]) return { allow: false, reason: `auditor_forbidden_env:${k}` };
      }
    }
    return { allow: true, reason: 'ok' };
  }

  // builder
  if ((policy.deny_effects || []).includes(effect)) {
    return { allow: false, reason: `hook_deny_effect:${effect}` };
  }
  if (effect === 'shell.exec') {
    const cmd = String(command || '');
    const ok = (policy.shell_allowlist_prefixes || []).some((p) => cmd === p || cmd.startsWith(`${p} `));
    if (!ok) return { allow: false, reason: 'hook_shell_denied' };
  }
  if (effect === 'fs.write' && path) {
    const norm = String(path).replace(/\\/g, '/');
    for (const glob of policy.deny_path_globs || []) {
      if (globEndsMatch(norm, glob)) return { allow: false, reason: 'hook_path_denied' };
    }
  }
  if (effect === 'git.push') {
    const branch = String(path || command || '');
    if (policy.deny_default_branch_push && (branch === 'main' || branch === 'master')) {
      return { allow: false, reason: 'hook_default_branch' };
    }
  }
  if (env) {
    for (const k of policy.deny_env_inheritance || []) {
      if (env[k]) return { allow: false, reason: `hook_env_leak:${k}` };
    }
  }
  return { allow: true, reason: 'ok' };
}

function globEndsMatch(path, glob) {
  // Minimal: exact, prefix**, or **/name
  if (glob.endsWith('/**')) {
    const prefix = glob.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  if (glob.startsWith('**/')) {
    const suf = glob.slice(3);
    return path === suf || path.endsWith(`/${suf}`);
  }
  return path === glob || path.endsWith(`/${glob}`);
}
