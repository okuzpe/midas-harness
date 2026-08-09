#!/usr/bin/env bash
# Midas — installer shim. A thin wrapper around the one unified Node installer
# (cli/index.mjs); this script just bootstraps it so there is no parallel
# bash/PowerShell install logic to drift.
#
# One-line install (run INSIDE the project you want to add Midas to).
# Version pin: read from harness/VERSION (local clone) or main/harness/VERSION (curl pipe).
#   curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
# Bleeding edge (mutable main):
#   MIDAS_BLEEDING_EDGE=1 curl -fsSL …/install.sh | bash
#
# From a local clone:
#   bash install.sh [target-dir] [--force | --uninstall [--dry-run|--purge]]

set -euo pipefail
REPO="okuzpe/midas-harness"

resolve_midas_ref() {
  if [ -n "${MIDAS_INSTALL_REF:-}" ]; then
    printf '%s' "$MIDAS_INSTALL_REF"
    return
  fi
  if [ "${MIDAS_BLEEDING_EDGE:-}" = "1" ]; then
    printf '%s' "main"
    return
  fi
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" 2>/dev/null && pwd)" || here=""
  if [ -n "$here" ] && [ -f "$here/harness/VERSION" ]; then
    printf 'v%s' "$(tr -d '\n\r' < "$here/harness/VERSION")"
    return
  fi
  local ver
  ver="$(curl -fsSL "https://raw.githubusercontent.com/${REPO}/main/harness/VERSION" | tr -d '\n\r')"
  printf 'v%s' "$ver"
}

if ! command -v node >/dev/null 2>&1; then
  echo "midas: Node.js (>=22) is required. Install from https://nodejs.org (macOS: brew install node)." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "midas: Node $NODE_MAJOR is too old — need Node >=22. Upgrade at https://nodejs.org." >&2
  exit 1
fi

# Inside a clone? run the local installer directly (offline-friendly). BASH_SOURCE is unset when bash
# reads from stdin (curl | bash), and `set -u` would trip on a bare reference — default to empty.
here="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" 2>/dev/null && pwd)" || here=""
if [ -n "$here" ] && [ -f "$here/cli/index.mjs" ]; then
  exec node "$here/cli/index.mjs" "$@"
fi

# Curl-pipe path: delegate to npx on a pinned tag (or main when MIDAS_BLEEDING_EDGE=1).
if ! command -v npx >/dev/null 2>&1; then
  echo "midas: npx is required (it ships with Node >=22). Reinstall Node.js." >&2
  exit 1
fi
MIDAS_REF="$(resolve_midas_ref)"
exec npx -y --package="github:$REPO#$MIDAS_REF" midas "$@"
