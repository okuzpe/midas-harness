import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { walkTemplate } from '../walk-template.mjs';
import { INSTALL_OUTCOMES } from '../../runtime/outcomes.mjs';

describe('walkTemplate', () => {
  it('visits files and skips .optional', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-walk-tpl-'));
    try {
      mkdirSync(join(root, 'src', 'a'), { recursive: true });
      mkdirSync(join(root, 'src', '.optional'), { recursive: true });
      writeFileSync(join(root, 'src', 'a', 'f.md'), 'x');
      writeFileSync(join(root, 'src', '.optional', 'skip.md'), 'y');
      const files = [];
      walkTemplate(join(root, 'src'), join(root, 'dst'), { target: join(root, 'dst') }, (n) => {
        if (n.type === 'file') files.push(n.rel);
      });
      assert.deepEqual(files, ['a/f.md']);
      assert.equal(existsSync(join(root, 'src', '.optional', 'skip.md')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('skips host discovery mirrors but still visits CLAUDE.md and cursor rules', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-walk-host-'));
    try {
      mkdirSync(join(root, 'src', '.claude', 'skills', 'demo'), { recursive: true });
      mkdirSync(join(root, 'src', '.claude', 'agents'), { recursive: true });
      mkdirSync(join(root, 'src', '.agents', 'skills', 'demo'), { recursive: true });
      mkdirSync(join(root, 'src', '.cursor', 'skills', 'demo'), { recursive: true });
      mkdirSync(join(root, 'src', '.cursor', 'rules'), { recursive: true });
      writeFileSync(join(root, 'src', '.claude', 'skills', 'demo', 'SKILL.md'), 'skip');
      writeFileSync(join(root, 'src', '.claude', 'agents', 'scout.md'), 'skip');
      writeFileSync(join(root, 'src', '.claude', 'CLAUDE.md'), 'keep');
      writeFileSync(join(root, 'src', '.agents', 'skills', 'demo', 'SKILL.md'), 'skip');
      writeFileSync(join(root, 'src', '.cursor', 'skills', 'demo', 'SKILL.md'), 'skip');
      writeFileSync(join(root, 'src', '.cursor', 'rules', '00-midas.mdc'), 'keep');
      const files = [];
      walkTemplate(join(root, 'src'), join(root, 'dst'), { target: join(root, 'dst') }, (n) => {
        if (n.type === 'file') files.push(n.rel);
      });
      files.sort();
      assert.deepEqual(files, ['.claude/CLAUDE.md', '.cursor/rules/00-midas.mdc']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('INSTALL_OUTCOMES', () => {
  it('keeps documented exit codes', () => {
    assert.equal(INSTALL_OUTCOMES.LOCK_HELD, 2);
    assert.equal(INSTALL_OUTCOMES.INCOMPLETE, 3);
    assert.equal(INSTALL_OUTCOMES.ROLLED_BACK, 5);
    assert.equal(INSTALL_OUTCOMES.NEEDS_REPAIR, 6);
  });
});
