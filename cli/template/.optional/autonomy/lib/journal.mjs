import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sha256Hex } from './digest.mjs';

export function journalPath(projectRoot, rel = '.harness/runs/autonomy/journal.jsonl') {
  return join(projectRoot, rel);
}

export function readJournal(projectRoot, rel) {
  const path = journalPath(projectRoot, rel);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * Append a journal entry with monotonic seq + hash chain.
 * Batch signing key is held outside the producer process (env MIDAS_AUTONOMY_JOURNAL_KEY);
 * without it, entries are still chained but unsigned (tests / dry-run).
 */
export function appendJournal(projectRoot, entry, { rel, signKey } = {}) {
  const path = journalPath(projectRoot, rel);
  mkdirSync(dirname(path), { recursive: true });
  const prev = readJournal(projectRoot, rel);
  const last = prev[prev.length - 1] || null;
  const seq = last ? last.seq + 1 : 1;
  const prevHash = last ? last.entry_hash : 'genesis';
  const body = {
    seq,
    prev_hash: prevHash,
    at: new Date().toISOString(),
    actor: entry.actor || 'controller',
    ...entry,
  };
  delete body.entry_hash;
  delete body.batch_mac;
  const entry_hash = sha256Hex(JSON.stringify(body));
  const record = { ...body, entry_hash };
  const key = signKey || process.env.MIDAS_AUTONOMY_JOURNAL_KEY || '';
  if (key) {
    record.batch_mac = sha256Hex(`${key}:${entry_hash}:${seq}`);
  }
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/** Verify chain integrity; detect truncate / reorder / rewrite. */
export function verifyJournal(projectRoot, rel, { signKey, expectMinCount } = {}) {
  const entries = readJournal(projectRoot, rel);
  const findings = [];
  let prevHash = 'genesis';
  let expectSeq = 1;
  const key = signKey || process.env.MIDAS_AUTONOMY_JOURNAL_KEY || '';

  const anchorPath = join(projectRoot, '.harness', 'autonomy', 'journal-anchor.json');
  if (existsSync(anchorPath)) {
    try {
      const anchor = JSON.parse(readFileSync(anchorPath, 'utf8'));
      if (typeof anchor.count === 'number' && entries.length < anchor.count) {
        findings.push({ kind: 'truncate', count: entries.length, expected_min: anchor.count });
      }
    } catch {
      findings.push({ kind: 'anchor_unreadable' });
    }
  }
  if (typeof expectMinCount === 'number' && entries.length < expectMinCount) {
    findings.push({ kind: 'truncate', count: entries.length, expected_min: expectMinCount });
  }

  for (const entry of entries) {
    if (entry.seq !== expectSeq) {
      findings.push({ kind: 'reorder_or_gap', seq: entry.seq, expectSeq });
    }
    if (entry.prev_hash !== prevHash) {
      findings.push({ kind: 'chain_break', seq: entry.seq, prev_hash: entry.prev_hash, expected: prevHash });
    }
    const entry_hash = entry.entry_hash;
    const batch_mac = entry.batch_mac;
    const canonical = { ...entry };
    delete canonical.entry_hash;
    delete canonical.batch_mac;
    const expectedHash = sha256Hex(JSON.stringify(canonical));
    if (entry_hash !== expectedHash) {
      findings.push({ kind: 'rewrite', seq: entry.seq });
    }
    if (key && batch_mac && batch_mac !== sha256Hex(`${key}:${entry_hash}:${entry.seq}`)) {
      findings.push({ kind: 'mac_mismatch', seq: entry.seq });
    }
    prevHash = entry_hash;
    expectSeq = entry.seq + 1;
  }
  return { ok: findings.length === 0, findings, count: entries.length, tip_hash: prevHash === 'genesis' ? null : prevHash };
}

/** Anchor tip hash + counter into control-ref style file for resume gates. */
export function writeJournalAnchor(projectRoot, tip) {
  const path = join(projectRoot, '.harness', 'autonomy', 'journal-anchor.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...tip, at: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}
