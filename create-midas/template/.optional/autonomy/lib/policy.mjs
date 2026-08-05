import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestText } from './digest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(HERE, '..');

const VALID_MODES = new Set(['disabled', 'bounded', 'custom', 'full']);
const P0_MODES = new Set(['disabled', 'bounded']);

const REQUIRED_BOUNDED_APPROVALS = [
  'merge',
  'deploy',
  'rule_amendment',
  'go_no_go',
  'shipped',
];

/** Load metapolicy (agent-inaccessible invariants). */
export function loadMetapolicy(root = PACKAGE_ROOT) {
  const path = join(root, 'metapolicy.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Minimal YAML scalar/list extractor for autonomy policy (no nested objects beyond one level).
 * Sufficient for policy.default.yaml shape.
 */
export function parsePolicyYaml(text) {
  const out = {
    mode: 'disabled',
    enabled: false,
    version: 1,
    action_allowlist: [],
    branch: { prefix: 'autonomy/', forbid_default_push: true },
    budget: {
      max_concurrent_runs: 1,
      max_runs_per_day: 20,
      max_cost_cents_reserve: 500,
      run_timeout_ms: 1_800_000,
    },
    commit_push_authz: { required: true },
    runner: { default: 'fake', orchestrate_model_required: true },
    approvals: {},
  };

  let section = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const top = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (top && !/^\s/.test(line)) {
      const [, key, rest] = top;
      section = key;
      if (key === 'mode') out.mode = rest.trim();
      else if (key === 'enabled') out.enabled = /^(true|yes|1)$/i.test(rest.trim());
      else if (key === 'version') out.version = Number(rest.trim()) || 1;
      else if (key === 'repo') out.repo = rest.trim().replace(/^["']|["']$/g, '');
      else if (key === 'action_allowlist') {
        if (rest.trim().startsWith('[')) {
          out.action_allowlist = rest
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
        } else out.action_allowlist = [];
      } else if (['branch', 'budget', 'commit_push_authz', 'runner', 'approvals'].includes(key)) {
        // nested section continues on indented lines
      } else {
        section = null;
      }
      continue;
    }
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && section === 'action_allowlist') {
      out.action_allowlist.push(listItem[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const nested = line.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!nested || !section) continue;
    const [, nkey, nrest] = nested;
    const value = nrest.trim();
    if (section === 'branch') {
      if (nkey === 'prefix') out.branch.prefix = value;
      if (nkey === 'forbid_default_push') out.branch.forbid_default_push = /^(true|yes|1)$/i.test(value);
    } else if (section === 'budget') {
      if (nkey in out.budget) out.budget[nkey] = Number(value);
    } else if (section === 'commit_push_authz') {
      if (nkey === 'required') out.commit_push_authz.required = /^(true|yes|1)$/i.test(value);
    } else if (section === 'runner') {
      if (nkey === 'default') out.runner.default = value;
      if (nkey === 'orchestrate_model_required') {
        out.runner.orchestrate_model_required = /^(true|yes|1)$/i.test(value);
      }
    } else if (section === 'approvals') {
      out.approvals[nkey] = value;
    }
  }
  return out;
}

export function validatePolicy(policy, { allowP1Modes = false } = {}) {
  const errors = [];
  if (!VALID_MODES.has(policy.mode)) errors.push(`invalid mode: ${policy.mode}`);
  if (!allowP1Modes && !P0_MODES.has(policy.mode)) {
    errors.push(`P0 forbids mode=${policy.mode}; only disabled|bounded are implemented`);
  }
  if (policy.enabled && policy.mode === 'disabled') {
    errors.push('enabled:true requires mode != disabled');
  }
  if (policy.mode === 'bounded') {
    for (const key of REQUIRED_BOUNDED_APPROVALS) {
      if (policy.approvals[key] !== 'required') {
        errors.push(
          `bounded mode cannot drop approval "${key}" (got ${policy.approvals[key] ?? 'missing'}); use explicit mode:full in P1`,
        );
      }
    }
  }
  if (policy.budget?.max_concurrent_runs !== 1 && policy.mode === 'bounded') {
    errors.push('bounded mode requires max_concurrent_runs: 1');
  }
  return errors;
}

export function policyPaths(projectRoot) {
  return {
    dir: join(projectRoot, '.harness', 'autonomy'),
    policy: join(projectRoot, '.harness', 'autonomy', 'policy.yaml'),
    defaultPolicy: join(PACKAGE_ROOT, 'policy.default.yaml'),
  };
}

/** Ensure policy.yaml exists (copy default if missing). Returns { policy, digest, path, errors }. */
export function loadProjectPolicy(projectRoot, opts = {}) {
  const paths = policyPaths(projectRoot);
  if (!existsSync(paths.policy)) {
    if (!opts.createIfMissing) {
      return {
        policy: parsePolicyYaml('mode: disabled\nenabled: false\n'),
        digest: '',
        path: paths.policy,
        missing: true,
        errors: [],
      };
    }
    mkdirSync(dirname(paths.policy), { recursive: true });
    copyFileSync(paths.defaultPolicy, paths.policy);
  }
  const text = readFileSync(paths.policy, 'utf8');
  const policy = parsePolicyYaml(text);
  const errors = validatePolicy(policy, opts);
  return {
    policy,
    digest: digestText(text),
    path: paths.policy,
    missing: false,
    errors,
    text,
  };
}

export function writePolicy(projectRoot, text) {
  const paths = policyPaths(projectRoot);
  mkdirSync(dirname(paths.policy), { recursive: true });
  writeFileSync(paths.policy, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  return digestText(text);
}

export { PACKAGE_ROOT, REQUIRED_BOUNDED_APPROVALS, P0_MODES, VALID_MODES };
