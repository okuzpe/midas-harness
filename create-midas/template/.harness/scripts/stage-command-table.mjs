/**
 * Parse harness/stage-command-table.yaml — canonical stage → command + recall paths.
 * @module stage-command-table
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { resolvePaths, resolveProjectRootFromScript } from './paths.mjs';

const ROOT = resolveProjectRootFromScript(import.meta.url);

/** @typedef {{ command: string|null, commandWhenDone?: string|null, verifyUi?: string|null, qaAdhoc?: string|null, note?: string, recall: string[] }} StageEntry */

const STAGE_ROWS = [
  {
    name: 'idea_intake',
    command: '/idea-intake',
    recall: ['{product}/idea.md'],
  },
  {
    name: 'contextualize',
    command: '/contextualize',
    recall: ['{product}/idea.md', '{product}/open-questions.md'],
  },
  {
    name: 'market_research',
    command: '/market-research',
    note: 'Optional host deep-research skill or web/Context7 when absent — not shipped in Midas engine.',
    recall: ['{product}/idea.md', '{product}/market.md'],
  },
  {
    name: 'business_case',
    command: '/business-plan',
    note: 'Needs human sign-off.',
    recall: ['{product}/market.md', '{product}/business-plan.md'],
  },
  {
    name: 'tech_architecture',
    command: '/choose-architecture',
    recall: ['{product}/business-plan.md', '{product}/architecture.md', '{product}/adr'],
  },
  {
    name: 'architecture_rules',
    command: '/define-conventions',
    recall: ['{product}/architecture.md'],
  },
  {
    name: 'sprint_planning',
    command: '/plan-sprints',
    recall: ['{product}/roadmap.md', '{product}/business-plan.md'],
  },
  {
    name: 'sprint_execution',
    command: '/start-sprint',
    commandWhenDone: '/close-sprint',
    verifyUi: '/midas-verify',
    qaAdhoc: '/midas-qa',
    recall: ['{product}/features.json', '{runs}/verifications', '{runs}/sprints'],
  },
  {
    name: 'shipped',
    command: null,
    recall: [],
  },
];

function yamlScalar(value) {
  if (value === null) return 'null';
  if (/^[A-Za-z0-9_./-]+$/.test(value) && !value.includes('{') && !value.includes(' ')) return value;
  return JSON.stringify(value);
}

/**
 * Canonical YAML for the stage-command table.
 * @returns {string}
 */
export function computeStageCommandTableYaml() {
  const lines = [
    '# Canonical stage → command + recall paths (single source of truth).',
    '# Consumed by: scripts/stage-command-table.mjs, scripts/bundle.mjs (recall profile),',
    '# .claude/skills/midas-status, .claude/skills/midas-recall.',
    '# After edits: npm run align (copies to create-midas/template via build-create).',
    '',
    'stages:',
  ];
  for (const stage of STAGE_ROWS) {
    lines.push(`  ${stage.name}:`);
    lines.push(`    command: ${yamlScalar(stage.command)}`);
    if (stage.commandWhenDone !== undefined) lines.push(`    command_when_done: ${yamlScalar(stage.commandWhenDone)}`);
    if (stage.verifyUi !== undefined) lines.push(`    verify_ui: ${yamlScalar(stage.verifyUi)}`);
    if (stage.qaAdhoc !== undefined) lines.push(`    qa_adhoc: ${yamlScalar(stage.qaAdhoc)}`);
    if (stage.note !== undefined) lines.push(`    note: ${stage.note}`);
    lines.push('    recall:');
    for (const item of stage.recall) {
      lines.push(`      - ${yamlScalar(item)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

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
  const unquote = (value) => {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  };
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
      const val = unquote(cmd[2]);
      const parsed = val === 'null' ? null : val;
      if (cmd[1] === '_when_done') stages[current].commandWhenDone = parsed;
      else stages[current].command = parsed;
      inRecall = false;
      continue;
    }
    const verify = line.match(/^    verify_ui: (.+)$/);
    if (verify) {
      stages[current].verifyUi = unquote(verify[1]);
      inRecall = false;
      continue;
    }
    const qa = line.match(/^    qa_adhoc: (.+)$/);
    if (qa) {
      stages[current].qaAdhoc = unquote(qa[1]);
      inRecall = false;
      continue;
    }
    const note = line.match(/^    note: (.+)$/);
    if (note) {
      stages[current].note = unquote(note[1]);
      inRecall = false;
      continue;
    }
    if (line.match(/^    recall:$/)) {
      inRecall = true;
      continue;
    }
    const recallItem = line.match(/^      - (.+)$/);
    if (inRecall && recallItem) {
      stages[current].recall.push(unquote(recallItem[1]));
    }
  }
  return { stages };
}

/**
 * @param {string} [root]
 * @returns {{ stages: Record<string, StageEntry> }}
 */
export function loadStageCommandTable(root = ROOT) {
  const path = join(root, resolvePaths(root).engine, 'stage-command-table.yaml');
  if (!existsSync(path)) throw new Error(`missing ${path}`);
  return parseStageTableYaml(readFileSync(path, 'utf8'));
}

/**
 * Render the canonical stage-command table into harness/stage-command-table.yaml.
 * @param {string} [root]
 * @returns {{ path: string, status: 'written' | 'unchanged' }}
 */
export function renderStageCommandTable(root = ROOT) {
  const path = join(root, resolvePaths(root).engine, 'stage-command-table.yaml');
  const content = computeStageCommandTableYaml();
  const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (before === content) return { path: 'harness/stage-command-table.yaml', status: 'unchanged' };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  return { path: 'harness/stage-command-table.yaml', status: 'written' };
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
 * Always-on engine rules — derived from the active engine rules directory.
 * @param {string} [root]
 * @returns {Set<string>}
 */
export function loadEngineBaseRules(root = ROOT) {
  const rulesDir = join(root, resolvePaths(root).engine, 'rules');
  if (!existsSync(rulesDir)) return new Set();
  return new Set(
    readdirSync(rulesDir).filter((f) => f.endsWith('.md') && !f.startsWith('_')),
  );
}
