#!/usr/bin/env node
// render-adapters.mjs — Midas adapter renderer (dependency-free, Node ESM).
//
// Single source of truth: harness/conventions.md (+ harness/rules/context7-usage.md).
// This script (re)writes the three generated tool adapters from that source:
//   - CLAUDE.md                 -> keeps content outside markers; managed block holds the Midas note.
//                                  Guarantees an `@AGENTS.md` import sits above the managed block.
//   - .cursor/rules/00-midas.mdc -> Cursor frontmatter FIRST (file head), then a managed body.
//   - .windsurf/rules/00-midas.md-> Windsurf frontmatter FIRST (file head), then a managed body.
//
// Frontmatter must be at the very top of .mdc / windsurf rule files or the tool won't parse it,
// so for those two the managed markers wrap only the BODY, never the frontmatter.
//
// It also writes a content hash to .harness/adapters.hash so /midas-doctor can detect drift.
// No npm dependencies: only node:fs and node:path. Runs on Windows: `node scripts/render-adapters.mjs`.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Repo root = parent of this script's directory (scripts/..). Resolved from the script URL so the
// script works regardless of the current working directory. The regex strips the leading slash
// that Node puts before a Windows drive letter in a file:// pathname (/C:/... -> C:/...).
const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = resolve(SCRIPT_DIR, '..');

// Managed-marker fences. Anything between BEGIN and END is owned by this renderer.
const BEGIN = '<!-- midas:begin GENERATED — edit harness/conventions.md, run midas-doctor -->';
const END = '<!-- midas:end -->';

// --- small helpers -----------------------------------------------------------------------------

/** Read a repo-relative file, or return '' if it is missing (robustness for partial repos). */
function readMaybe(relPath) {
  const abs = join(ROOT, relPath);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : '';
}

/** Read an absolute file or '' (used so we only rewrite when content actually changes). */
function readExisting(absFile) {
  return existsSync(absFile) ? readFileSync(absFile, 'utf8') : '';
}

