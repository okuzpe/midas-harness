// profiles.mjs — doctor --strict profile filters.

export const INSTALL_VERIFY_WARN_ONLY = new Set([
  'rules:combined',
  'mcp:governance',
  'mcp:declared-vs-wired',
  'mcp:cursor-sync',
  'mcp:template-sync',
  // Product lifecycle — an engine refresh must not fail because a sprint is open.
  'gate:diff-receipts',
  'gate:close-ready',
  'gate:sprint-continuity',
  'gate:records',
  'gate:phase-artifacts',
]);

/** Per-sprint doctor rows; same product-lifecycle bucket as the names above. */
export const INSTALL_VERIFY_WARN_ONLY_PREFIXES = ['gate:audit-', 'audit:attestation-'];

export const UPDATE_PREFLIGHT_BLOCKING = new Set([
  'layout:consistent',
  'update:conflicts',
]);

export function isInstallVerifyWarnOnly(name) {
  if (INSTALL_VERIFY_WARN_ONLY.has(name)) return true;
  return INSTALL_VERIFY_WARN_ONLY_PREFIXES.some((prefix) => name.startsWith(prefix));
}

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
  if (profile === 'install-verify' && isInstallVerifyWarnOnly(name)) return false;
  return true;
}
