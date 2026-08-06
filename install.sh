#!/usr/bin/env bash
# Midas — installer shim. A thin wrapper around the one unified Node installer
# (create-midas/index.mjs); this script just bootstraps it so there is no parallel
# bash/PowerShell install logic to drift.
#
# One-line install (run INSIDE the project you want to add Midas to).
# Default pin matches harness/VERSION (rewritten by `npm run bump`).
#   curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
# Bleeding edge (mutable main):
#   MIDAS_BLEEDING_EDGE=1 curl -fsSL …/install.sh | bash
#
# From a local clone:
#   bash install.sh [target-dir] [--force | --uninstall [--dry-run|--purge]]

set -euo pipefail
REPO="okuzpe/midas-harness"
# midas-install-ref: bumped by scripts/bump-version.mjs — keep in sync with harness/VERSION
MIDAS_REF="${MIDAS_INSTALL_REF:-v2.5.4}"
if [ "${MIDAS_BLEEDING_EDGE:-}" = "1" ]; then
  MIDAS_REF="main"
fi

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
if [ -n "$here" ] && [ -f "$here/create-midas/index.mjs" ]; then
  exec node "$here/create-midas/index.mjs" "$@"
fi

# Curl-pipe path: delegate to npx on a pinned tag (or main when MIDAS_BLEEDING_EDGE=1).
if ! command -v npx >/dev/null 2>&1; then
  echo "midas: npx is required (it ships with Node >=22). Reinstall Node.js." >&2
  exit 1
fi
exec npx -y "github:$REPO#$MIDAS_REF" "$@"
