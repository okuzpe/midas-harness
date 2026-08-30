// cli-io.mjs — shared help / exit codes for engine CLIs (zero npm deps).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EXIT = Object.freeze({
  ok: 0,
  fail: 1,
  usage: 2,
  notEngine: 2,
});

/**
 * @param {string} metaUrl import.meta.url of the CLI file
 * @returns {boolean}
 */
export function isMainModule(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(resolve(process.argv[1])).href === metaUrl;
  } catch {
    return false;
  }
}

/**
 * Print a CLI's header comments when `--help`/`-h` is passed and this file is main.
 * @param {string} metaUrl
 * @param {string} [helpText] optional explicit help; default = leading // comments
 * @param {string[]} [argv]
 * @returns {boolean} true when help was printed (caller should exit 0)
 */
export function maybeHelp(metaUrl, helpText, argv = process.argv.slice(2)) {
  if (!isMainModule(metaUrl)) return false;
  if (!argv.includes('--help') && !argv.includes('-h')) return false;
  if (helpText) {
    process.stdout.write(helpText.endsWith('\n') ? helpText : `${helpText}\n`);
    return true;
  }
  const file = fileURLToPath(metaUrl);
  const text = readFileSync(file, 'utf8');
  const lines = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#!')) continue;
    if (line.startsWith('//')) {
      lines.push(line.replace(/^\/\/\s?/, ''));
      continue;
    }
    if (line.trim() === '') {
      if (lines.length) break;
      continue;
    }
    break;
  }
  const body = lines.join('\n').trim() || `${file} — pass arguments; see source header.`;
  process.stdout.write(`${body}\n`);
  return true;
}

/**
 * @param {string} prefix e.g. `midas doctor`
 * @param {string} message
 */
export function logInfo(prefix, message) {
  process.stdout.write(`${prefix}: ${message}\n`);
}

/**
 * @param {string} prefix
 * @param {string} message
 */
export function logError(prefix, message) {
  process.stderr.write(`${prefix}: ${message}\n`);
}
