/**
 * Stage → command + recall paths.
 *
 * **Authoring SoT:** `STAGE_ROWS` in this file. Edit rows here, then run
 * `npm run doctor -- --fix` (or `npm run align`) to regenerate
 * `harness/stage-command-table.yaml`.
 *
 * **Runtime SoT (on disk):** the committed YAML under `<paths.engine>/` —
 * skills and bundle recall *read* that file; do not hand-edit the YAML.
 *
 * @module stage-command-table
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { resolvePaths, resolveProjectRootFromScript } from './paths.mjs';
import { parseStageCommandTableYaml } from './yaml-lite.mjs';

const ROOT = resolveProjectRootFromScript(import.meta.url);

/** @typedef {{ command: string|null, commandWhenDone?: string|null, verifyUi?: string|null, redesignUi?: string|null, qaInternal?: string|null, note?: string, recall: string[] }} StageEntry */

/** Front-loaded stages Lite overlays — Next is not STAGE_ROWS.command. */
export const LITE_FRONT_STAGES = [
  'idea_intake',
  'contextualize',
  'market_research',
  'business_case',
  'tech_architecture',
  'architecture_rules',
];

/** Commands Lite must never emit as Next (status, recall, init Exit). */
export const LITE_FORBIDDEN_NEXT = ['/market-research', '/business-plan'];

/** Authoring source of truth — regenerate YAML via doctor --fix / align. */
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
    recall: ['{product}/architecture.md', '{product}/design-direction.md', '{product}/design-system.md'],
  },
  {
    name: 'sprint_planning',
    command: '/plan-sprints',
    recall: ['{product}/roadmap.md', '{product}/business-plan.md', '{product}/design-direction.md'],
  },
  {
    name: 'sprint_execution',
    command: '/start-sprint',
    commandWhenDone: '/close-sprint',
    verifyUi: '/midas-verify',
    redesignUi: '/midas-design',
    // Internal surface (ADR-013) — path-pass only; never the sole Next slash.
    qaInternal: 'skills/midas-qa/SKILL.md',
    recall: [
      '{product}/features.json',
      '{product}/design-direction.md',
      '{runs}/verifications',
      '{runs}/design',
      '{runs}/sprints',
    ],
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
 * Generated YAML for the stage-command table (committed artifact; not authoring SoT).
 * @returns {string}
 */
export function computeStageCommandTableYaml() {
  const lines = [
    '# GENERATED — do not hand-edit. Authoring SoT: STAGE_ROWS in scripts/stage-command-table.mjs',
    '# Runtime consumers read this file: midas-status, midas-recall, scripts/bundle.mjs (recall).',
    '# Regenerate: npm run doctor -- --fix  (or npm run align).',
    '',
    'stages:',
  ];
  for (const stage of STAGE_ROWS) {
    lines.push(`  ${stage.name}:`);
    lines.push(`    command: ${yamlScalar(stage.command)}`);
    if (stage.commandWhenDone !== undefined) lines.push(`    command_when_done: ${yamlScalar(stage.commandWhenDone)}`);
    if (stage.verifyUi !== undefined) lines.push(`    verify_ui: ${yamlScalar(stage.verifyUi)}`);
    if (stage.redesignUi !== undefined) lines.push(`    redesign_ui: ${yamlScalar(stage.redesignUi)}`);
    if (stage.qaInternal !== undefined) lines.push(`    qa_internal: ${yamlScalar(stage.qaInternal)}`);
    if (stage.note !== undefined) lines.push(`    note: ${stage.note}`);
    lines.push('    recall:');
    for (const item of stage.recall) {
      lines.push(`      - ${yamlScalar(item)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {string} [root]
 * @returns {{ stages: Record<string, StageEntry> }}
 */
export function loadStageCommandTable(root = ROOT) {
  const path = join(root, resolvePaths(root).engine, 'stage-command-table.yaml');
  if (!existsSync(path)) throw new Error(`missing ${path}`);
  return parseStageCommandTableYaml(readFileSync(path, 'utf8'));
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
 * Program-counter Next for `/midas-status` and `/midas-recall`.
 * Full track uses `STAGE_ROWS`. Lite overlays leftover front stages (not a second YAML table).
 * Skills follow the same rules in prose (`pipeline/lite.md`); this function is the testable SoT.
 *
 * @param {{ stage?: string, track?: string, setupComplete?: boolean, liteStubsReady?: boolean }} input
 * @returns {string|null}
 */
export function resolveStatusNext({
  stage,
  track = 'full',
  setupComplete = true,
  liteStubsReady = false,
} = {}) {
  if (!setupComplete) return '/midas-init';
  const row = STAGE_ROWS.find((s) => s.name === stage);
  const command = row ? row.command : null;
  if (track === 'lite') {
    if (LITE_FRONT_STAGES.includes(stage)) {
      return liteStubsReady ? '/plan-sprints' : '/midas-init';
    }
    if (command && LITE_FORBIDDEN_NEXT.includes(command)) {
      return liteStubsReady ? '/plan-sprints' : '/midas-init';
    }
    return command;
  }
  return command;
}

/**
 * Recall paths for bundle `recall` profile (canonical classic coordinates).
 * `{product}/` tokens map to `product/` canonical; `{runs}/` entries are excluded (handled in bundle).
 * @param {string} stage
 * @param {string} [root]
 * @param {{ track?: string }} [opts]
 * @returns {string[]}
 */
export function stageRecallPaths(stage, root = ROOT, opts = {}) {
  const { stages } = loadStageCommandTable(root);
  const track = opts.track || 'full';
  return (stages[stage]?.recall ?? [])
    .filter((p) => !p.startsWith('{runs}'))
    .map((p) => (p.startsWith('{product}/') ? `product/${p.slice('{product}/'.length)}` : p))
    .filter((p) => track !== 'lite' || !/(^|\/)market\.md$/.test(p));
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
