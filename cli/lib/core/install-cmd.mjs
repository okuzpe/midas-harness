// install-cmd.mjs — canonical `npx github:okuzpe/midas-harness` command strings.
// Skills/docs use `#v{VERSION}` placeholders; runtime code imports this module.

export const MIDAS_REPO = 'okuzpe/midas-harness';

/**
 * @param {string | null | undefined} version SemVer without `v` prefix; omit for unpinned `main`.
 */
export function npxPackageRef(version) {
  if (!version) return `github:${MIDAS_REPO}`;
  return `github:${MIDAS_REPO}#v${version}`;
}

/**
 * @param {{ version?: string | null, tools?: string }} [opts]
 */
export function formatInstallCmd(opts = {}) {
  const tools = opts.tools ?? 'cursor';
  const ref = npxPackageRef(opts.version ?? null);
  return `npx ${ref} --tools=${tools}`;
}

/**
 * @param {{ version?: string | null, flags?: string }} [opts]
 */
export function formatUpdateCmd(opts = {}) {
  const ref = npxPackageRef(opts.version ?? null);
  const flags = opts.flags ? ` ${opts.flags.trim()}` : '';
  return `npx ${ref} --update${flags}`;
}

/** Unpinned diagnose (no version pin required). */
export function formatDiagnoseCmd() {
  return `npx ${npxPackageRef()} --diagnose`;
}

/**
 * @param {{ version?: string | null, apply?: boolean }} [opts]
 */
export function formatMigrateCmd(opts = {}) {
  const ref = npxPackageRef(opts.version ?? null);
  return opts.apply ? `npx ${ref} --migrate --apply` : `npx ${ref} --migrate`;
}
