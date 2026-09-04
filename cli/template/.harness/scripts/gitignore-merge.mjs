// gitignore-merge.mjs — append Midas .gitignore block (secrets, deps, volatile + product kit). Dependency-free.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from './paths.mjs';

export const GITIGNORE_BEGIN =
  '# midas:begin GITIGNORE — installed by create-midas; extend with your own patterns below';
export const GITIGNORE_END = '# midas:end';
export const GITIGNORE_KIT_BEGIN = '# midas:kit-begin';
export const GITIGNORE_KIT_END = '# midas:kit-end';

/** Substrings required by harness/rules/security.md CHECK on `.gitignore`. */
export const GITIGNORE_SECURITY_PATTERNS = ['.env', '*.pem', '*secret*', '*credential*'];

/** Paths `update` owns. If git still tracks them, doctor warns (`git rm --cached`). */
export const GITIGNORE_KIT_TRACKED_PREFIXES = Object.freeze([
  '.harness/engine/',
  '.harness/scripts/',
  '.harness/bin/',
  '.harness/manifest.json',
  '.harness/conflicts/',
  '.harness/autonomy/',
  '.harness/.windsurf/',
  '.claude/skills/',
  '.claude/agents/',
  '.claude/CLAUDE.md',
  '.cursor/skills/',
  '.cursor/rules/00-midas.mdc',
  '.cursor/rules/01-midas-checks.mdc',
  '.cursor/mcp.json',
  '.agents/skills/',
  'GEMINI.md',
  '.windsurf/rules/00-midas.md',
  '.windsurf/rules/01-midas-checks.md',
]);

const AUTONOMY_USER_TRACKED = new Set([
  '.harness/autonomy/policy.yaml',
  '.harness/autonomy/control.json',
  '.harness/autonomy/budget-ledger.json',
  '.harness/autonomy/journal-anchor.json',
]);

/** Patterns we add inside the Midas block (non-comment, non-empty lines from the snippet). */
export function snippetPatterns(snippet) {
  return snippet
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

/** True when this root is the Midas engine repo, not a product install. */
export function isEngineRepoRoot(root) {
  const statePath = join(root, 'harness', 'state.yaml');
  if (!existsSync(statePath)) return false;
  return /^role:\s*engine\b/m.test(readFileSync(statePath, 'utf8'));
}

/** True when `pat` appears as its own gitignore line (order-sensitive kit rules need this). */
export function gitignoreHasPattern(existing, pat) {
  return String(existing)
    .split(/\r?\n/)
    .some((line) => line.trim() === pat);
}

export function kitSectionFromSnippet(snippet) {
  const start = snippet.indexOf(GITIGNORE_KIT_BEGIN);
  const end = snippet.indexOf(GITIGNORE_KIT_END);
  if (start === -1 || end === -1 || end < start) return '';
  return snippet.slice(start, end + GITIGNORE_KIT_END.length).trim();
}

/** Drop the product-kit ignore block so the engine repo never gitignores its own skill mirrors. */
export function snippetForRoot(root, snippet) {
  if (!isEngineRepoRoot(root)) return snippet;
  const start = snippet.indexOf(GITIGNORE_KIT_BEGIN);
  const end = snippet.indexOf(GITIGNORE_KIT_END);
  if (start === -1 || end === -1 || end < start) return snippet;
  return `${snippet.slice(0, start)}${snippet.slice(end + GITIGNORE_KIT_END.length)}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Merge `harness/templates/gitignore-midas.snippet` into project-root `.gitignore`.
 * - No file / no Midas block → append full block.
 * - Midas block present → append any snippet patterns still missing (idempotent upgrade on --update).
 * @returns {{ wrote: boolean, upgraded: boolean }}
 */
export function ensureMidasGitignore(root) {
  const p = resolvePaths(root);
  const snippetPath = join(p.projectRoot, p.engine, 'templates', 'gitignore-midas.snippet');
  if (!existsSync(snippetPath)) return { wrote: false, upgraded: false };

  const rawSnippet = readFileSync(snippetPath, 'utf8').trim();
  const snippet = snippetForRoot(root, rawSnippet);
  const gitignorePath = join(root, '.gitignore');
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';

  if (!existing.includes(GITIGNORE_BEGIN)) {
    const block = `${GITIGNORE_BEGIN}\n${snippet}\n${GITIGNORE_END}\n`;
    const next =
      existing.trim() === '' ? block : `${existing.replace(/\s*$/, '')}\n\n${block}`;
    writeFileSync(gitignorePath, next, 'utf8');
    return { wrote: true, upgraded: false };
  }

  const endIdx = existing.indexOf(GITIGNORE_END);
  if (endIdx === -1) return { wrote: false, upgraded: false };

  // Kit rules are order-sensitive. If the product file has no kit marker, insert the whole
  // section before `# midas:end` instead of scattering missing lines (which would un-ignore
  // `.harness/runs/**` after an older `.harness/runs/explore/.active` and make it trackable).
  if (!isEngineRepoRoot(root) && !existing.includes(GITIGNORE_KIT_BEGIN)) {
    const kit = kitSectionFromSnippet(rawSnippet);
    if (kit) {
      const next = `${existing.slice(0, endIdx)}\n${kit}\n${existing.slice(endIdx)}`;
      writeFileSync(gitignorePath, next, 'utf8');
      return { wrote: true, upgraded: true };
    }
  }

  const missing = snippetPatterns(snippet).filter((p) => !gitignoreHasPattern(existing, p));
  if (!missing.length) return { wrote: false, upgraded: false };

  const insert = `\n# midas: amend — patterns added on install/update\n${missing.join('\n')}\n`;
  const next = `${existing.slice(0, endIdx)}${insert}${existing.slice(endIdx)}`;
  writeFileSync(gitignorePath, next, 'utf8');
  return { wrote: true, upgraded: true };
}

/**
 * Read-only audit — does not write `.gitignore`.
 * @param {string} root project root
 * @returns {{ status: 'ok'|'warn'|'skip', note: string, missing: string[], hasFile: boolean, hasBlock: boolean }}
 */
export function auditGitignore(root) {
  const p = resolvePaths(root);
  const snippetPath = join(p.projectRoot, p.engine, 'templates', 'gitignore-midas.snippet');
  const isMidasProject =
    existsSync(join(root, p.state)) || existsSync(join(root, p.engine, 'conventions.md'));
  if (!isMidasProject) {
    return { status: 'skip', note: 'not a Midas project', missing: [], hasFile: false, hasBlock: false };
  }
  if (!existsSync(snippetPath)) {
    const gitignorePath = join(root, '.gitignore');
    if (!existsSync(gitignorePath)) {
      return {
        status: 'warn',
        note: 'no .gitignore and engine snippet missing — run gitignore-merge.mjs after engine sync',
        missing: GITIGNORE_SECURITY_PATTERNS,
        hasFile: false,
        hasBlock: false,
      };
    }
    const existing = readFileSync(gitignorePath, 'utf8');
    const missing = GITIGNORE_SECURITY_PATTERNS.filter((pat) => !existing.includes(pat));
    if (!missing.length) {
      return {
        status: 'ok',
        note: 'security patterns present (.gitignore; engine snippet not on disk — partial example OK)',
        missing: [],
        hasFile: true,
        hasBlock: existing.includes(GITIGNORE_BEGIN),
      };
    }
    return {
      status: 'warn',
      note: `engine snippet missing; .gitignore missing security patterns: ${missing.join(', ')}`,
      missing,
      hasFile: true,
      hasBlock: existing.includes(GITIGNORE_BEGIN),
    };
  }

  const gitignorePath = join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    return {
      status: 'warn',
      note: 'no .gitignore — run gitignore-merge.mjs or doctor --fix (Phase 8 security CHECK will fail)',
      missing: GITIGNORE_SECURITY_PATTERNS,
      hasFile: false,
      hasBlock: false,
    };
  }

  const existing = readFileSync(gitignorePath, 'utf8');
  const hasBlock = existing.includes(GITIGNORE_BEGIN);
  const snippet = snippetForRoot(root, readFileSync(snippetPath, 'utf8'));
  const missingSnippet = snippetPatterns(snippet).filter((pat) => !gitignoreHasPattern(existing, pat));
  const missingSecurity = GITIGNORE_SECURITY_PATTERNS.filter((pat) => !existing.includes(pat));
  const missing = [...new Set([...missingSecurity, ...missingSnippet])];

  if (!hasBlock) {
    return {
      status: 'warn',
      note: missing.length
        ? `no Midas block; missing patterns: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''} — run doctor.mjs --fix`
        : 'no Midas block — run doctor.mjs --fix to append the managed block',
      missing,
      hasFile: true,
      hasBlock: false,
    };
  }
  if (missing.length) {
    return {
      status: 'warn',
      note: `missing patterns: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''} — run doctor.mjs --fix or --update`,
      missing,
      hasFile: true,
      hasBlock: true,
    };
  }
  return {
    status: 'ok',
    note: 'Midas block present; security + snippet patterns covered',
    missing: [],
    hasFile: true,
    hasBlock: true,
  };
}

