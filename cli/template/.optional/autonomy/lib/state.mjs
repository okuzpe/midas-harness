import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const AUTONOMY_STATUSES = [
  'idle',
  'running',
  'approval_pending',
  'paused_budget',
  'paused_quota',
  'blocked_unknown_limit',
  'blocked',
  'completed',
];

export function defaultAutonomyPointers() {
  return {
    enabled: false,
    mode: 'disabled',
    status: 'idle',
    policy_digest: '',
    active_agent_id: null,
    active_run_id: null,
    active_sha: null,
    journal_path: '.harness/runs/autonomy/journal.jsonl',
    next_attempt_at: null,
  };
}

/** Parse autonomy: block from state.yaml text. Missing ⇒ defaults (disabled). */
export function parseAutonomyBlock(yaml) {
  const base = defaultAutonomyPointers();
  if (!yaml || !/^autonomy:\s*$/m.test(yaml)) return { ...base, present: false };

  const lines = yaml.split(/\r?\n/);
  let inBlock = false;
  for (const line of lines) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      inBlock = /^autonomy:\s*$/.test(line);
      continue;
    }
    if (!inBlock) continue;
    const m = line.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    const value = raw.trim().replace(/^["']|["']$/g, '');
    if (!(key in base)) continue;
    if (value === 'null' || value === '~' || value === '') base[key] = null;
    else if (value === 'true') base[key] = true;
    else if (value === 'false') base[key] = false;
    else base[key] = value;
  }
  return { ...base, present: true };
}

function formatScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/** Upsert autonomy: block; returns new yaml text. */
export function upsertAutonomyBlock(yaml, pointers) {
  const block = [
    'autonomy:',
    `  enabled: ${formatScalar(!!pointers.enabled)}`,
    `  mode: ${pointers.mode || 'disabled'}`,
    `  status: ${pointers.status || 'idle'}`,
    `  policy_digest: ${formatScalar(pointers.policy_digest || '')}`,
    `  active_agent_id: ${formatScalar(pointers.active_agent_id)}`,
    `  active_run_id: ${formatScalar(pointers.active_run_id)}`,
    `  active_sha: ${formatScalar(pointers.active_sha)}`,
    `  journal_path: ${pointers.journal_path || '.harness/runs/autonomy/journal.jsonl'}`,
    `  next_attempt_at: ${formatScalar(pointers.next_attempt_at)}`,
    '',
  ].join('\n');

  if (!/^autonomy:\s*$/m.test(yaml)) {
    const trimmed = yaml.endsWith('\n') ? yaml : `${yaml}\n`;
    return `${trimmed}\n${block}`;
  }

  const lines = yaml.split(/\r?\n/);
  const out = [];
  let inBlock = false;
  let replaced = false;
  for (const line of lines) {
    if (/^[A-Za-z_][\w-]*:/.test(line) && !/^\s/.test(line)) {
      if (/^autonomy:\s*$/.test(line)) {
        if (!replaced) {
          out.push(...block.trimEnd().split('\n'));
          replaced = true;
        }
        inBlock = true;
        continue;
      }
      inBlock = false;
    }
    if (inBlock) continue;
    out.push(line);
  }
  if (!replaced) out.push(...block.trimEnd().split('\n'));
  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}

export function resolveStatePath(projectRoot, stateRel = '.harness/state.yaml') {
  return join(projectRoot, stateRel);
}

export function readStateYaml(projectRoot, stateRel = '.harness/state.yaml') {
  const path = resolveStatePath(projectRoot, stateRel);
  if (!existsSync(path)) return { path, yaml: null, autonomy: { ...defaultAutonomyPointers(), present: false } };
  const yaml = readFileSync(path, 'utf8');
  return { path, yaml, autonomy: parseAutonomyBlock(yaml) };
}

/** Atomic write of state.yaml with updated autonomy pointers. */
export function writeAutonomyPointers(projectRoot, pointers, stateRel = '.harness/state.yaml') {
  const { path, yaml } = readStateYaml(projectRoot, stateRel);
  if (yaml == null) {
    throw new Error(`state.yaml missing at ${path}; refuse to create autonomy pointers without lifecycle state`);
  }
  const next = upsertAutonomyBlock(yaml, pointers);
  atomicWrite(path, next);
  return parseAutonomyBlock(next);
}

export function atomicWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, contents, 'utf8');
  renameSync(tmp, path);
}

/** Durable control record (CAS intent before remote effects). */
export function controlPath(projectRoot) {
  return join(projectRoot, '.harness', 'autonomy', 'control.json');
}

export function readControl(projectRoot) {
  const path = controlPath(projectRoot);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Compare-and-swap control.json.
 * @param {object|null} expected — null means file must be absent / empty
 * @param {object} next
 */
export function casControl(projectRoot, expected, next) {
  const path = controlPath(projectRoot);
  const current = readControl(projectRoot);
  const expectedToken = expected?.fencing_token ?? null;
  const currentToken = current?.fencing_token ?? null;
  if (expectedToken !== currentToken) {
    return { ok: false, current, reason: 'fencing_mismatch' };
  }
  const payload = {
    ...next,
    updated_at: new Date().toISOString(),
  };
  atomicWrite(path, `${JSON.stringify(payload, null, 2)}\n`);
  return { ok: true, current: payload };
}
