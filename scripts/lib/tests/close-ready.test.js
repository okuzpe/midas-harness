import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countDoneRowsMissingTool, evaluateCloseReady } from '../close-ready.mjs';
import { runCloseReady } from '../../close-ready.mjs';

function makeProject(suffix) {
  return mkdtempSync(join(tmpdir(), `midas-close-ready-${suffix}-`));
}

function writeState(root, yaml) {
  mkdirSync(join(root, '.harness'), { recursive: true });
  writeFileSync(join(root, '.harness', 'state.yaml'), yaml, 'utf8');
}

describe('countDoneRowsMissingTool', () => {
  it('flags Done rows without Tool', () => {
    const md = `# Progress

## Done

| Task | Proof | Tool |
|---|---|---|
| Ship API | tests pass | test-runner |
| Docs only | readme | |
`;
    assert.equal(countDoneRowsMissingTool(md), 1);
  });

  it('ignores header and other sections', () => {
    const md = `## Learned

| Item | Note |
|---|---|
| x | y |

## Done

| Task | Proof | Tool |
|---|---|---|
| All good | proof | eslint |
`;
    assert.equal(countDoneRowsMissingTool(md), 0);
  });
});

describe('evaluateCloseReady', () => {
  it('skips when no active sprint', () => {
    const root = makeProject('no-active');
    try {
      writeState(root, 'layout: harness\nsprints: []\n');
      const report = evaluateCloseReady(root);
      assert.equal(report.ok, true);
      assert.equal(report.sprint_id, null);
      assert.equal(report.checks[0].id, 'active-sprint');
      assert.equal(report.checks[0].status, 'skip');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('warns on missing progress and gate receipts for production diff', () => {
    const root = makeProject('warn');
    try {
      writeState(
        root,
        `layout: harness
sprints:
  - id: "03"
    status: active
`,
      );
      mkdirSync(join(root, '.harness', 'product', 'src'), { recursive: true });
      writeFileSync(join(root, '.harness', 'product', 'src', 'app.ts'), 'x', 'utf8');

      const report = evaluateCloseReady(root);
      assert.equal(report.sprint_id, '03');
      assert.equal(report.ok, false);
      const ids = report.checks.map((c) => c.id);
      assert.ok(ids.includes('progress-file'));
      assert.ok(ids.includes('gate-receipts'));
      const progress = report.checks.find((c) => c.id === 'progress-file');
      assert.equal(progress?.status, 'warn');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ok when progress and verify pass exist', () => {
    const root = makeProject('ok');
    try {
      writeState(
        root,
        `layout: harness
sprints:
  - id: "01"
    status: active
`,
      );
      mkdirSync(join(root, '.harness', 'runs', 'sprints'), { recursive: true });
      writeFileSync(
        join(root, '.harness', 'runs', 'sprints', '01-progress.md'),
        `## Done\n\n| Task | Proof | Tool |\n|---|---|---|\n| Task | ok | test-runner |\n`,
        'utf8',
      );
      mkdirSync(join(root, '.harness', 'runs', 'verifications'), { recursive: true });
      writeFileSync(
        join(root, '.harness', 'runs', 'verifications', 'verify-01.md'),
        'MIDAS_VERIFY_RESULT: fails=0 criticals=0 verdict=pass\n',
        'utf8',
      );

      const report = evaluateCloseReady(root);
      assert.equal(report.ok, true);
      assert.equal(report.checks.find((c) => c.id === 'verify-record')?.status, 'ok');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('runCloseReady CLI', () => {
  it('prints JSON and exits 0 when ready', () => {
    const root = makeProject('cli');
    const chunks = [];
    try {
      writeState(root, 'layout: harness\nsprints: []\n');
      const code = runCloseReady(['--json'], {
        projectRoot: root,
        stdout: { write: (s) => chunks.push(s) },
      });
      assert.equal(code, 0);
      const parsed = JSON.parse(chunks.join(''));
      assert.equal(parsed.ok, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
