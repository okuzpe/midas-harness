#!/usr/bin/env bash
# Midas — installer shim. A thin wrapper around the one unified Node installer
# (create-midas/index.mjs); this script just bootstraps it so there is no parallel
# bash/PowerShell install logic to drift.
#
# One-line install (run INSIDE the project you want to add Midas to).
# v2 installs one canonical `.harness/` layout. Legacy layouts use explicit `--migrate`.
#   curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash -s -- --force
#
# Uninstall (surgical — removes only Midas's files, keeps your work; --purge to remove everything):
#   curl -fsSL https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.sh | bash -s -- --uninstall
#
# From a local clone:
#   bash install.sh [target-dir] [--force | --uninstall [--dry-run|--purge]]

set -euo pipefail
REPO="okuzpe/midas-harness"

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

# Curl-pipe path: delegate to npx, which clones the repo from GitHub and runs the bin.
if ! command -v npx >/dev/null 2>&1; then
  echo "midas: npx is required (it ships with Node >=22). Reinstall Node.js." >&2
  exit 1
fi
exec npx -y "github:$REPO" "$@"
