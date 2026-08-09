// capture-candidates.mjs — propose-only capture heuristics (F-031, ADR-012).

/** @typedef {'rule' | 'playbook' | 'convention'} CaptureKind */

/** @typedef {{
 *   kind: CaptureKind,
 *   slug: string,
 *   rationale: string,
 *   evidence: string,
 * }} CaptureCandidate */

export const MAX_CAPTURE_CANDIDATES = 10;

/** @type {ReadonlySet<string>} */
const STOP_WORDS = new Set([
  'about', 'after', 'also', 'been', 'before', 'being', 'both', 'each', 'from',
  'have', 'into', 'just', 'like', 'more', 'must', 'only', 'same', 'should',
  'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'under', 'very', 'were', 'what', 'when',
  'where', 'which', 'while', 'with', 'would', 'your',
]);

const PLAYBOOK_LINE_RE = /\b(playbook|procedure)\b|when\s+.+\s+then\s+/i;
const CONVENTION_LINE_RE = /\b(always|never|prefer(?:s|ed)?)\b/i;

/**
 * Deterministic stem: first five lowercase letters for words longer than four chars.
 * @param {string} word
 * @returns {string}
 */
export function stemWord(word) {
  const lower = word.toLowerCase();
  return lower.length > 4 ? lower.slice(0, 5) : lower;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function toCaptureSlug(text) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.slice(0, 64) || 'capture-candidate';
}

/**
 * @param {string} progressText
 * @returns {string[]}
 */
export function extractObservationLines(progressText) {
  const lines = [];
  const sectionMatch = progressText.match(
    /##\s+Observations[^\n]*\n([\s\S]*?)(?=\n##\s|\n*$)/i,
  );
  if (!sectionMatch) return lines;

  for (const raw of sectionMatch[1].split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('<!--')) continue;
    if (/^\|[-\s|]+\|$/.test(trimmed)) continue;
    if (/^\|?\s*field\s*\|/i.test(trimmed)) continue;
    if (/^\|?\s*what\s*\|/i.test(trimmed)) continue;
    lines.push(trimmed);
  }
  return lines;
}

/**
 * @param {string} progressText
 * @param {string[] | undefined} learnedRows
 * @returns {string[]}
 */
export function collectLearnedTexts(progressText, learnedRows) {
  if (Array.isArray(learnedRows) && learnedRows.length > 0) {
    return learnedRows.map((row) => String(row).trim()).filter(Boolean);
  }

  const texts = [];
  const learnedFieldRe = /\|\s*\*\*Learned\*\*\s*\|\s*([^|]+)\|/gi;
  let match = learnedFieldRe.exec(progressText);
  while (match) {
    const value = match[1].trim();
    if (value && !/^<!--/.test(value)) texts.push(value);
    match = learnedFieldRe.exec(progressText);
  }

  for (const line of extractObservationLines(progressText)) {
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 4) {
      const learned = cells[cells.length - 1];
      if (learned && !/^learned$/i.test(learned)) texts.push(learned);
    }
    const inlineLearned = line.match(/\*\*Learned\*\*\s*\|\s*([^|]+)/i);
    if (inlineLearned) texts.push(inlineLearned[1].trim());
  }

  return texts;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function tokenizeMeaningful(line) {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

/**
 * Repeated stem in ≥2 Learned/Observation lines → rule candidate.
 * @param {string[]} learnedTexts
 * @returns {CaptureCandidate[]}
 */
export function findRepeatedStemRules(learnedTexts) {
  /** @type {Map<string, { lines: Set<string>, sample: string }>} */
  const stemIndex = new Map();

  for (const line of learnedTexts) {
    const seenInLine = new Set();
    for (const word of tokenizeMeaningful(line)) {
      const stem = stemWord(word);
      if (seenInLine.has(stem)) continue;
      seenInLine.add(stem);
      const entry = stemIndex.get(stem) || { lines: new Set(), sample: word };
      entry.lines.add(line);
      stemIndex.set(stem, entry);
    }
  }

  const candidates = [];
  for (const [stem, { lines, sample }] of stemIndex) {
    if (lines.size < 2) continue;
    const evidence = [...lines].slice(0, 3).join(' · ');
    const rationale = `Repeated correction theme in Learned: ${sample}`;
    candidates.push({
      kind: 'rule',
      slug: toCaptureSlug(`repeated-${sample}-theme`),
      rationale,
      evidence,
    });
  }

  return candidates.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * @param {string} text
 * @returns {CaptureCandidate[]}
 */
export function findPlaybookCandidates(text) {
  const candidates = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('<!--')) continue;
    if (!PLAYBOOK_LINE_RE.test(line)) continue;

    const whenThen = line.match(/when\s+(.+?)\s+then\s+(.+)/i);
    const rationale = whenThen
      ? `Procedure: when ${whenThen[1].trim()} then ${whenThen[2].trim()}`
      : `Procedure or playbook step: ${line.replace(/^\|+|\|+$/g, '').trim()}`;

    candidates.push({
      kind: 'playbook',
      slug: toCaptureSlug(rationale),
      rationale,
      evidence: line,
    });
  }
  return candidates;
}

/**
 * @param {string} text
 * @returns {CaptureCandidate[]}
 */
export function findConventionCandidates(text) {
  const candidates = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('<!--')) continue;
    if (!CONVENTION_LINE_RE.test(line)) continue;

    const match = line.match(/\b(always|never|prefer(?:s|ed)?)\b[^|]*/i);
    const snippet = (match ? match[0] : line).trim();
    const rationale = `Team preference: ${snippet}`;

    candidates.push({
      kind: 'convention',
      slug: toCaptureSlug(rationale),
      rationale,
      evidence: line,
    });
  }
  return candidates;
}

/**
 * @param {CaptureCandidate[]} candidates
 * @returns {CaptureCandidate[]}
 */
export function dedupeAndCapCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
    if (out.length >= MAX_CAPTURE_CANDIDATES) break;
  }
  return out;
}

/**
 * Propose capture candidates from sprint progress + sprint file text.
 * Pure: no disk I/O.
 *
 * Heuristics (deterministic):
 * - Repeated correction stems in Learned / Observations (≥2 lines) → rule
 * - Lines matching playbook / procedure / when-then → playbook
 * - Preference language (always / never / prefer) → convention
 *
 * @param {{
 *   progressText?: string,
 *   sprintText?: string,
 *   learnedRows?: string[],
 * }} input
 * @returns {CaptureCandidate[]}
 */
export function proposeCaptureCandidates(input = {}) {
  const progressText = input.progressText || '';
  const sprintText = input.sprintText || '';
  const combined = `${progressText}\n${sprintText}`;
  const learnedTexts = collectLearnedTexts(progressText, input.learnedRows);

  const rules = findRepeatedStemRules(learnedTexts);
  const playbooks = findPlaybookCandidates(combined);
  const conventions = findConventionCandidates(combined);

  return dedupeAndCapCandidates([...rules, ...playbooks, ...conventions]);
}

/**
 * @param {CaptureCandidate[]} candidates
 * @returns {string}
 */
export function formatCaptureProposalMarkdown(candidates) {
  if (!candidates.length) {
    return 'No capture candidates found.\n';
  }

  const lines = ['## Capture proposals (recommend-only — nothing written)\n'];
  candidates.forEach((candidate, index) => {
    lines.push(
      `${index + 1}. **${candidate.kind}** \`${candidate.slug}\``,
      `   Want me to capture this as a **${candidate.kind}**? ${candidate.rationale}`,
      `   Evidence: ${candidate.evidence}`,
      '',
    );
  });
  return `${lines.join('\n')}\n`;
}