/** djb2 string hash -> 8-char hex. Cheap, stable, dependency-free content fingerprint. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; // h * 33 + c, kept unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0');
}

/** Ensure the parent directory of an absolute file path exists. */
function ensureDir(absFile) {
  const dir = dirname(absFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Replace the managed block in `existing`. If markers are present, swap their contents in place
 * (preserving everything outside). If absent, append a fresh managed block. `existing` may be ''.
 */
function spliceManaged(existing, innerBody) {
  const block = `${BEGIN}\n${innerBody}\n${END}`;
  const b = existing.indexOf(BEGIN);
  const e = existing.indexOf(END);
  if (b !== -1 && e !== -1 && e > b) {
    const before = existing.slice(0, b);
    const after = existing.slice(e + END.length);
    return `${before}${block}${after}`;
  }
  if (existing.trim() === '') return `${block}\n`;
  // Markers missing but file has content: append the block, leaving prior content untouched.
  return `${existing.replace(/\s*$/, '')}\n\n${block}\n`;
}

// --- render logic (exported so doctor.mjs can re-derive without duplication) --------------------

/**
 * Compute the full intended content for every adapter from the single source.
 * Returns { root, hash, files: [{ path, abs, content }] } — deterministic given the on-disk source
 * (CLAUDE.md also reads its own existing outside-marker content, which is preserved).
 */
export function computeAdapters(root = ROOT) {
  const conventions = readMaybe('harness/conventions.md');
  const context7 = readMaybe('harness/rules/context7-usage.md');

  const hash = djb2(conventions + ' ' + context7);
  const conventionsBody = conventions.trim();
  const context7Body = context7.trim() || 'See `harness/rules/context7-usage.md`.';

  // --- CLAUDE.md: managed block holds ONLY the Midas note (no @AGENTS.md — that import lives
  //     above the markers so it is never duplicated). Guarantee the import exists.
  const claudeInner = [
    '## Midas (generated — edit harness/conventions.md, run midas-doctor)',
    '- Source of truth: `harness/`, `.claude/skills/`, `AGENTS.md`. This block is rendered by',
    '  `scripts/render-adapters.mjs`; do not hand-edit between the midas markers.',
    '- Follow `harness/conventions.md` and the always-on rules in `harness/rules/`.',
    '- Before any third-party code, fetch its current docs for the in-use version (Context7 recommended,',
    '  or your own doc tool); see `harness/rules/context7-usage.md`. Never code third-party APIs from memory.',
  ].join('\n');
  const claudeAbs = join(root, 'CLAUDE.md');
  let claudeContent = spliceManaged(readExisting(claudeAbs), claudeInner);
  if (!/(^|\n)@AGENTS\.md(\r?\n|$)/.test(claudeContent)) {
    claudeContent = `# Project memory\n\n@AGENTS.md\n\n${claudeContent}`;
  }

  // --- Shared generated body for Cursor + Windsurf (markers wrap the BODY only) -----------------
  const sharedBody = [
    BEGIN,
    '> Generated by Midas from `harness/conventions.md`. Do not hand-edit — run `/midas-doctor`',
    '> (or `node scripts/render-adapters.mjs`) to re-render.',
    '',
    conventionsBody,
    '',
    '## Fetch current docs before third-party code (Context7 recommended)',
    context7Body,
    END,
    '',
  ].join('\n');

  // --- .cursor/rules/00-midas.mdc: frontmatter FIRST, then managed body -------------------------
  const cursorContent =
    '---\n' +
    'description: Midas base conventions (always-on project law). Generated from harness/conventions.md.\n' +
    'globs:\n' +
    'alwaysApply: true\n' +
    '---\n\n' +
    sharedBody;
  const cursorAbs = join(root, '.cursor', 'rules', '00-midas.mdc');

  // --- .windsurf/rules/00-midas.md: frontmatter FIRST, then managed body ------------------------
  const windsurfContent =
    '---\n' +
    'trigger: always_on\n' +
    '---\n\n' +
    sharedBody;
  const windsurfAbs = join(root, '.windsurf', 'rules', '00-midas.md');

  // --- GEMINI.md: Gemini CLI reads this file as project memory (inlined, no frontmatter) --------
  const geminiContent = '# Project memory — Midas (Gemini CLI)\n\n' + sharedBody;
  const geminiAbs = join(root, 'GEMINI.md');

  return {
    root,
    hash,
    files: [
      { path: 'CLAUDE.md', abs: claudeAbs, content: claudeContent },
      { path: '.cursor/rules/00-midas.mdc', abs: cursorAbs, content: cursorContent },
      { path: '.windsurf/rules/00-midas.md', abs: windsurfAbs, content: windsurfContent },
      { path: 'GEMINI.md', abs: geminiAbs, content: geminiContent },
    ],
  };
}

/**
 * Write all adapters + the hash file. Returns { hash, results } where each result is
 * { path, status: 'written' | 'unchanged' }. Pure side-effect wrapper around computeAdapters so
 * doctor.mjs --fix can reuse it.
 */
export function renderAdapters(root = ROOT) {
  const { hash, files } = computeAdapters(root);
  const results = [];

  for (const f of files) {
    const before = readExisting(f.abs);
    if (before === f.content) {
      results.push({ path: f.path, status: 'unchanged' });
      continue;
    }
    ensureDir(f.abs);
    writeFileSync(f.abs, f.content, 'utf8');
    results.push({ path: f.path, status: 'written' });
  }

  const hashAbs = join(root, '.harness', 'adapters.hash');
  ensureDir(hashAbs);
  writeFileSync(hashAbs, hash + '\n', 'utf8');
  results.push({ path: '.harness/adapters.hash', status: 'written' });

  return { hash, results };
}

// --- CLI entry point ---------------------------------------------------------------------------
// Run only when executed directly (not when imported by doctor.mjs).
const invokedDirectly =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

if (invokedDirectly) {
  const { hash, results } = renderAdapters();
  console.log('midas render-adapters: rendered from harness/conventions.md');
  for (const r of results) {
    console.log(`  ${r.status === 'unchanged' ? 'unchanged' : 'wrote    '} ${r.path}`);
  }
  console.log(`  source hash: ${hash}`);
}
