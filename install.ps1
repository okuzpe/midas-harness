# Midas — installer shim (Windows / PowerShell). A thin wrapper around the one unified Node installer
# (create-midas/index.mjs); this script just bootstraps it so there is no parallel bash/PowerShell
# install logic to drift.
#
# One-line install (run INSIDE the project you want to add Midas to).
# Default pin matches harness/VERSION (rewritten by `npm run bump`).
#   irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
# Bleeding edge (mutable main):
#   $env:MIDAS_BLEEDING_EDGE=1; irm …/install.ps1 | iex
#
# From a local clone:
#   pwsh install.ps1 [target-dir] [--force | --uninstall [--dry-run|--purge]]

[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$InstallerArgs
)

$ErrorActionPreference = "Stop"
$Repo = "okuzpe/midas-harness"
# midas-install-ref: bumped by scripts/bump-version.mjs — keep in sync with harness/VERSION
$MidasRef = if ($env:MIDAS_INSTALL_REF) { $env:MIDAS_INSTALL_REF } else { "v2.5.1" }
if ($env:MIDAS_BLEEDING_EDGE -eq "1") { $MidasRef = "main" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "midas: Node.js (>=22) is required. Install: winget install OpenJS.NodeJS.LTS  (or https://nodejs.org)"
  exit 1
}
$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 22) {
  Write-Error "midas: Node $nodeMajor is too old - need Node >=22. Upgrade at https://nodejs.org."
  exit 1
}

# Inside a clone? run the local installer directly. Null-safe for the `irm | iex` (stdin) path.
$here = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $null }
$local = if ($here) { Join-Path $here "create-midas/index.mjs" } else { $null }
if ($local -and (Test-Path $local)) {
  & node $local @InstallerArgs
  exit $LASTEXITCODE
}

# Curl-pipe path: delegate to npx on a pinned tag (or main when MIDAS_BLEEDING_EDGE=1).
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Error "midas: npx is required (it ships with Node >=22). Reinstall Node.js."
  exit 1
}
& npx -y "github:${Repo}#${MidasRef}" @InstallerArgs
exit $LASTEXITCODE
