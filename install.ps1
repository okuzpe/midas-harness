# Midas — installer shim (Windows / PowerShell). A thin wrapper around the one unified Node installer
# (create-midas/index.mjs); this script just bootstraps it so there is no parallel bash/PowerShell
# install logic to drift.
#
# One-line install (run INSIDE the project you want to add Midas to):
#   irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
#
# From a local clone:
#   pwsh install.ps1 [target-dir] [--force]

[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$InstallerArgs
)

$ErrorActionPreference = "Stop"
$Repo = "okuzpe/midas-harness"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "midas: Node.js (>=16.7) is required. Install: winget install OpenJS.NodeJS.LTS  (or https://nodejs.org)"
  exit 1
}
$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 16) {
  Write-Error "midas: Node $nodeMajor is too old - need Node >=16.7. Upgrade at https://nodejs.org."
  exit 1
}

# Inside a clone? run the local installer directly. Null-safe for the `irm | iex` (stdin) path.
$here = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $null }
$local = if ($here) { Join-Path $here "create-midas/index.mjs" } else { $null }
if ($local -and (Test-Path $local)) {
  & node $local @InstallerArgs
  exit $LASTEXITCODE
}

# Curl-pipe path: delegate to npx, which clones the repo from GitHub and runs the bin.
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Error "midas: npx is required (it ships with Node >=16.7). Reinstall Node.js."
  exit 1
}
& npx -y "github:$Repo" @InstallerArgs
exit $LASTEXITCODE