/**
 * Warn when a product git repo still tracks vendor kit files that the snippet now ignores.
 * @param {string} root
 * @returns {{ status: 'ok'|'warn'|'skip', note: string, files: string[] }}
 */
export function auditTrackedKit(root) {
  if (isEngineRepoRoot(root)) {
    return { status: 'skip', note: 'engine repo — kit ignore is product-install only', files: [] };
  }
  const git = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (git.status !== 0) {
    return { status: 'skip', note: 'not a git repository', files: [] };
  }
  const ls = spawnSync(
    'git',
    ['-C', root, 'ls-files', '-z', '--', ...GITIGNORE_KIT_TRACKED_PREFIXES],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
  );
  const files = String(ls.stdout || '')
    .split('\0')
    .map((f) => f.replace(/\\/g, '/'))
    .filter(Boolean)
    .filter((f) => !AUTONOMY_USER_TRACKED.has(f) && !f.startsWith('.harness/autonomy/authz/'));
  if (!files.length) {
    return { status: 'ok', note: 'vendor kit is not tracked', files: [] };
  }
  return {
    status: 'warn',
    note:
      `${files.length} kit file(s) still tracked — git rm -r --cached .harness/engine .harness/scripts ` +
      '.harness/bin .claude/skills .claude/agents .cursor/skills .cursor/rules/00-midas.mdc ' +
      '.cursor/rules/01-midas-checks.mdc .agents/skills GEMINI.md .claude/CLAUDE.md',
    files,
  };
}

/** CLI: `node scripts/gitignore-merge.mjs [project-root]` */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const root = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : process.cwd();
  const r = ensureMidasGitignore(root);
  if (r.wrote) {
    console.log(r.upgraded ? 'midas gitignore: upgraded missing patterns' : 'midas gitignore: wrote block');
  } else {
    console.log('midas gitignore: already up to date');
  }
}
