// gitignore-merge.mjs — append Midas .gitignore block (secrets, deps, volatile paths). Dependency-free.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from './paths.mjs';

export const GITIGNORE_BEGIN =
  '# midas:begin GITIGNORE — installed by create-midas; extend with your own patterns below';
export const GITIGNORE_END = '# midas:end';

/** Substrings required by harness/rules/security.md CHECK on `.gitignore`. */
export const GITIGNORE_SECURITY_PATTERNS = ['.env', '*.pem', '*secret*', '*credential*'];

/** Patterns we add inside the Midas block (non-comment, non-empty lines from the snippet). */
export function snippetPatterns(snippet) {
  return snippet
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
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

  const snippet = readFileSync(snippetPath, 'utf8').trim();
  const gitignorePath = join(root, '.gitignore');
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';

  if (!existing.includes(GITIGNORE_BEGIN)) {
    const block = `${GITIGNORE_BEGIN}\n${snippet}\n${GITIGNORE_END}\n`;
    const next =
      existing.trim() === '' ? block : `${existing.replace(/\s*$/, '')}\n\n${block}`;
    writeFileSync(gitignorePath, next, 'utf8');
    return { wrote: true, upgraded: false };
  }

  const patterns = snippetPatterns(snippet);
  const missing = patterns.filter((p) => !existing.includes(p));
  if (!missing.length) return { wrote: false, upgraded: false };

  const endIdx = existing.indexOf(GITIGNORE_END);
  if (endIdx === -1) return { wrote: false, upgraded: false };

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
  const snippet = readFileSync(snippetPath, 'utf8');
  const required = [...new Set([...GITIGNORE_SECURITY_PATTERNS, ...snippetPatterns(snippet)])];
  const missing = required.filter((pat) => !existing.includes(pat));

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
