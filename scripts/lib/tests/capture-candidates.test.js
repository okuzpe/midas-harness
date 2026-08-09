import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CAPTURE_CANDIDATES,
  collectLearnedTexts,
  dedupeAndCapCandidates,
  findConventionCandidates,
  findPlaybookCandidates,
  findRepeatedStemRules,
  formatCaptureProposalMarkdown,
  proposeCaptureCandidates,
  stemWord,
  toCaptureSlug,
} from '../capture-candidates.mjs';
import { runCaptureCandidates } from '../../capture-candidates.mjs';

const SAMPLE_PROGRESS = `# Sprint progress — 01-auth

## Observations (What / Why / Where / Learned)

| Field | Content |
|---|---|
| **Learned** | Always validate JWT expiry before trusting claims |
| **Learned** | Never skip validation on auth middleware paths |

| What | Why | Where | Learned |
|---|---|---|---|
| Token check | missed edge case | src/auth.ts | Always validate JWT expiry on refresh |
| Middleware | repeat miss | src/mw.ts | Never skip validation on protected routes |

## Next

Ship auth fix.
`;

describe('capture-candidates', () => {
  it('stemWord is deterministic', () => {
    assert.equal(stemWord('validate'), 'valid');
    assert.equal(stemWord('auth'), 'auth');
  });

  it('toCaptureSlug produces kebab-case', () => {
    assert.equal(toCaptureSlug('Repeated validation theme'), 'repeated-validation-theme');
  });

  it('collectLearnedTexts reads Learned rows from progress markdown', () => {
    const rows = collectLearnedTexts(SAMPLE_PROGRESS);
    assert.ok(rows.length >= 2);
    assert.ok(rows.some((r) => /validate/i.test(r)));
  });

  it('findRepeatedStemRules proposes rule when stem appears in ≥2 lines', () => {
    const learned = collectLearnedTexts(SAMPLE_PROGRESS);
    const rules = findRepeatedStemRules(learned);
    assert.ok(rules.length >= 1);
    assert.equal(rules[0].kind, 'rule');
    assert.ok(rules[0].slug);
    assert.ok(rules[0].evidence);
  });

  it('findPlaybookCandidates matches procedure / when-then lines', () => {
    const text = 'When deploy fails then rollback staging before retrying production.';
    const hits = findPlaybookCandidates(text);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'playbook');
    assert.match(hits[0].rationale, /when deploy fails/i);
  });

  it('findConventionCandidates matches preference language', () => {
    const text = 'We should always pin dependency versions in package.json.';
    const hits = findConventionCandidates(text);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'convention');
    assert.match(hits[0].rationale, /always/i);
  });

  it('dedupeAndCapCandidates caps at MAX_CAPTURE_CANDIDATES', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      kind: 'rule',
      slug: `rule-${i}`,
      rationale: `rationale ${i}`,
      evidence: `evidence ${i}`,
    }));
    const capped = dedupeAndCapCandidates(many);
    assert.equal(capped.length, MAX_CAPTURE_CANDIDATES);
  });

  it('proposeCaptureCandidates merges heuristics without I/O', () => {
    const sprintText = 'Document playbook: rotate secrets quarterly.';
    const candidates = proposeCaptureCandidates({
      progressText: SAMPLE_PROGRESS,
      sprintText,
      learnedRows: [
        'Always validate JWT expiry before trusting claims',
        'Never skip validation on auth middleware paths',
      ],
    });
    assert.ok(candidates.some((c) => c.kind === 'rule'));
    assert.ok(candidates.some((c) => c.kind === 'playbook'));
    assert.ok(candidates.some((c) => c.kind === 'convention'));
    assert.ok(candidates.length <= MAX_CAPTURE_CANDIDATES);
  });

  it('formatCaptureProposalMarkdown prints empty message when no hits', () => {
    assert.equal(
      formatCaptureProposalMarkdown([]),
      'No capture candidates found.\n',
    );
  });

  it('formatCaptureProposalMarkdown uses Want me to capture phrasing', () => {
    const md = formatCaptureProposalMarkdown([
      {
        kind: 'rule',
        slug: 'sample-rule',
        rationale: 'Repeated correction theme',
        evidence: 'line one',
      },
    ]);
    assert.match(md, /Want me to capture this as a \*\*rule\*\*\?/);
  });

  it('runCaptureCandidates reads files and exits 0', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-capture-cli-'));
    try {
      const progressPath = join(root, '01-progress.md');
      const sprintPath = join(root, '01-sprint.md');
      writeFileSync(progressPath, SAMPLE_PROGRESS, 'utf8');
      writeFileSync(
        sprintPath,
        'When CI is red then fix tests before merge.\n',
        'utf8',
      );

      let out = '';
      const code = runCaptureCandidates(
        ['--progress', progressPath, '--sprint', sprintPath],
        { stdout: { write: (chunk) => { out += chunk; } } },
      );
      assert.equal(code, 0);
      assert.match(out, /Capture proposals/);
      assert.match(out, /Want me to capture/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runCaptureCandidates prints no-candidates message for empty input', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-capture-empty-'));
    try {
      const progressPath = join(root, 'empty.md');
      writeFileSync(progressPath, '# Progress\n\n## Next\n\nNothing yet.\n', 'utf8');

      let out = '';
      const code = runCaptureCandidates(['--progress', progressPath], {
        stdout: { write: (chunk) => { out += chunk; } },
      });
      assert.equal(code, 0);
      assert.equal(out, 'No capture candidates found.\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
