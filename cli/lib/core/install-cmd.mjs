// install-cmd.mjs — canonical `npx github:okuzpe/midas-harness` command strings.
// Skills/docs use `#v{VERSION}` placeholders; runtime code imports this module.

export const MIDAS_REPO = 'okuzpe/midas-harness';

/**
 * @param {string | null | undefined} version SemVer without `v` prefix; omit for unpinned `main`.
 * @param {string | null | undefined} commit  Full git SHA. Wins over `version` when both are set
 *   so `edge` can pin a commit that has not been tagged.
 */
export function npxPackageRef(version, commit = null) {
  if (commit) return `github:${MIDAS_REPO}#${commit}`;
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
 * The `update` subcommand is the canonical spelling; `--update` still parses as an alias so older
 * docs and skills keep working.
 *
 * This is a printed command. The CLI never re-execs npx: `--check` discovers, the human or CI
 * runs the printed line to download the payload.
 *
 * @param {{ version?: string | null, commit?: string | null, channel?: string | null, flags?: string }} [opts]
 */
export function formatUpdateCmd(opts = {}) {
  const ref = npxPackageRef(opts.version ?? null, opts.commit ?? null);
  const channel = opts.channel && opts.channel !== 'stable' ? ` --channel=${opts.channel}` : '';
  const flags = opts.flags ? ` ${opts.flags.trim()}` : '';
  return `npx ${ref} update${channel}${flags}`;
}

/**
 * Apply-command for a published channel manifest.
 * `stable` pins the tag; `edge` pins the commit (many commits share one VERSION).
 */
export function formatUpdateCmdFromRelease(manifest, { channel } = {}) {
  const resolved = channel || manifest?.channel || 'stable';
  if (resolved === 'edge') {
    return formatUpdateCmd({ commit: manifest?.commit || null, channel: 'edge' });
  }
  return formatUpdateCmd({ version: manifest?.version || null, channel: resolved });
}

/** Read-only "is there anything new?" — exits 0 current, 1 available, 2 undetermined. */
export function formatUpdateCheckCmd(opts = {}) {
  const channel = opts.channel && opts.channel !== 'stable' ? ` --channel=${opts.channel}` : '';
  return `npx ${npxPackageRef()} update --check${channel}`;
}

/** Unpinned diagnose (no version pin required). */
export function formatDiagnoseCmd() {
  return `npx ${npxPackageRef()} --diagnose`;
}
