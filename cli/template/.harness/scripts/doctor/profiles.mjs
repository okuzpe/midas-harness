// profiles.mjs — doctor --strict profile filters.

export const INSTALL_VERIFY_WARN_ONLY = new Set([
  'rules:combined',
  'mcp:governance',
  'mcp:declared-vs-wired',
  'mcp:cursor-sync',
  'mcp:template-sync',
]);

export const UPDATE_PREFLIGHT_BLOCKING = new Set([
  'layout:consistent',
  'update:conflicts',
]);

/**
 * @param {string} name
 * @param {{ preflight?: boolean, gatesOnly?: boolean, profile?: string }} opts
 */
export function isStrictBlockingName(name, opts = {}) {
  const { preflight = false, gatesOnly = false, profile = 'full' } = opts;
  if (preflight) return UPDATE_PREFLIGHT_BLOCKING.has(name);
  if (gatesOnly) return name.startsWith('gate:');
  const core =
    name === 'version' ||
    name === 'routing' ||
    name.startsWith('state:') ||
    name.startsWith('layout:') ||
    name.startsWith('file:') ||
    name.startsWith('manifest:') ||
    name.startsWith('mirror:') ||
    name.startsWith('gate:') ||
    name === 'gates:registry' ||
    name === 'stage-table' ||
    name === 'design-system:tokens' ||
    name === 'checks:index' ||
    name === 'skills:registry' ||
    name === 'rules:combined' ||
    name === 'skills:frontmatter' ||
    name === 'gitignore:midas-block' ||
    name === 'mcp:secret-free' ||
    name === 'mcp:governance' ||
    name === 'mcp:declared-vs-wired' ||
    name === 'mcp:skill-required' ||
    name === 'mcp:cursor-sync' ||
    name === 'mcp:template-sync';
  if (!core) return false;
  if (profile === 'install-verify' && INSTALL_VERIFY_WARN_ONLY.has(name)) return false;
  return true;
}
