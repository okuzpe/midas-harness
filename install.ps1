# Midas — installer shim (Windows / PowerShell). A thin wrapper around the one unified Node installer
# (cli/index.mjs); this script just bootstraps it so there is no parallel bash/PowerShell
# install logic to drift.
#
# One-line install (run INSIDE the project you want to add Midas to).
# Version pin: read from harness/VERSION (local clone) or main/harness/VERSION (irm pipe).
#   irm https://raw.githubusercontent.com/okuzpe/midas-harness/main/install.ps1 | iex
# Bleeding edge (mutable main):
#   $env:MIDAS_BLEEDING_EDGE=1; irm …/install.ps1 | iex
# Refresh existing install (v2/v3) to the latest release pin:
#   $env:MIDAS_INSTALL_ARGS='update --yes'; irm …/install.ps1 | iex
#   # alias: pwsh install.ps1 --update --yes
#
# From a local clone:
#   pwsh install.ps1 [target-dir] [--force | update --yes | --uninstall [--dry-run|--purge]]

[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$InstallerArgs
)

$ErrorActionPreference = "Stop"
$Repo = "okuzpe/midas-harness"

function Resolve-MidasRef {
  if ($env:MIDAS_INSTALL_REF) { return $env:MIDAS_INSTALL_REF }
  if ($env:MIDAS_BLEEDING_EDGE -eq "1") { return "main" }
  $here = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $null }
  $versionFile = if ($here) { Join-Path $here "harness/VERSION" } else { $null }
  if ($versionFile -and (Test-Path $versionFile)) {
    $v = (Get-Content -LiteralPath $versionFile -Raw).Trim()
    return "v$v"
  }
  $uri = "https://raw.githubusercontent.com/$Repo/main/harness/VERSION"
  $v = (Invoke-WebRequest -Uri $uri -UseBasicParsing).Content.Trim()
  return "v$v"
}

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
$local = if ($here) { Join-Path $here "cli/index.mjs" } else { $null }
if ($local -and (Test-Path $local)) {
  $extra = @()
  if ($env:MIDAS_INSTALL_ARGS) {
    $extra = @($env:MIDAS_INSTALL_ARGS -split '\s+' | Where-Object { $_ })
  }
  & node $local @extra @InstallerArgs
  exit $LASTEXITCODE
}

# Curl-pipe path: delegate to npx on a pinned tag (or main when MIDAS_BLEEDING_EDGE=1).
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Error "midas: npx is required (it ships with Node >=22). Reinstall Node.js."
  exit 1
}
$MidasRef = Resolve-MidasRef
# Optional: $env:MIDAS_INSTALL_ARGS = 'update --yes' when piping (irm | iex) with no argv.
$extra = @()
if ($env:MIDAS_INSTALL_ARGS) {
  $extra = @($env:MIDAS_INSTALL_ARGS -split '\s+' | Where-Object { $_ })
}
& npx -y --package="github:${Repo}#$MidasRef" midas @extra @InstallerArgs
exit $LASTEXITCODE
