# One-click local start for cursor-sdk2api with durable STATE_DIR.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$StateDir = Join-Path $Root ".state"
$EnvFile = Join-Path $Root ".env"
$DefaultGatewayKey = "local-dev-gateway-key"

function Import-DotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$name" -Value $value
  }
}

if (-not (Test-Path $EnvFile)) {
  @"
HOST=0.0.0.0
PORT=8080
AUTH_MODE=managed
GATEWAY_ACCESS_KEY=$DefaultGatewayKey
STATE_DIR=$StateDir
LOG_LEVEL=info
"@ | Set-Content -LiteralPath $EnvFile -Encoding UTF8
  Write-Host "Created $EnvFile"
}

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
Import-DotEnv -Path $EnvFile

# Always pin durable state to the repo-local directory.
$env:STATE_DIR = $StateDir
if (-not $env:AUTH_MODE) { $env:AUTH_MODE = "managed" }
if (-not $env:GATEWAY_ACCESS_KEY) { $env:GATEWAY_ACCESS_KEY = $DefaultGatewayKey }
if (-not $env:HOST) { $env:HOST = "0.0.0.0" }
if (-not $env:PORT) { $env:PORT = "8080" }

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  Write-Host "Installing dependencies..."
  npm ci
}

if (-not (Test-Path (Join-Path $Root "dist\index.js"))) {
  Write-Host "Building..."
  npm run build
}

Write-Host "Starting cursor-sdk2api"
Write-Host "  console : http://127.0.0.1:$($env:PORT)/console/"
Write-Host "  STATE_DIR=$($env:STATE_DIR)"
Write-Host "  AUTH_MODE=$($env:AUTH_MODE)"
npm start
