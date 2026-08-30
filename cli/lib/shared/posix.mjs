// posix.mjs — path separators for installer relative paths.

/**
 * @param {string} rel
 * @returns {string}
 */
export function toPosixRel(rel) {
  return String(rel || '').replace(/\\/g, '/');
}
