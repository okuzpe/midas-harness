/**
 * Parse harness/stage-command-table.yaml — canonical stage → command + recall paths.
 * @module stage-command-table
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** @typedef {{ command: string|null, commandWhenDone?: string|null, verifyUi?: string|null, note?: string, recall: string[] }} StageEntry */

/**
 * Minimal YAML parser for our flat stage-command-table shape (no external deps).
 * @param {string} text
 * @returns {{ stages: Record<string, StageEntry> }}
 */
function parseStageTableYaml(text) {
  /** @type {Record<string, StageEntry>} */
  const stages = {};
  let current = null;
  let inRecall = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const stageMatch = line.match(/^  (\w+):$/);
    if (stageMatch) {
      current = stageMatch[1];
      stages[current] = { command: null, recall: [] };
      inRecall = false;
      continue;
    }
    if (!current) continue;
    const cmd = line.match(/^    command(_when_done)?: (.+)$/);
    if (cmd) {
      const val = cmd[2].trim();
      const parsed = val === 'null' ? null : val;
      if (cmd[1] === '_when_done') stages[current].commandWhenDone = parsed;
      else stages[current].command = parsed;
      inRecall = false;
      continue;
    }
    const verify = line.match(/^    verify_ui: (.+)$/);
    if (verify) {
      stages[current].verifyUi = verify[1].trim();
      inRecall = false;
      continue;
    }
    const note = line.match(/^    note: (.+)$/);
    if (note) {
      stages[current].note = note[1].trim();
      inRecall = false;
      continue;
    }
    if (line.match(/^    recall:$/)) {
      inRecall = true;
      continue;
    }
    const recallItem = line.match(/^      - (.+)$/);
    if (inRecall && recallItem) {
      stages[current].recall.push(recallItem[1].trim());
    }
  }
  return { stages };
}

/**
 * @param {string} [root]
 * @returns {{ stages: Record<string, StageEntry> }}
 */
export function loadStageCommandTable(root = ROOT) {
  const path = join(root, 'harness', 'stage-command-table.yaml');
  if (!existsSync(path)) throw new Error(`missing ${path}`);
  return parseStageTableYaml(readFileSync(path, 'utf8'));
}

/**
 * Recall paths for bundle `recall` profile (canonical classic coordinates).
 * `{product}/` tokens map to `product/` canonical; `{runs}/` entries are excluded (handled in bundle).
 * @param {string} stage
 * @param {string} [root]
 * @returns {string[]}
 */
export function stageRecallPaths(stage, root = ROOT) {
  const { stages } = loadStageCommandTable(root);
  return (stages[stage]?.recall ?? [])
    .filter((p) => !p.startsWith('{runs}'))
    .map((p) => (p.startsWith('{product}/') ? `product/${p.slice('{product}/'.length)}` : p));
}

/**
 * Always-on engine rules — derived from template harness/rules/ (not hand-maintained).
 * @param {string} [root]
 * @returns {Set<string>}
 */
export function loadEngineBaseRules(root = ROOT) {
  const rulesDir = join(root, 'create-midas', 'template', 'harness', 'rules');
  if (!existsSync(rulesDir)) {
    const fallback = join(root, 'harness', 'rules');
    if (!existsSync(fallback)) return new Set();
    return new Set(
      readdirSync(fallback).filter((f) => f.endsWith('.md') && !f.startsWith('_')),
    );
  }
  return new Set(
    readdirSync(rulesDir).filter((f) => f.endsWith('.md') && !f.startsWith('_')),
  );
}
